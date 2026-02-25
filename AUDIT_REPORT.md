# Code Audit Report

**Date:** February 26, 2025
**Auditor:** Jules (AI Senior Software Engineer)
**Target:** Vellko Affiliate Dashboard Codebase (Backend & Frontend)

---

## 1. Executive Summary

The audit of the Vellko Affiliate Dashboard has revealed several **Critical** security vulnerabilities and logical flaws that must be addressed before production deployment. The most severe issues allow for unauthenticated data manipulation (account takeover via signup), exposure of sensitive credentials (SMTP passwords in plaintext), and insecure default passwords for new accounts.

### Severity Summary

| Severity | Count | Key Issues |
| :--- | :---: | :--- |
| **Critical** | 3 | Unauthenticated Signup Overwrite, Plaintext SMTP Credentials, Hardcoded Default Password |
| **High** | 3 | Stored XSS, Inconsistent Authorization, Weak Encryption Key Management |
| **Medium** | 4 | Public User Enumeration, Broken Access Control (Disabled Users), N+1 Queries, Lack of Input Sanitization |
| **Low** | 5 | Code Duplication, `any` types in TS, Lack of Service Layer |

---

## 2. Syntax Errors

No major syntax errors prevented the application from starting, but the following runtime risks were identified:

*   **Runtime Error Risk**: In `backend/routers/admin.py`, the `delete_document` function attempts to remove a file using `os.remove` inside a `try/except` block that swallows exceptions with `pass`. If the file is locked or permissions are wrong, the DB record is deleted but the file remains (orphan file).
*   **Runtime Warning**: In `backend/database.py`, `settings` initialization relies on `.env` file presence. If `.env` is missing in production (e.g., Docker w/ env vars), `pydantic-settings` handles it, but the fallback logic for `SECRET_KEY` raises an error immediately (which is good, but should be handled gracefully).

---

## 3. Logical Errors

### 3.1. Unintended Signup Overwrite (Critical)
**File:** `backend/routers/public.py`
**Problem:** The `create_signup` function checks if an email exists. If it does, it updates the record.
**Why:** This endpoint is **public**. A malicious user can submit a signup with a target's email (e.g., a pending admin approval) and overwrite their data (e.g., changing payment info to their own) without authentication.
**Fix:** Reject the request if the email already exists, or require authentication to update.

### 3.2. Public User Enumeration
**File:** `backend/routers/public.py`
**Problem:** `get_referrers` returns a list of all users (IDs and Names).
**Why:** This allows an attacker to harvest valid usernames/names for social engineering or brute-force attacks.
**Fix:** Only return users explicitly marked as "Referrers" or limit the data returned.

### 3.3. Broken Access Control (Disabled Users)
**File:** `backend/auth.py` / `backend/routers/users.py`
**Problem:** `get_current_active_user` checks for `disabled`, but `get_current_user` (used in `read_users_me` and others) only decodes the token.
**Why:** A disabled user with a valid JWT can still access read-only endpoints or even some write endpoints if `get_current_user` is used instead of `get_current_active_user`.

---

## 4. Security Vulnerabilities

### 4.1. Hardcoded Default Password (Critical)
**File:** `backend/routers/admin.py`
**Problem:** `approve_signup` sets `contact_password` to `"ChangeMe123!"` for new Cake Marketing accounts.
**Why:** If the user doesn't change it immediately, their account is easily compromised.
**Fix:** Generate a random secure password and email it to the user, or force a reset on first login.

### 4.2. Plaintext SMTP Credentials (Critical)
**File:** `backend/routers/settings.py` / Database
**Problem:** SMTP passwords are stored in plaintext in the `smtp_configs` collection.
**Why:** If the database is compromised (e.g., via Injection or backup leak), the attacker gains access to the email server, allowing for phishing or spam campaigns from a trusted domain.
**Fix:** Encrypt the password field using a dedicated key.

### 4.3. Stored XSS via Corporate Website (High)
**File:** `next-app/src/app/dashboard/signups/[id]/page.tsx`
**Problem:** The admin dashboard renders the `corporateWebsite` link directly in an `href` attribute: `<a href={signup.companyInfo.corporateWebsite}>`.
**Why:** The backend accepts any string. An attacker can submit `javascript:alert(document.cookie)` as their website. When an admin clicks the link, the script executes in the admin's session.
**Fix:** Validate the URL format strictly in the backend (allow only `http://` and `https://`) and sanitize the output in React.

### 4.4. Weak Encryption Key Management
**File:** `backend/encryption_utils.py`
**Problem:** The encryption key for database fields (API keys) is derived from the `SECRET_KEY` (used for JWTs).
**Why:** Violates key separation principles. If the JWT key is rotated/changed, all encrypted database data becomes unreadable. If the JWT key leaks, database secrets are compromised.
**Fix:** Use a separate `DATA_ENCRYPTION_KEY` environment variable.

---

## 5. Performance Issues

### 5.1. N+1 Query in Statistics
**File:** `backend/routers/admin.py`
**Problem:** `get_stats` performs multiple separate `count_documents` queries for every status and category permutation.
**Impact:** As the dataset grows, the dashboard loading time will degrade significantly.
**Fix:** Use MongoDB Aggregation Framework (`$facet` or `$group`) to fetch all counts in a single database round-trip.

### 5.2. Blocking Email Operations
**File:** `backend/email_utils.py`
**Problem:** `send_email` runs `smtplib` (synchronous) in a thread executor. While better than blocking the main loop, heavy email traffic can exhaust the thread pool.
**Fix:** Use an asynchronous SMTP library like `aiosmtplib` or offload email sending to a background worker (e.g., Celery/Redis).

---

## 6. Code Quality Issues

*   **Frontend Type Safety**: Heavy use of `any` in TypeScript files (`next-app/src/auth.ts`, `next-app/src/app/dashboard/signups/[id]/page.tsx`). Defeats the purpose of TypeScript.
*   **Magic Strings**: Status strings ("APPROVED", "PENDING") are hardcoded in multiple places (Backend routers and Frontend components).
*   **Code Duplication**: `Sidebar.tsx` repeats logic for `Offers` and `Q/A Forms`.

---

## 7. Architecture Issues

*   **Fat Controllers**: `backend/routers/admin.py` contains heavy business logic (Cake API calls, email sending, DB updates) mixed with route handling.
*   **Coupling**: The frontend `auth.ts` is tightly coupled to the specific backend implementation of `/token`.

---

## 8. Security Hardening Recommendations

1.  **Implement Rate Limiting**: The `/signup` and `/token` endpoints are vulnerable to brute-force and DoS. Use `fastapi-limiter`.
2.  **Enable CSP**: Configure Content Security Policy headers in Next.js to prevent XSS execution.
3.  **Audit Logs**: Implement a centralized audit log for all Admin actions (who approved what and when).
4.  **Input Sanitization**: Use a library like `bleach` (Python) or `dompurify` (JS) to sanitize all user inputs before storage or rendering.

---

## 9. Detailed Fixes

### Fix 1: Prevent Unauthenticated Signup Overwrite

**Problem:** `create_signup` allows overwriting.
**Corrected Code (`backend/routers/public.py`):**

```python
@router.post("/signup", response_model=dict)
async def create_signup(signup: SignupCreate):
    signup_dict = signup.dict()

    # Check for existing email
    existing = await db.signups.find_one({"accountInfo.email": signup.accountInfo.email})

    if existing:
        # SECURITY FIX: Do not allow overwrite without auth.
        # Return generic message to prevent enumeration, or specific error if desired.
        # Ideally, ask user to login to check status.
        raise HTTPException(
            status_code=400,
            detail="An application with this email already exists. Please login to check status."
        )

    # ... rest of creation logic ...
```

### Fix 2: Secure Password Generation

**Problem:** Hardcoded password `ChangeMe123!`.
**Corrected Code (`backend/routers/admin.py`):**

```python
import secrets
import string

def generate_secure_password(length=16):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for i in range(length))

# Inside approve_signup
# ...
random_password = generate_secure_password()
api_params = {
    # ...
    "contact_password": random_password, # Send this via email to user later
    # ...
}
```

### Fix 3: Encrypt SMTP Credentials

**Problem:** Plaintext SMTP password.
**Corrected Code (`backend/routers/settings.py`):**

```python
from encryption_utils import encrypt_field

@router.post("/smtp", response_model=SMTPConfig)
async def create_smtp_config(config: SMTPConfigCreate, user: User = Depends(get_current_admin)):
    config_dict = config.dict()
    # Encrypt password before saving
    config_dict["password"] = encrypt_field(config_dict["password"])
    # ...
```

**Note:** You must also update `backend/email_utils.py` to `decrypt_field` before using the password.

### Fix 4: Fix Broken Access Control

**Problem:** `get_current_user` allows disabled users.
**Corrected Code (`backend/auth.py`):**

```python
# Replace usage of get_current_user with get_current_active_user in routers
# Or modify get_current_user to check DB:

async def get_current_user_token(token: str = Depends(oauth2_scheme)):
    # ... JWT decode logic ...
    return username

async def get_current_user(username: str = Depends(get_current_user_token)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("disabled"):
         raise HTTPException(status_code=403, detail="Account disabled")
    return User(**user)
```

### Fix 5: Prevent Stored XSS

**Problem:** Unvalidated URLs.
**Corrected Code (`backend/models.py`):**

```python
from pydantic import HttpUrl

class CompanyInfo(BaseModel):
    # ...
    # Enforce URL format validation
    corporateWebsite: Optional[HttpUrl] = None
    # ...
```

**And in Frontend (`next-app/src/app/dashboard/signups/[id]/page.tsx`):**

```tsx
// Helper to validate protocol
const isValidUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch { return false; }
};

// ... inside render ...
{signup.companyInfo?.corporateWebsite && isValidUrl(signup.companyInfo.corporateWebsite) ? (
    <a href={signup.companyInfo.corporateWebsite} target="_blank" rel="noopener noreferrer">
        {signup.companyInfo.corporateWebsite}
    </a>
) : (
    <span>{signup.companyInfo?.corporateWebsite || '-'}</span>
)}
```

---
