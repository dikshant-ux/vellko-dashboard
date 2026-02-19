import base64
import hashlib
from cryptography.fernet import Fernet
from database import settings

def get_fernet_key() -> bytes:
    """
    Derive a 32-byte b64-encoded key from the application's SECRET_KEY.
    Used for API connection key encryption (backward compat).
    """
    secret = settings.SECRET_KEY.encode()
    key = hashlib.sha256(secret).digest()
    return base64.urlsafe_b64encode(key)

def get_smtp_fernet_key() -> bytes:
    """
    Derive a Fernet key for SMTP password encryption.
    Uses DATA_ENCRYPTION_KEY if set, falls back to SECRET_KEY for backward compat.
    SECURITY: Keeping keys separate from JWT signing key is best practice.
    """
    key_source = settings.DATA_ENCRYPTION_KEY if settings.DATA_ENCRYPTION_KEY else settings.SECRET_KEY
    key = hashlib.sha256(key_source.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_field(value: str) -> str:
    """Encrypt a field using the primary key (for API keys)."""
    if not value:
        return ""
    f = Fernet(get_fernet_key())
    return f.encrypt(value.encode()).decode()

def decrypt_field(value: str) -> str:
    """Decrypt a field encrypted with the primary key (for API keys)."""
    if not value:
        return ""
    try:
        f = Fernet(get_fernet_key())
        return f.decrypt(value.encode()).decode()
    except Exception as e:
        print(f"Decryption error: {e}")
        return value  # Fallback: may be plaintext (migration safety)

def encrypt_smtp_password(value: str) -> str:
    """Encrypt an SMTP password using the DATA_ENCRYPTION_KEY."""
    if not value:
        return ""
    f = Fernet(get_smtp_fernet_key())
    return f.encrypt(value.encode()).decode()

def decrypt_smtp_password(value: str) -> str:
    """Decrypt an SMTP password. Falls back to plaintext if decryption fails (pre-migration data)."""
    if not value:
        return ""
    try:
        f = Fernet(get_smtp_fernet_key())
        return f.decrypt(value.encode()).decode()
    except Exception:
        # Gracefully handle plaintext passwords (pre-migration). Run migrate_smtp_passwords.py to fix.
        return value
