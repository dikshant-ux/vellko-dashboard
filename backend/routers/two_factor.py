from fastapi import APIRouter, HTTPException, Depends
from models import User
from auth import get_current_active_user
from database import db
from pydantic import BaseModel
import pyotp

router = APIRouter()

class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_url: str

class VerifyRequest(BaseModel):
    token: str
    secret: str = None  # Only used for initial verification before saving to DB

@router.post("/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(user: User = Depends(get_current_active_user)):
    """
    Generate a new TOTP secret for the user to scan.
    Note: Does not enable 2FA yet. User must verify code first.
    """
    secret = pyotp.random_base32()
    
    # Generate provisioning URI for QR code
    otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user.username,
        issuer_name="Vellko Affiliate"
    )
    
    return {"secret": secret, "otpauth_url": otpauth_url}

@router.post("/enable")
async def enable_two_factor(request: VerifyRequest, user: User = Depends(get_current_active_user)):
    """
    Verify the code generated from the new secret and enable 2FA for the user.
    """
    if not request.secret:
        raise HTTPException(status_code=400, detail="Secret is required for setup verification")

    totp = pyotp.TOTP(request.secret)
    if not totp.verify(request.token):
        raise HTTPException(status_code=400, detail="Invalid code")
        
    await db.users.update_one(
        {"username": user.username},
        {"$set": {
            "two_factor_secret": request.secret,
            "is_two_factor_enabled": True
        }}
    )
    
    return {"message": "Two-factor authentication enabled successfully"}

@router.post("/disable")
async def disable_two_factor(request: VerifyRequest, user: User = Depends(get_current_active_user)):
    """
    Disable 2FA. Requires a valid code from the currently enabled device/app.
    """
    if not user.is_two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
        
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(request.token):
        raise HTTPException(status_code=400, detail="Invalid code")
        
    await db.users.update_one(
        {"username": user.username},
        {"$set": {
            "two_factor_secret": None,
            "is_two_factor_enabled": False
        }}
    )
    
    return {"message": "Two-factor authentication disabled successfully"}
