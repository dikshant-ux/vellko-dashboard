from fastapi import APIRouter, HTTPException, Body, Depends, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from database import db, settings
from models import SignupCreate, SignupStatus, Token, UserRole
from datetime import datetime, timedelta
from auth import verify_password, create_access_token, get_password_hash
from email_utils import send_reset_password_email, send_signup_notification_email
from pydantic import BaseModel, EmailStr
import uuid
import pyotp

router = APIRouter()

@router.get("/referrers", response_model=list[str])
async def get_referrers():
    # Return list of full names of all users to be used as referrals
    cursor = db.users.find({"disabled": {"$ne": True}}, {"full_name": 1, "_id": 0})
    users = await cursor.to_list(length=1000)
    return [u["full_name"] for u in users if u.get("full_name")]

@router.post("/signup", response_model=dict)
async def create_signup(signup: SignupCreate):
    signup_dict = signup.dict()
    
    # Check for existing email to allow updates
    existing = await db.signups.find_one({"accountInfo.email": signup.accountInfo.email})
    
    if existing:
        # Update existing record
        update_data = signup_dict
        update_data["status"] = SignupStatus.PENDING # Re-review needed
        update_data["is_updated"] = True
        update_data["updated_at"] = datetime.utcnow()
        # Ensure created_at is not overwritten if it exists in DB, 
        # but SignupCreate doesn't have it, so we are fine.
        
        await db.signups.update_one(
            {"_id": existing["_id"]},
            {"$set": update_data}
        )
        return {"id": str(existing["_id"]), "message": "Application updated successfully"}

    # Create new record
    signup_dict["status"] = SignupStatus.PENDING
    signup_dict["created_at"] = datetime.utcnow()
    signup_dict["is_updated"] = False
    
    result = await db.signups.insert_one(signup_dict)
    
    # Send Email Notifications
    try:
        # 1. Get Admins and Super Admins
        admin_cursor = db.users.find(
            {"role": {"$in": [UserRole.ADMIN, UserRole.SUPER_ADMIN]}, "disabled": {"$ne": True}},
            {"email": 1}
        )
        admins = await admin_cursor.to_list(length=100)
        recipient_emails = {u["email"] for u in admins if u.get("email")}
        
        # 2. Get Referrer if exists
        referral_name = signup.companyInfo.referral
        if referral_name and referral_name not in ["Others", "Other", "None", ""]:
             referrer = await db.users.find_one({"full_name": referral_name}, {"email": 1})
             if referrer and referrer.get("email"):
                 recipient_emails.add(referrer["email"])
                 
        # 3. Send Emails
        if recipient_emails:
            # We use a background task or just await it here. 
            # For simplicity/robustness in this context, we await it (it's fast enough via SMTP usually)
            # or could use BackgroundTasks from FastAPI if passed to the route.
            # Given the current structure, synchronous call is okay or we can just call the util which handles its own try/catch.
            await send_signup_notification_email(list(recipient_emails), signup_dict, str(result.inserted_id))
            
    except Exception as e:
        print(f"Error sending signup notifications: {e}")
    
    return {"id": str(result.inserted_id), "message": "Application submitted successfully"}

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember: bool = Form(False),
    otp: str = Form(None)
):
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.get("disabled", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Please contact administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Check 2FA
    if user.get("is_two_factor_enabled", False):
        if not otp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="mfa_required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        totp = pyotp.TOTP(user["two_factor_secret"])
        if not totp.verify(otp):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication code",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # If remember is True, set expiry to 30 days, else use default setting
    # Robustly handle string inputs if passed via Form e.g. "true"/"false"
    is_remembered = remember
    if isinstance(remember, str):
        is_remembered = remember.lower() in ["true", "1", "t", "y", "yes", "on"]
        
    expire_minutes = 30 * 24 * 60 if is_remembered else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    access_token_expires = timedelta(minutes=expire_minutes)
    
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = await db.users.find_one({"email": request.email})
    if not user:
        # Don't reveal if user exists
        return {"message": "If this email is registered, you will receive password reset instructions."}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    reset_token_expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires_at": reset_token_expires_at
        }}
    )
    
    # Send email
    # Note: send_reset_password_email is now async. In production, use background tasks.
    # For now, we'll run it directly or wrap in thread if blocking is an issue, 
    # but for low volume it's acceptable.
    await send_reset_password_email(request.email, reset_token)
    
    return {"message": "If this email is registered, you will receive password reset instructions."}

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    user = await db.users.find_one({
        "reset_token": request.token,
        "reset_token_expires_at": {"$gt": datetime.utcnow()} # Expiry check
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid or expired reset token"
        )
        
    hashed_password = get_password_hash(request.new_password)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "hashed_password": hashed_password,
            "reset_token": None,
            "reset_token_expires_at": None
        }}
    )
    
    return {"message": "Password has been reset successfully"}
