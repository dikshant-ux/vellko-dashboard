from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from bson import ObjectId
from datetime import datetime
from enum import Enum

class SignupStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REQUESTED_FOR_APPROVAL = "REQUESTED_FOR_APPROVAL"

class APIConnectionType(str, Enum):
    CAKE = "CAKE"
    RINGBA = "RINGBA"

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
    referral_id: Optional[str] = None

class MarketingInfo(BaseModel):
    paymentModel: str
    primaryCategory: str
    secondaryCategory: Optional[str] = ""
    applicationType: str = "Web Traffic"
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
    imHandle: Optional[str] = Field(default="", min_length=3, max_length=30)
    additionalImChannels: Optional[Dict[str, str]] = Field(default_factory=dict)

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

class SignupNote(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    content: str
    author: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class SignupInDB(SignupCreate):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    status: SignupStatus = SignupStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    cake_affiliate_id: Optional[str] = None
    cake_message: Optional[str] = None
    cake_response: Optional[str] = None
    ringba_affiliate_id: Optional[str] = None
    ringba_message: Optional[str] = None
    ringba_response: Optional[str] = None
    cake_api_status: Optional[str] = None
    cake_decision_reason: Optional[str] = None
    cake_processed_by: Optional[str] = None
    cake_processed_at: Optional[datetime] = None
    
    ringba_api_status: Optional[str] = None
    ringba_decision_reason: Optional[str] = None
    ringba_processed_by: Optional[str] = None
    ringba_processed_at: Optional[datetime] = None
    
    cake_qa_responses: Optional[List[QAResponse]] = None
    ringba_qa_responses: Optional[List[QAResponse]] = None

    decision_reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    documents: List[SignupDocument] = Field(default_factory=list)
    notes: List[SignupNote] = Field(default_factory=list)
    is_updated: bool = False
    updated_at: Optional[datetime] = None
    
    approval_requested_by: Optional[str] = None
    approval_requested_at: Optional[datetime] = None
    requested_cake_approval: Optional[bool] = None
    requested_ringba_approval: Optional[bool] = None
    referrer_manager_id: Optional[str] = None
    
    class Config:
        populate_by_name = True
        json_encoders = {
            # This might not be needed with v2 annotation but kept for safety if v1 logic persists
        }

class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    USER = "USER"

class ApplicationPermission(str, Enum):
    WEB_TRAFFIC = "Web Traffic"
    CALL_TRAFFIC = "Call Traffic"
    BOTH = "Both"

class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: UserRole = UserRole.USER
    disabled: Optional[bool] = False
    application_permission: ApplicationPermission = ApplicationPermission.BOTH
    reset_token: Optional[str] = None
    reset_token_expires_at: Optional[datetime] = None
    two_factor_secret: Optional[str] = None
    is_two_factor_enabled: Optional[bool] = False
    can_approve_signups: Optional[bool] = True
    cake_account_manager_id: Optional[str] = None
    
class QAResponse(BaseModel):
    question_text: str
    answer: str
    required: bool = True

class UserCreate(User):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    application_permission: Optional[ApplicationPermission] = None
    can_approve_signups: Optional[bool] = None
    cake_account_manager_id: Optional[str] = None

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
    applicationType: Optional[str] = None
    comments: Optional[str] = None

class SMTPConfig(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str = Field(default="SMTP Configuration")
    host: str
    port: int
    username: str
    password: str # In production, this should be encrypted
    from_email: str
    reply_to_email: Optional[str] = None
    is_active: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class SMTPConfigCreate(BaseModel):
    name: str
    host: str
    port: int
    username: str
    password: str
    from_email: str
    reply_to_email: Optional[str] = None
    is_active: Optional[bool] = False

class SMTPConfigUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    from_email: Optional[str] = None
    reply_to_email: Optional[str] = None
    is_active: Optional[bool] = None

class AccountInfoUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    title: Optional[str] = None
    workPhone: Optional[str] = None
    cellPhone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    imService: Optional[str] = ""
    imHandle: Optional[str] = ""
    additionalImChannels: Optional[Dict[str, str]] = None

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

# API Connection Models
class CakeDetails(BaseModel):
    api_key: str
    api_url: str = "https://demo-new.cakemarketing.com/api/4/signup.asmx/Affiliate"
    api_v2_url: str = "https://demo-new.cakemarketing.com/api/2/addedit.asmx/Affiliate"
    api_offers_url: str = "https://demo-new.cakemarketing.com/api/7/export.asmx/SiteOffers"
    api_media_types_url: str = "https://demo-new.cakemarketing.com/api/1/signup.asmx/GetMediaTypes"
    api_verticals_url: str = "https://demo-new.cakemarketing.com/api/1/get.asmx/Verticals"

class RingbaDetails(BaseModel):
    api_token: str
    api_url: str = "https://api.ringba.com/v2"
    account_id: str

class APIConnection(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    type: APIConnectionType
    is_active: bool = False
    cake_details: Optional[CakeDetails] = None
    ringba_details: Optional[RingbaDetails] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class APIConnectionCreate(BaseModel):
    name: str
    type: APIConnectionType
    is_active: Optional[bool] = False
    cake_details: Optional[CakeDetails] = None
    ringba_details: Optional[RingbaDetails] = None

class APIConnectionUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    cake_details: Optional[CakeDetails] = None
    ringba_details: Optional[RingbaDetails] = None
class QAFieldType(str, Enum):
    TEXT = "Text"
    DROPDOWN = "Dropdown"
    YES_NO = "Yes/No"

class QAQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    text: str
    field_type: QAFieldType = QAFieldType.TEXT
    required: bool = True
    options: Optional[List[str]] = None # For Dropdown

class QAForm(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    api_type: APIConnectionType # Reusing existing enum for Web/Call
    status: str = "Inactive" # "Active" or "Inactive"
    questions: List[QAQuestion] = Field(default_factory=list)
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class QAFormCreate(BaseModel):
    name: str
    api_type: APIConnectionType
    questions: List[QAQuestion]

class QAFormUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    questions: Optional[List[QAQuestion]] = None
