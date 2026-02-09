from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class SignupStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class CompanyInfo(BaseModel):
    companyName: str
    address: str
    address2: Optional[str] = ""
    city: str
    state: str
    zip: str
    country: str
    corporateWebsite: Optional[str] = ""
    referral: Optional[str] = ""

class MarketingInfo(BaseModel):
    paymentModel: str
    primaryCategory: str
    secondaryCategory: Optional[str] = ""
    comments: Optional[str] = ""

class AccountInfo(BaseModel):
    firstName: str
    lastName: str
    title: Optional[str] = ""
    workPhone: str
    cellPhone: Optional[str] = ""
    fax: Optional[str] = ""
    email: EmailStr
    timezone: str
    imService: Optional[str] = ""
    imHandle: Optional[str] = ""

class PaymentInfo(BaseModel):
    payTo: str
    currency: str
    taxClass: str
    ssnTaxId: str

class SignupCreate(BaseModel):
    companyInfo: CompanyInfo
    marketingInfo: MarketingInfo
    accountInfo: AccountInfo
    paymentInfo: PaymentInfo
    agreed: bool
    ipAddress: Optional[str] = "0.0.0.0"

from pydantic import BeforeValidator
from typing import Annotated

# Helper to handle ObjectId
PyObjectId = Annotated[str, BeforeValidator(str)]

class SignupDocument(BaseModel):
    filename: str
    path: str
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class SignupInDB(SignupCreate):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    status: SignupStatus = SignupStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    cake_affiliate_id: Optional[str] = None
    cake_message: Optional[str] = None
    cake_response: Optional[str] = None
    decision_reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    documents: List[SignupDocument] = Field(default_factory=list)
    is_updated: bool = False
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {
            # This might not be needed with v2 annotation but kept for safety if v1 logic persists
        }

class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    USER = "USER"

class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: UserRole = UserRole.USER
    disabled: Optional[bool] = False
    reset_token: Optional[str] = None
    reset_token_expires_at: Optional[datetime] = None
    two_factor_secret: Optional[str] = None
    is_two_factor_enabled: Optional[bool] = False

class UserCreate(User):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserRoleUpdate(BaseModel):
    role: UserRole

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Update Models
class CompanyInfoUpdate(BaseModel):
    companyName: Optional[str] = None
    address: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    corporateWebsite: Optional[str] = None
    referral: Optional[str] = None

class MarketingInfoUpdate(BaseModel):
    paymentModel: Optional[str] = None
    primaryCategory: Optional[str] = None
    secondaryCategory: Optional[str] = None
    comments: Optional[str] = None

class AccountInfoUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    title: Optional[str] = None
    workPhone: Optional[str] = None
    cellPhone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    imService: Optional[str] = None
    imHandle: Optional[str] = None

class PaymentInfoUpdate(BaseModel):
    payTo: Optional[str] = None
    currency: Optional[str] = None
    taxClass: Optional[str] = None
    ssnTaxId: Optional[str] = None

class SignupUpdate(BaseModel):
    companyInfo: Optional[CompanyInfoUpdate] = None
    marketingInfo: Optional[MarketingInfoUpdate] = None
    accountInfo: Optional[AccountInfoUpdate] = None
    paymentInfo: Optional[PaymentInfoUpdate] = None

class PaginatedSignups(BaseModel):
    items: List[SignupInDB]
    total: int
    page: int
    limit: int
