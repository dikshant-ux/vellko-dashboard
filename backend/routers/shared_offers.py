from fastapi import APIRouter, HTTPException, Depends, Body, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uuid
from datetime import datetime, timedelta, timezone
from database import db, settings, get_active_cake_connection
import secrets
from email_utils import send_otp_email
from jose import jwt
import httpx
import xmltodict
import auth
from routers import public
import math

router = APIRouter(
    prefix="/offers/share",
    tags=["shared_offers"]
)

SHARING_EXPIRATION_HOURS = 24
OTP_EXPIRATION_MINUTES = 10
JWT_SECRET = settings.SECRET_KEY
JWT_ALGORITHM = settings.ALGORITHM

class ShareRequest(BaseModel):
    filters: Dict[str, Any]
    duration_hours: int = 24
    allowed_emails: List[str] = []
    visible_columns: List[str] = [] # List of column IDs
    name: Optional[str] = None # Optional name for the link

class ShareResponse(BaseModel):
    token: str
    link: str
    expires_at: datetime

class SharedLinkItem(BaseModel):
    token: str
    name: Optional[str]
    created_at: datetime
    expires_at: datetime
    active: bool
    views: int = 0

class SharedLinkConfig(BaseModel):
    token: str
    name: Optional[str]
    filters: Dict[str, Any]
    duration_hours: int
    allowed_emails: List[str]
    visible_columns: List[str]
    created_at: datetime
    expires_at: datetime
    active: bool
    views: int

class OTPRequest(BaseModel):
    email: str

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

class OTPVerifyResponse(BaseModel):
    access_token: str

@router.post("", response_model=ShareResponse)
async def create_share_link(request: ShareRequest, current_user: dict = Depends(auth.get_current_active_user)): 
    # User is now authenticated via auth.get_current_active_user
    
    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=request.duration_hours)
    
    share_doc = {
        "token": token,
        "name": request.name or f"Shared Offers {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "filters": request.filters,
        "duration_hours": request.duration_hours,
        "allowed_emails": [e.lower() for e in request.allowed_emails if e],
        "visible_columns": request.visible_columns,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "active": True,
        "views": 0,
        "created_by": current_user.username if hasattr(current_user, 'username') else "admin" 
    }
    
    await db.shared_offers.insert_one(share_doc)
    
    link = f"{settings.FRONTEND_URL}/share/{token}"
    
    return {
        "token": token,
        "link": link,
        "expires_at": expires_at
    }

@router.get("/list", response_model=List[SharedLinkItem])
async def list_shared_links():
    # In a real app, filter by current_user. For MVP/This task, return all.
    cursor = db.shared_offers.find({}).sort("created_at", -1)
    links = []
    async for doc in cursor:
        links.append({
            "token": doc["token"],
            "name": doc.get("name"),
            "created_at": doc["created_at"],
            "expires_at": doc["expires_at"],
            "active": doc.get("active", True),
            "views": doc.get("views", 0)
        })
    return links

@router.delete("/{token}")
async def delete_share_link(token: str):
    result = await db.shared_offers.delete_one({"token": token})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"message": "Link deleted"}

@router.get("/{token}/config", response_model=SharedLinkConfig)
async def get_shared_link_config(token: str):
    doc = await db.shared_offers.find_one({"token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {
        "token": doc["token"],
        "name": doc.get("name"),
        "filters": doc.get("filters", {}),
        "duration_hours": doc.get("duration_hours", 24),
        "allowed_emails": doc.get("allowed_emails", []),
        "visible_columns": doc.get("visible_columns", []),
        "created_at": doc["created_at"],
        "expires_at": doc["expires_at"],
        "active": doc.get("active", True),
        "views": doc.get("views", 0)
    }

@router.patch("/{token}")
async def update_shared_link(token: str, request: ShareRequest):
    expires_at = datetime.now(timezone.utc) + timedelta(hours=request.duration_hours)
    
    update_data = {
        "name": request.name or f"Shared Offers {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "filters": request.filters,
        "duration_hours": request.duration_hours,
        "allowed_emails": [e.lower() for e in request.allowed_emails if e],
        "visible_columns": request.visible_columns,
        "expires_at": expires_at,
        "active": True # Re-activate if it was expired? Or keep as is? User probably wants to extend it.
    }
    
    result = await db.shared_offers.update_one(
        {"token": token},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
        
    return {"message": "Link updated successfully", "expires_at": expires_at}

@router.get("/{token}/check")
async def check_share_link(token: str):
    doc = await db.shared_offers.find_one({"token": token, "active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    
    if doc["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await db.shared_offers.update_one({"token": token}, {"$set": {"active": False}})
        raise HTTPException(status_code=410, detail="Link expired")
        
    return {"valid": True}

@router.post("/{token}/otp/request")
async def request_otp(token: str, request: OTPRequest):
    # Check link validity first
    doc = await db.shared_offers.find_one({"token": token, "active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Link not found")
        
    if doc["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Link expired")

    email = request.email.lower().strip()
    
    # Check allowed emails if configured
    allowed_emails = doc.get("allowed_emails", [])
    if allowed_emails and email not in allowed_emails:
        # Security: maybe verify anyway to prevent email enumeration? 
        # For this internal tool, explicit error is probably better for UX.
        raise HTTPException(status_code=403, detail="Email not authorized for this link")

    # Generate OTP
    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    print(f"DEBUG OTP for {email}: {otp}") # Debug log
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)
    
    # Update DB with OTP
    await db.shared_offers.update_one(
        {"token": token},
        {"$set": {
            "otp": otp,
            "otp_email": email,
            "otp_expires_at": otp_expires
        }}
    )
    
    # Send Email
    sent = await send_otp_email(email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send email")
        
    return {"message": "OTP sent"}

@router.post("/{token}/otp/verify", response_model=OTPVerifyResponse)
async def verify_otp(token: str, request: OTPVerifyRequest):
    doc = await db.shared_offers.find_one({"token": token, "active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Link not found")
        
    if doc.get("otp") != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if doc.get("otp_email") != request.email.lower().strip():
        raise HTTPException(status_code=400, detail="Email mismatch")
        
    if doc.get("otp_expires_at").replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
         raise HTTPException(status_code=400, detail="OTP expired")
         
    # Generate Access Token (JWT)
    payload = {
        "sub": token,
        "email": request.email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1) 
    }
    
    access_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {"access_token": access_token}

@router.get("/{token}/data")
async def get_shared_data(
    token: str, 
    access_token: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=500, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term")
):
    # Verify JWT
    try:
        payload = jwt.decode(access_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload["sub"] != token:
            raise HTTPException(status_code=403, detail="Invalid token scope")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")
        
    # Get filters and settings
    doc = await db.shared_offers.find_one({"token": token})
    filters = doc.get("filters", {})
    visible_columns = doc.get("visible_columns", [])
    
    # Increment view count
    await db.shared_offers.update_one({"token": token}, {"$inc": {"views": 1}})
    
    # Fetch Data from Cake
    start_at_row = (page - 1) * limit
    
    # Map filters to Cake params
    # If user provides search, use it. Otherwise use stored filter.
    # Note: If stored filter exists and user searches something else, we technically lose the stored context 
    # because API only supports one name field. For this use case, user search takes precedence.
    api_search = search if search is not None else filters.get("search", "")
    
    vertical_id = filters.get("vertical_id", 0)
    # Support both singular and plural media type filters
    media_type_ids = filters.get("media_type_ids", [])
    if not media_type_ids and filters.get("media_type_id"):
        media_type_ids = [filters.get("media_type_id")]
    
    # Support both singular and plural status filters
    site_offer_status_ids = filters.get("site_offer_status_ids", [])
    if not site_offer_status_ids and filters.get("site_offer_status_id"):
        site_offer_status_ids = [filters.get("site_offer_status_id")]

    # API optimization: if exactly one is selected, use API filter
    cake_media_type_id = media_type_ids[0] if len(media_type_ids) == 1 else 0
    cake_status_id = site_offer_status_ids[0] if len(site_offer_status_ids) == 1 else 0

    cake_conn = await get_active_cake_connection()
    api_key = cake_conn["api_key"]
    url = cake_conn["api_offers_url"]
    
    params = {
        "api_key": api_key,
        "site_offer_id": 0,
        "site_offer_name": api_search,
        "brand_advertiser_id": 0,
        "vertical_id": vertical_id,
        "site_offer_type_id": 0,
        "media_type_id": cake_media_type_id,
        "tag_id": 0,
        "start_at_row": start_at_row,
        "row_limit": limit,
        "site_offer_status_id": cake_status_id,
        "sort_field": "offer_id",
        "sort_descending": "FALSE"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=30.0)
            
            if response.status_code != 200:
                print(f"DEBUG: API Error Status: {response.status_code}")
            
            response.raise_for_status()
            
            # Parse XML
            data_dict = xmltodict.parse(response.text)
            site_offers_response = data_dict.get('offer_export_response', {})
            
            if site_offers_response.get('success') == 'false':
                 return {
                     "success": False, 
                     "offers": [], 
                     "row_count": 0,
                     "page": page,
                     "limit": limit,
                     "total_pages": 0
                 }
            
            row_count = int(site_offers_response.get('row_count', 0))
            site_offers_data = site_offers_response.get('site_offers', {})
            
            if not site_offers_data:
                return {
                    "success": True, 
                    "offers": [], 
                    "row_count": 0,
                    "page": page,
                    "limit": limit,
                    "total_pages": 0
                }
                
            raw_offers = site_offers_data.get('site_offer', [])
            if isinstance(raw_offers, dict):
                raw_offers = [raw_offers]
            elif raw_offers is None:
                raw_offers = []
                
            processed_offers = []
            for offer in raw_offers:
                 def get_text(item):
                    if isinstance(item, dict):
                        return item.get('#text', '')
                    return item

                 # Python-side filtering if multiple IDs were selected
                 offer_media_type_id_raw = offer.get('media_type', {}).get('media_type_id', 0)
                 offer_media_type_id = int(get_text(offer_media_type_id_raw)) if offer_media_type_id_raw else 0
                 
                 if len(media_type_ids) > 1 and offer_media_type_id not in media_type_ids:
                     continue

                 offer_status_info = offer.get('site_offer_status', {})
                 offer_status_id_raw = offer_status_info.get('site_offer_status_id', 0)
                 offer_status_id = int(get_text(offer_status_id_raw)) if offer_status_id_raw else 0
                 
                 if len(site_offer_status_ids) > 1 and offer_status_id not in site_offer_status_ids:
                     continue

                 full_offer = {
                    "site_offer_id": get_text(offer.get('site_offer_id')),
                    "site_offer_name": get_text(offer.get('site_offer_name')),
                    "brand_advertiser_id": get_text(offer.get('brand_advertiser', {}).get('brand_advertiser_id', 0)) if offer.get('brand_advertiser') else 0,
                    "brand_advertiser_name": offer.get('brand_advertiser', {}).get('brand_advertiser_name', {}).get('#text', '') if offer.get('brand_advertiser') else '',
                    "vertical_name": get_text(offer.get('vertical', {}).get('vertical_name', {}).get('#text', '')) if offer.get('vertical') else '',
                    "status": get_text(offer.get('site_offer_status', {}).get('site_offer_status_name', {}).get('#text', '')) if offer.get('site_offer_status') else '',
                    "hidden": offer.get('hidden') == 'true',
                    "preview_link": get_text(offer.get('preview_link')),
                    "payout": "N/A", 
                    "type": "N/A"
                 }
                 
                 default_contract_id = offer.get('default_site_offer_contract_id')
                 contracts = offer.get('site_offer_contracts', {}).get('site_offer_contract_info', [])
                 if isinstance(contracts, dict):
                     contracts = [contracts]
                     
                 selected_contract = None
                 if contracts:
                     for c in contracts:
                         if c.get('site_offer_contract_id') == default_contract_id:
                             selected_contract = c
                             break
                     if not selected_contract and len(contracts) > 0:
                         selected_contract = contracts[0]
                         
                 if selected_contract:
                     price_format = selected_contract.get('price_format', {}).get('price_format_name', {}).get('#text', '')
                     full_offer['type'] = price_format
                     payout_info = selected_contract.get('current_payout', {})
                     full_offer['payout'] = payout_info.get('formatted_amount', 'N/A')
                 
                 processed_offers.append(full_offer)
            
            total_pages = math.ceil(row_count / limit) if limit > 0 else 0

            return {
                "success": True,
                "offers": processed_offers, 
                "row_count": row_count,
                "filters_applied": filters,
                "visible_columns": visible_columns,
                "link_name": doc.get("name"),
                "page": page,
                "limit": limit,
                "total_pages": total_pages
            }
            
        except Exception as e:
            print(f"Error fetching shared offers: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch offers")
