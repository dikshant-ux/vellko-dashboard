from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile
from typing import List, Optional
from database import db
from models import SignupInDB, SignupStatus, User, UserRole, SignupUpdate, PaginatedSignups
from auth import get_current_user
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime, timedelta
import os
import shutil
from email_utils import send_invitation_email

router = APIRouter(prefix="/admin", tags=["admin"])

async def get_current_admin(username: str = Depends(get_current_user)):
    user_data = await db.users.find_one({"username": username})
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")
    user = User(**user_data)
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Check if they are a manager/user (logic can be expanded later for filtered clean views)
        # For now, let's allow all authenticated users to access dashboard data, 
        # but in real implementation logic should filter based on role.
        # Assuming Dashboard requirement: "User (Referral / Manager) Can view only their referred signups"
        pass
    return user

@router.get("/stats")
async def get_stats(user: User = Depends(get_current_admin)):
    query = {}
    
    # Role based filtering for stats
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        if user.full_name:
             query["companyInfo.referral"] = user.full_name
        else:
             query["companyInfo.referral"] = "NON_EXISTENT_REFERRAL"

    # Basic stats with optional filtering
    total = await db.signups.count_documents(query)
    
    # Helper to count with status and existing query filter
    async def count_status(status):
        status_query = query.copy()
        status_query["status"] = status
        return await db.signups.count_documents(status_query)

    pending = await count_status(SignupStatus.PENDING)
    approved = await count_status(SignupStatus.APPROVED)
    rejected = await count_status(SignupStatus.REJECTED)

    # Chart Data (Last 7 days)
    # Using aggregation to group by date
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}},
        {"$limit": 7}
    ]
    chart_data_cursor = db.signups.aggregate(pipeline)
    chart_data_list = await chart_data_cursor.to_list(length=7)
    
    # Fill in missing days for a nice chart (optional, but good for UI)
    # For simplicity, returning what DB gives. Frontend can handle gaps or we stick to existing points.
    chart_data = [{"date": item["_id"], "count": item["count"]} for item in chart_data_list]

    # Top Referrers
    # Group by companyInfo.referral
    referral_pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": "$companyInfo.referral",
                "count": {"$sum": 1}
            }
        },
        {"$match": {"_id": {"$ne": None, "$ne": ""}}}, # Exclude empty referrals
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    referrers_cursor = db.signups.aggregate(referral_pipeline)
    top_referrers = await referrers_cursor.to_list(length=5)
    formatted_referrers = [{"name": item["_id"], "count": item["count"]} for item in top_referrers]
    
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "chart_data": chart_data,
        "top_referrers": formatted_referrers
    }

@router.get("/signups", response_model=PaginatedSignups)
async def get_signups(
    status: Optional[SignupStatus] = None, 
    referral: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_admin)
):
    query = {}
    if status:
        query["status"] = status
        
    # Role based filtering
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Filter by referral matching user's full_name
        if user.full_name:
             query["companyInfo.referral"] = user.full_name
        else:
             # If no full_name, user shouldn't see anything or handle appropriately
             query["companyInfo.referral"] = "NON_EXISTENT_REFERRAL" 
    elif referral:
        # If admin and referral param is provided
        query["companyInfo.referral"] = referral 

    total_count = await db.signups.count_documents(query)
    
    skip = (page - 1) * limit
    cursor = db.signups.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit
    }

@router.get("/signups/{id}", response_model=SignupInDB)
async def get_signup(id: str, user: User = Depends(get_current_admin)):
    signup = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup:
        raise HTTPException(status_code=404, detail="Signup not found")
    return signup

class SignupDecision(BaseModel):
    reason: Optional[str] = ""

import httpx
import xmltodict
from database import settings

@router.post("/signups/{id}/approve")
async def approve_signup(id: str, decision: SignupDecision = Body(...), user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")

    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Check if user is the referrer
        referral = signup_data.get("companyInfo", {}).get("referral")
        if referral != user.full_name:
             raise HTTPException(status_code=403, detail="Not authorized to approve this signup")

    # Construct CAKE API Parameters
    # Map based on the user's provided mapping
    
    # Helper to get value or empty string
    def val(v): return v if v else ""

    ci = signup_data.get("companyInfo", {})
    mi = signup_data.get("marketingInfo", {})
    ai = signup_data.get("accountInfo", {})
    pi = signup_data.get("paymentInfo", {})

    # Vertical category logic: primary + optional secondary
    vertical_ids = val(mi.get("primaryCategory"))
    if mi.get("secondaryCategory") and mi.get("secondaryCategory") != "0":
        vertical_ids += "," + val(mi.get("secondaryCategory"))

    # timezone logic - user requested "EST"
    
    api_params = {
        "api_key": settings.CAKE_API_KEY,
        "affiliate_id": "0",  # 0 to create
        "affiliate_name": val(ci.get("companyName")),
        "third_party_name": "", 
        "account_status_id": "3",  # Pending
        "inactive_reason_id": "0",
        "affiliate_tier_id": "0",
        "account_manager_id": "0",
        "hide_offers": "TRUE",
        "website": val(ci.get("corporateWebsite")),
        "tax_class": val(pi.get("taxClass")),
        "ssn_tax_id": val(pi.get("ssnTaxId")),
        "vat_tax_required": "FALSE",
        "swift_iban": "",
        "payment_to": val(pi.get("payTo")),
        "payment_fee": "-1",
        "payment_min_threshold": "-1",
        "currency_id": val(pi.get("currency")),
        "payment_setting_id": "0",
        "billing_cycle_id": "0",
        "payment_type_id": "0",
        "payment_type_info": "Standard",
        "address_street": val(ci.get("address")),
        "address_street2": val(ci.get("address2")),
        "address_city": val(ci.get("city")),
        "address_state": val(ci.get("state")),
        "address_zip_code": val(ci.get("zip")),
        "address_country": val(ci.get("country")),
        "contact_first_name": val(ai.get("firstName")),
        "contact_last_name": val(ai.get("lastName")),
        "contact_middle_name": "",
        "contact_email_address": val(ai.get("email")),
        "contact_password": "ChangeMe123!",
        "contact_title": val(ai.get("title")),
        "contact_phone_work": val(ai.get("workPhone")),
        "contact_phone_cell": val(ai.get("cellPhone")),
        "contact_phone_fax": val(ai.get("fax")),
        "contact_im_service": val(ai.get("imService")),
        "contact_im_name": val(ai.get("imHandle")),
        "contact_timezone": "EST",
        "contact_language_id": "1",
        "media_type_ids": "3",
        "price_format_ids": val(mi.get("paymentModel")),
        "vertical_category_ids": vertical_ids,
        "country_codes": val(ci.get("country")),
        "tag_ids": "",
        "pixel_html": "",
        "postback_url": "",
        "postback_delay_ms": "0",
        "fire_global_pixel": "TRUE",
        "online_signup": "TRUE",
        "signup_ip_address": signup_data.get("ipAddress", "0.0.0.0"),
        "referral_affiliate_id": "0",
        "referral_notes": val(ci.get("referral")),
        "date_added": datetime.now().strftime("%m/%d/%Y"),
        "terms_and_conditions_agreed": "TRUE",
        "notes": val(mi.get("comments"))
    }

    cake_affiliate_id = None
    cake_message = "No message from Cake"
    cake_raw_response = None
    success = False

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(settings.CAKE_API_URL, params=api_params, timeout=30.0)
            cake_raw_response = response.text
            if response.status_code == 200:
                # Parse XML
                xml_data = xmltodict.parse(response.text)
                # response format: <affiliate_signup_response><success>true</success>...
                result = xml_data.get('affiliate_signup_response', {})
                success = str(result.get('success', 'false')).lower() == 'true'
                cake_message = result.get('message', 'No message')
                cake_affiliate_id = result.get('affiliate_id')
            else:
                cake_message = f"CAKE API Error: {response.status_code}"
    except Exception as e:
        cake_message = f"CAKE Connection Error: {str(e)}"

    if not success:
         # If Cake fails, we still let the admin know, but maybe we don't finish approval if we want strictly synchronized?
         # User said "hit the cake api and show the response". 
         # I'll update the record with the attempt results.
         pass

    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "status": SignupStatus.APPROVED if success else SignupStatus.PENDING,
                "cake_affiliate_id": cake_affiliate_id,
                "cake_message": cake_message,
                "cake_response": cake_raw_response,
                "decision_reason": decision.reason,
                "processed_by": user.username,
                "processed_at": datetime.utcnow()
            }
        }
    )
    
    if not success:
         raise HTTPException(status_code=400, detail=f"CAKE API Error: {cake_message}")

    return {"message": cake_message, "cake_id": cake_affiliate_id}

@router.post("/signups/{id}/reject")
async def reject_signup(id: str, decision: SignupDecision = Body(...), user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")

    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Check if user is the referrer
        referral = signup_data.get("companyInfo", {}).get("referral")
        if referral != user.full_name:
             raise HTTPException(status_code=403, detail="Not authorized to reject this signup")

    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "status": SignupStatus.REJECTED,
                "decision_reason": decision.reason,
                "processed_by": user.username,
                "processed_at": datetime.utcnow()
            }
        }
    )
    return {"message": "Rejected"}

@router.patch("/signups/{id}/referral")
async def update_referral(id: str, referral: str = Body(..., embed=True), user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update referrals")

    result = await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"companyInfo.referral": referral}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Signup not found")
        
    return {"message": "Referral updated successfully"}

@router.patch("/signups/{id}")
async def update_signup(id: str, update_data: SignupUpdate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update signup details")

    update_doc = {}
    
    # Flatten nested updates for MongoDB $set using dot notation
    if update_data.companyInfo:
        for k, v in update_data.companyInfo.model_dump(exclude_unset=True).items():
            update_doc[f"companyInfo.{k}"] = v
            
    if update_data.marketingInfo:
        for k, v in update_data.marketingInfo.model_dump(exclude_unset=True).items():
            update_doc[f"marketingInfo.{k}"] = v
            
    if update_data.accountInfo:
        for k, v in update_data.accountInfo.model_dump(exclude_unset=True).items():
            update_doc[f"accountInfo.{k}"] = v
            
    if update_data.paymentInfo:
        for k, v in update_data.paymentInfo.model_dump(exclude_unset=True).items():
            update_doc[f"paymentInfo.{k}"] = v

    if not update_doc:
        return {"message": "No changes provided"}

    update_doc["is_updated"] = True
    update_doc["updated_at"] = datetime.utcnow()

    result = await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Signup not found")
        
    return {"message": "Signup updated successfully"}

@router.post("/signups/{id}/reset")
async def reset_signup(id: str, user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")

    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        referral = signup_data.get("companyInfo", {}).get("referral")
        if referral != user.full_name:
             raise HTTPException(status_code=403, detail="Not authorized to reset this signup")

    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "status": SignupStatus.PENDING,
                "decision_reason": None,
                "processed_by": None,
                "processed_at": None,
                "cake_affiliate_id": None
            }
        }
    )
    return {"message": "Signup reset to Pending"}

@router.post("/signups/{id}/documents")
async def upload_document(id: str, file: UploadFile = File(...), user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")

    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        referral = signup_data.get("companyInfo", {}).get("referral")
        if referral != user.full_name:
             raise HTTPException(status_code=403, detail="Not authorized to upload documents for this signup")

    # Ensure uploads directory exists
    upload_dir = f"uploads/{id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = f"{upload_dir}/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    document = {
        "filename": file.filename,
        "path": f"/uploads/{id}/{file.filename}",
        "uploaded_by": user.username,
        "uploaded_at": datetime.utcnow()
    }
    
    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$push": {"documents": document}}
    )
    
    return document

@router.delete("/signups/{id}/documents/{filename}")
async def delete_document(id: str, filename: str, user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")

    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
        
    # Check if file exists in documents list
    documents = signup_data.get("documents", [])
    doc_exists = any(d.get("filename") == filename for d in documents)
    
    if not doc_exists:
        raise HTTPException(status_code=404, detail="Document not found in record")

    # Delete from disk
    file_path = f"uploads/{id}/{filename}"
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception as e:
        # Log error but proceed to remove from DB? Or fail? 
        # Better to fail so db reflects reality, but if file is already gone we should allow cleanup.
        print(f"Error removing file {file_path}: {e}")
        pass

    # Remove from DB
    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$pull": {"documents": {"filename": filename}}}
    )

    return {"message": "Document deleted"}

# User Management Endpoints
from models import UserCreate, UserInDB
from auth import get_password_hash

@router.get("/users", response_model=List[User])
async def get_users(user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    cursor = db.users.find({}, {"hashed_password": 0}) # Try to exclude hashed_password if possible, though pydantic filters it out
    users = await cursor.to_list(length=100)
    return users

@router.post("/users", response_model=User)
async def create_user(user_in: UserCreate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can create users")
        
    existing_user = await db.users.find_one({"username": user_in.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    user_dict = user_in.dict()
    password = user_dict.pop("password")
    hashed_password = get_password_hash(password)
    
    user_db = UserInDB(**user_dict, hashed_password=hashed_password)
    await db.users.insert_one(user_db.dict())
    
    # Send invitation email
    if user_in.email:
         # Use background task? For now direct call is fine as per earlier pattern
         send_invitation_email(
             to_email=user_in.email,
             username=user_in.username,
             password=password, # Use the raw password here
             name=user_in.full_name or user_in.username,
             role=user_in.role
         )

    return user_db

@router.delete("/users/{username}")
async def delete_user(username: str, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can delete users")
        
    # Prevent deleting self
    if username == user.username:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Prevent deleting SUPER_ADMIN
    target_user = await db.users.find_one({"username": username})
    if target_user and target_user.get("role") == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete Super Admin")
        
    result = await db.users.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": "User deleted"}

class UserStatusUpdate(BaseModel):
    disabled: bool

@router.patch("/users/{username}/status")
async def update_user_status(username: str, status_update: UserStatusUpdate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update user status")
        
    # Prevent deactivating self
    if username == user.username:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    # Prevent deactivating SUPER_ADMIN
    target_user = await db.users.find_one({"username": username})
    if target_user and target_user.get("role") == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot deactivate Super Admin")
        
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"disabled": status_update.disabled}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": f"User {'deactivated' if status_update.disabled else 'activated'} successfully"}

from models import UserRoleUpdate

@router.patch("/users/{username}/role")
async def update_user_role(username: str, role_update: UserRoleUpdate, user: User = Depends(get_current_admin)):
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admins can update roles")
        
    # Prevent changing self role (to avoid locking oneself out if demoting to USER)
    if username == user.username:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # Prevent changing SUPER_ADMIN role (other super admins)
    target_user = await db.users.find_one({"username": username})
    if target_user and target_user.get("role") == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot change role of another Super Admin")
        
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"role": role_update.role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": f"User role updated to {role_update.role}"}
