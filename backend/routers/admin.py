from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile
from typing import List, Optional
import smtplib
import asyncio
import secrets
from database import db, get_active_cake_connection, get_active_ringba_connection
from models import SignupInDB, SignupStatus, User, UserRole, SignupUpdate, PaginatedSignups, ApplicationPermission, QAResponse
from auth import get_current_user
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime, timedelta
import os
import shutil
from email_utils import send_invitation_email, send_referral_assignment_email, send_cake_credentials_email

router = APIRouter(prefix="/admin", tags=["admin"])

async def get_current_admin(current_user: User = Depends(get_current_user)):
    # current_user is already a validated, non-disabled User object from get_current_user.
    # The role check below may allow USER roles for dashboard data access (see comment below).
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Allow all authenticated users to access dashboard data (filtered by role inside routes).
        pass
    return current_user

@router.get("/stats")
async def get_stats(user: User = Depends(get_current_admin)):
    query = {}
    
    # Role based filtering for stats
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Filter by referral_id if available (more robust), falling back to name for old data
        if hasattr(user, '_id') and user._id:
             query["$or"] = [
                 {"companyInfo.referral_id": str(user._id)},
                 # Fallback for old data without ID
                 {"companyInfo.referral": user.full_name}
             ]
        elif user.full_name:
             query["companyInfo.referral"] = user.full_name
        else:
             query["companyInfo.referral"] = "NON_EXISTENT_REFERRAL"
    
    
    # Application permission filtering
    # Super admin sees everything, no filtering needed
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        if user.application_permission == ApplicationPermission.WEB_TRAFFIC:
            # Show Web Traffic signups and Both signups
            query["marketingInfo.applicationType"] = {"$in": ["Web Traffic", "Both"]}
        elif user.application_permission == ApplicationPermission.CALL_TRAFFIC:
            # Show Call Traffic signups and Both signups
            query["marketingInfo.applicationType"] = {"$in": ["Call Traffic", "Both"]}
        # If user permission is BOTH, show all signups (no additional filtering needed)


    # Basic stats with optional filtering
    total = await db.signups.count_documents(query)
    
    # Helper to count with status and existing query filter
    async def count_status(status_list):
        status_query = query.copy()
        status_query["status"] = {"$in": status_list}
        return await db.signups.count_documents(status_query)

    # Pending should include both PENDING and REQUESTED_FOR_APPROVAL
    pending = await count_status([
        SignupStatus.PENDING,
        SignupStatus.REQUESTED_FOR_APPROVAL
    ])

    approved = await count_status([SignupStatus.APPROVED])
    rejected = await count_status([SignupStatus.REJECTED])

    # Remove Chart Data as requested for cleaner UI/Dashboard
    # (Removed pipeline and chart_data_cursor logic)

    # --- Application Specific Stats (Granular) ---
    async def get_granular_stats(api_status_field: str, app_type: str):
        # Base filter for this application type (Specific Type OR Both)
        base_query = query.copy()
        base_query["$or"] = [
            {"marketingInfo.applicationType": app_type},
            {"marketingInfo.applicationType": "Both"}
        ]
        
        # Approved Count
        # Logic: Explicitly "APPROVED" OR (Implicitly "APPROVED" for Single-Type apps via Global Status)
        approved_query = {
            "$and": [
                base_query,
                {
                    "$or": [
                        {api_status_field: "APPROVED"},
                        {
                            "marketingInfo.applicationType": app_type,
                            "status": SignupStatus.APPROVED,
                            api_status_field: None
                        }
                    ]
                }
            ]
        }
        approved_count = await db.signups.count_documents(approved_query)

        # Rejected Count
        rejected_query = {
            "$and": [
                base_query,
                {
                    "$or": [
                        {api_status_field: "REJECTED"},
                        {
                            "marketingInfo.applicationType": app_type,
                            "status": SignupStatus.REJECTED,
                            api_status_field: None
                        }
                    ]
                }
            ]
        }
        rejected_count = await db.signups.count_documents(rejected_query)

        # Pending Count
        # Logic: Explicitly None (and not global rejected/approved if single type?? No, if single type and global pending, api status is likely None)
        # For "Both": If api_status is None, it is Pending.
        # For Single: If Global PENDING, it is Pending.
        pending_query = {
             "$and": [
                base_query,
                {
                    "$or": [
                        # Explicitly FAILED means Pending/Needs Action
                        {api_status_field: "FAILED"},
                        # For Both: Explicitly None means Pending
                        {"marketingInfo.applicationType": "Both", api_status_field: None},
                        # For Single: Global Pending
                        {"marketingInfo.applicationType": app_type, "status": SignupStatus.PENDING},
                        # For Single: Global Requested
                        {"marketingInfo.applicationType": app_type, "status": SignupStatus.REQUESTED_FOR_APPROVAL}
                    ]
                }
            ]
        }
        pending_count = await db.signups.count_documents(pending_query)
        
        total_relevant = await db.signups.count_documents(base_query)

        return {
            "total": total_relevant,
            "approved": approved_count,
            "rejected": rejected_count,
            "pending": pending_count
        }

    cake_stats = await get_granular_stats("cake_api_status", "Web Traffic")
    ringba_stats = await get_granular_stats("ringba_api_status", "Call Traffic")


    # --- Referrer Stats Aggregation Helper ---
    async def get_top_referrers(match_filter: dict):
        pipeline = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": "$companyInfo.referral_id",
                    "name": {"$first": "$companyInfo.referral"}, # Fallback name
                    "count": {"$sum": 1}
                }
            },
            {"$match": {"_id": {"$ne": None}, "_id": {"$ne": ""}}}, # Exclude empty referrers
            {
                "$addFields": {
                    "convertedId": {
                        "$cond": {
                            "if": {"$and": [{"$ne": ["$_id", None]}, {"$ne": ["$_id", ""]}]},
                            "then": {"$toObjectId": "$_id"},
                            "else": None
                        }
                    }
                }
            },
            {"$lookup": {
                "from": "users",
                "localField": "convertedId",
                "foreignField": "_id",
                "as": "user_info"
            }},
            {
                "$project": {
                    "name": {
                        "$cond": {
                            "if": {"$gt": [{"$size": "$user_info"}, 0]},
                            "then": {"$arrayElemAt": ["$user_info.full_name", 0]},
                            "else": "$name"
                        }
                    },
                    "count": 1
                }
            },
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        cursor = db.signups.aggregate(pipeline)
        results = await cursor.to_list(length=5)
        return [{"name": item.get("name") or "Unknown", "count": item["count"]} for item in results]

    # Global Top Referrers
    formatted_referrers = await get_top_referrers(query)
    
    # Platform Specific Top Referrers (All applications for that platform)
    cake_referrer_query = query.copy()
    cake_referrer_query["marketingInfo.applicationType"] = {"$in": ["Web Traffic", "Both"]}
    top_cake_referrers = await get_top_referrers(cake_referrer_query)

    ringba_referrer_query = query.copy()
    ringba_referrer_query["marketingInfo.applicationType"] = {"$in": ["Call Traffic", "Both"]}
    top_ringba_referrers = await get_top_referrers(ringba_referrer_query)

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "cake_stats": cake_stats,
        "ringba_stats": ringba_stats,
        "top_referrers": formatted_referrers,
        "top_cake_referrers": top_cake_referrers,
        "top_ringba_referrers": top_ringba_referrers
    }

@router.get("/signups", response_model=PaginatedSignups)
async def get_signups(
    status: Optional[SignupStatus] = None, 
    referral: Optional[str] = None,
    referral_id: Optional[str] = None,
    application_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_admin)
):
    query = {}
    
    # Role based filtering
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Filter by referral_id if available, fallback to name
        if hasattr(user, '_id') and user._id:
             query["$or"] = [
                 {"companyInfo.referral_id": str(user._id)},
                 {"companyInfo.referral": user.full_name}
             ]
        elif user.full_name:
             query["companyInfo.referral"] = user.full_name
        else:
             query["companyInfo.referral"] = "NON_EXISTENT_REFERRAL" 
    else:
        # Admin filtering
        if referral_id:
            query["companyInfo.referral_id"] = referral_id
        elif referral:
            query["companyInfo.referral"] = referral
    
    # Application permission filtering
    # 1. Determine User's Max Permission Set
    user_allowed_types = ["Web Traffic", "Call Traffic", "Both"] # Default All
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        if user.application_permission == ApplicationPermission.WEB_TRAFFIC:
             user_allowed_types = ["Web Traffic", "Both"]
        elif user.application_permission == ApplicationPermission.CALL_TRAFFIC:
             user_allowed_types = ["Call Traffic", "Both"]
        # If Both, allowed all.
    
    # 2. Determine Requested Filter
    final_types_filter = user_allowed_types
    if application_type:
        if application_type == "Web Traffic":
             if "Web Traffic" in user_allowed_types:
                  final_types_filter = ["Web Traffic", "Both"]
             else:
                  final_types_filter = []
        elif application_type == "Call Traffic":
             if "Call Traffic" in user_allowed_types:
                  final_types_filter = ["Call Traffic", "Both"]
             else:
                  final_types_filter = []
    
    # 3. Apply Filters to Query
    if final_types_filter:
        query["marketingInfo.applicationType"] = {"$in": final_types_filter}
    else:
        query["marketingInfo.applicationType"] = {"$in": []}

    if status:
        if application_type == "Web Traffic":
            if status == SignupStatus.PENDING:
                query["cake_api_status"] = {"$in": [None, "FAILED"]}
                query["status"] = {"$ne": SignupStatus.REJECTED}
            elif status == SignupStatus.APPROVED:
                query["cake_api_status"] = "APPROVED"
                query["status"] = {"$ne": SignupStatus.REJECTED}
            elif status == SignupStatus.REJECTED:
                query["$or"] = [{"cake_api_status": "REJECTED"}, {"status": SignupStatus.REJECTED}]
            elif status == SignupStatus.REQUESTED_FOR_APPROVAL:
                query["requested_cake_approval"] = True
                query["status"] = {"$ne": SignupStatus.REJECTED}
            else:
                query["status"] = status
        elif application_type == "Call Traffic":
            if status == SignupStatus.PENDING:
                query["ringba_api_status"] = {"$in": [None, "FAILED"]}
                query["status"] = {"$ne": SignupStatus.REJECTED}
            elif status == SignupStatus.APPROVED:
                query["ringba_api_status"] = "APPROVED"
                query["status"] = {"$ne": SignupStatus.REJECTED}
            elif status == SignupStatus.REJECTED:
                query["$or"] = [{"ringba_api_status": "REJECTED"}, {"status": SignupStatus.REJECTED}]
            elif status == SignupStatus.REQUESTED_FOR_APPROVAL:
                query["requested_ringba_approval"] = True
                query["status"] = {"$ne": SignupStatus.REJECTED}
            else:
                query["status"] = status
        else:
            # Default behavior (Both or All)
            query["status"] = status

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
    
    # Enrich with referrer's manager ID
    referrer_id = signup.get("companyInfo", {}).get("referral_id")
    if referrer_id:
        try:
            referrer_user = await db.users.find_one({"_id": ObjectId(referrer_id)})
            if referrer_user:
                signup["referrer_manager_id"] = referrer_user.get("cake_account_manager_id")
        except:
            # Fallback for old style data or invalid IDs
            pass
            
    return signup

class SignupDecision(BaseModel):
    reason: Optional[str] = ""
    addToCake: bool = False
    addToRingba: bool = False
    ringba_sub_id: Optional[str] = None
    cake_qa_responses: Optional[List[QAResponse]] = None
    ringba_qa_responses: Optional[List[QAResponse]] = None

import httpx
import xmltodict

@router.post("/signups/{id}/approve")
async def approve_signup(id: str, decision: SignupDecision = Body(...), user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")

    from models import ApplicationPermission

    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # Check if user is the referrer
        referral = signup_data.get("companyInfo", {}).get("referral")
        if referral != user.full_name:
             raise HTTPException(status_code=403, detail="Not authorized to approve this signup")

    # Strict Application Permission Check
    # Ensure user can only approve signups within their permission scope
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        app_type = signup_data.get("marketingInfo", {}).get("applicationType")
        
        if user.application_permission == ApplicationPermission.WEB_TRAFFIC:
            if app_type == "Call Traffic":
                raise HTTPException(status_code=403, detail="Web Traffic admins cannot approve Call Traffic signups")
        elif user.application_permission == ApplicationPermission.CALL_TRAFFIC:
             if app_type == "Web Traffic":
                raise HTTPException(status_code=403, detail="Call Traffic admins cannot approve Web Traffic signups")
        # Both permission can approve anything (Web, Call, Both)

    # Check for Approval Permission
    # If user lacks permission, force REQUESTED_FOR_APPROVAL
    # Existing Admins default to True, so this mostly affects new restricted users.
    if hasattr(user, 'can_approve_signups') and user.can_approve_signups is False:
        # User cannot directly approve. Create Approval Request.
        await db.signups.update_one(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "status": SignupStatus.REQUESTED_FOR_APPROVAL,
                    "approval_requested_by": user.username,
                    "approval_requested_at": datetime.utcnow(),
                    "requested_cake_approval": decision.addToCake,
                    "requested_ringba_approval": decision.addToRingba,
                    # We can still save their intended decision reason/mapping?
                    "decision_reason": decision.reason,
                    # Logic: Do we save the CAKE/Ringba params they WANTED to use?
                    # For now, just mark status. The final approver might need to re-confirm params.
                    # Or we assume the params sent here are what they want.
                    # Ideally we'd store a "pending_approval_decision" object differently, 
                    # but fitting into existing flow -> just status change is simplest MVP.
                }
            }
        )
        
        # --- Notification Logic for Approval Request ---
        try:
            # 1. Identify Target Audience
            # Always notify Super Admins
            # Notify "Both" Admins
            # Notify Specific Admin based on Signup Type
            
            target_permissions = ["Both"]
            signup_app_type = signup_data.get("marketingInfo", {}).get("applicationType")
            
            if signup_app_type == "Web Traffic":
                target_permissions.append("Web Traffic")
            elif signup_app_type == "Call Traffic":
                target_permissions.append("Call Traffic")
            elif signup_app_type == "Both":
                target_permissions.append("Web Traffic")
                target_permissions.append("Call Traffic")
                
            # 2. Fetch Users
            # Find users who are SUPER_ADMIN OR (ADMIN with matching permission)
            # And exclude the requester themselves
            
            cursor = db.users.find({
                "$and": [
                    {"username": {"$ne": user.username}}, # Exclude self
                    {"$or": [
                        {"role": UserRole.SUPER_ADMIN},
                        {
                            "role": UserRole.ADMIN,
                            "application_permission": {"$in": target_permissions}
                        }
                    ]}
                ]
            })
            
            recipients = await cursor.to_list(length=100)
            recipient_emails = [u["email"] for u in recipients if u.get("email")]
            
            # 3. Send Email
            from email_utils import send_approval_request_email
            await send_approval_request_email(
                to_emails=recipient_emails,
                signup_data=signup_data,
                signup_id=id,
                requester_name=user.full_name or user.username,
                requested_cake=decision.addToCake,
                requested_ringba=decision.addToRingba
            )
            
        except Exception as e:
            print(f"Failed to send approval request notifications: {e}")

        # Notify Admins (Super Admins + Admins with Approval Permission?)
        # For now, simplistic email to a configured admin email or all admins?
        # Requirements say: "Email to Admin and Super Admin"
        # We can implement a background task for this.
        # await notify_admins_of_approval_request(signup_data, user) # TODO: Implement this utility
        
        return {"message": "Approval requested successfully", "status": "REQUESTED_FOR_APPROVAL"}

    # Granular Permission Validation for "Both" applications
    app_type = signup_data.get("marketingInfo", {}).get("applicationType")
    if app_type == "Both":
        if user.application_permission == ApplicationPermission.WEB_TRAFFIC and decision.addToRingba:
             raise HTTPException(status_code=403, detail="Web Traffic users cannot trigger Ringba API")
        if user.application_permission == ApplicationPermission.CALL_TRAFFIC and decision.addToCake:
             raise HTTPException(status_code=403, detail="Call Traffic users cannot trigger Cake API")

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

    cake_response = None
    ringba_response = None

    # timezone logic - user requested "EST"
    
    cake_conn = await get_active_cake_connection()
    ringba_conn = await get_active_ringba_connection()

    api_params = {
        "api_key": cake_conn["api_key"],
        "affiliate_id": "0",  # 0 to create
        "affiliate_name": val(ci.get("companyName")),
        "third_party_name": "", 
        "account_status_id": "1",  # active
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
        # SECURITY FIX: Generate a random secure password instead of hardcoded 'ChangeMe123!'.
        # Captured below so we can email it to the affiliate after successful account creation.
        "contact_password": (_cake_generated_password := secrets.token_urlsafe(12)),
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

    
    # Initialize with existing values to allow partial updates
    # If not requesting an update for a specific API, we preserve the old values.
    cake_affiliate_id = signup_data.get("cake_affiliate_id")
    cake_message = signup_data.get("cake_message")
    cake_raw_response = signup_data.get("cake_response")
    cake_success = False

    ringba_affiliate_id = signup_data.get("ringba_affiliate_id")
    ringba_message = signup_data.get("ringba_message")
    ringba_raw_response = signup_data.get("ringba_response")
    ringba_success = False

    # CAKE Logic
    if decision.addToCake:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(cake_conn["api_url"], params=api_params, timeout=30.0)
                cake_raw_response = response.text
                if response.status_code == 200:
                    # Parse XML
                    xml_data = xmltodict.parse(response.text)
                    # response format: <affiliate_signup_response><success>true</success>...
                    result = xml_data.get('affiliate_signup_response', {})
                    cake_success = str(result.get('success', 'false')).lower() == 'true'
                    cake_message = result.get('message', 'No message')
                    cake_affiliate_id = result.get('affiliate_id')

                    # Handle Duplicates: Extract ID from message and proceed to V2 if possible
                    if not cake_success and "duplicate" in cake_message.lower():
                        import re
                        # Common Cake duplicate message: "Duplicate affiliate. Affiliate ID: 12345"
                        match = re.search(r'Affiliate ID:\s*(\d+)', cake_message)
                        if match:
                            cake_affiliate_id = match.group(1)
                            cake_success = True
                            cake_message = f"Existing Affiliate Found (ID: {cake_affiliate_id}). Proceeding to manager assignment."

                    # --- Cake V2 Assignment (Automated) ---
                    # Logic: Look up referrer by ID or name, fetch their cake manager ID. Default to "0".
                    manager_id_to_assign = "0"
                    
                    ref_id = signup_data.get("companyInfo", {}).get("referral_id")
                    ref_name = signup_data.get("companyInfo", {}).get("referral")
                    
                    ref_user = None
                    if ref_id:
                        try:
                            ref_user = await db.users.find_one({"_id": ObjectId(ref_id)})
                        except:
                            pass
                    
                    if not ref_user and ref_name:
                        ref_user = await db.users.find_one({"full_name": ref_name})
                    
                    if ref_user and ref_user.get("cake_account_manager_id"):
                        manager_id_to_assign = ref_user.get("cake_account_manager_id")
                    
                    if cake_success and cake_affiliate_id and manager_id_to_assign:
                        try:
                            v2_params = {
                                "api_key": cake_conn["api_key"],
                                "affiliate_id": cake_affiliate_id,
                                "affiliate_name": signup_data.get("companyInfo", {}).get("companyName", ""),
                                "third_party_name": "",
                                "account_status_id": 1,
                                "inactive_reason_id": 0,
                                "affiliate_tier_id": 0,
                                "account_manager_id": manager_id_to_assign,
                                "hide_offers": "TRUE",
                                "website": signup_data.get("companyInfo", {}).get("corporateWebsite", ""),
                                "tax_class": signup_data.get("paymentInfo", {}).get("taxClass", ""),
                                "ssn_tax_id": signup_data.get("paymentInfo", {}).get("ssnTaxId", ""),
                                "vat_tax_required": "FALSE",
                                "swift_iban": "",
                                "payment_to": 0,
                                "payment_fee": 0.0,
                                "payment_min_threshold": -1,
                                "currency_id": 0,
                                "payment_setting_id": 0,
                                "billing_cycle_id": 0,
                                "payment_type_id": 0,
                                "payment_type_info": "",
                                "address_street": signup_data.get("companyInfo", {}).get("address", ""),
                                "address_street2": signup_data.get("companyInfo", {}).get("address2", ""),
                                "address_city": signup_data.get("companyInfo", {}).get("city", ""),
                                "address_state": signup_data.get("companyInfo", {}).get("state", ""),
                                "address_zip_code": signup_data.get("companyInfo", {}).get("zip", ""),
                                "address_country": signup_data.get("companyInfo", {}).get("country", ""),
                                "media_type_ids": "",
                                "price_format_ids": "",
                                "vertical_category_ids": "",
                                "country_codes": "",
                                "tags": "",
                                "pixel_html": "",
                                "postback_url": "",
                                "postback_delay_ms": 0,
                                "fire_global_pixel": "FALSE",
                                "date_added": (signup_data.get("created_at") or datetime.utcnow()).strftime("%m/%d/%Y %H:%M:%S"),
                                "online_signup": "TRUE",
                                "signup_ip_address": signup_data.get("ipAddress", "0.0.0.0"),
                                "referral_affiliate_id": 0,
                                "referral_notes": "",
                                "terms_and_conditions_agreed": "TRUE",
                                "notes": decision.reason or ""
                            }
                            v2_url = cake_conn.get("api_v2_url")
                            print(f"DEBUG: Hitting Cake V2 URL: '{v2_url}'")
                            v2_response = await client.get(v2_url, params=v2_params, timeout=20.0)
                            # We log the V2 result but don't necessarily fail the whole thing if V2 fails (as V4 worked)
                            if v2_response.status_code != 200:
                                cake_message += f" (Manager Assignment V2 Failed: {v2_response.status_code})"
                            else:
                                v2_xml = xmltodict.parse(v2_response.text)
                                v2_result = v2_xml.get('affiliate_response', {})
                                v2_success = str(v2_result.get('success', 'false')).lower() == 'true'
                                if v2_success:
                                    cake_message += " (Manager Assigned)"
                                else:
                                    v2_msg = v2_result.get('message', 'Unknown Error')
                                    cake_message += f" (Manager Assignment V2 Error: {v2_msg})"
                        except Exception as v2_err:
                            cake_message += f" (Manager Assignment V2 Exception: {str(v2_err)})"

                else:
                    cake_message = f"CAKE API Error: {response.status_code}"
        except Exception as e:
            cake_message = f"CAKE Connection Error: {str(e)}"

    # If Cake succeeded, send the generated password to the affiliate via email (fire-and-forget)
    if cake_success and ai.get("email"):
        try:
            await send_cake_credentials_email(
                to_email=val(ai.get("email")),
                first_name=val(ai.get("firstName")),
                password=_cake_generated_password
            )
        except Exception as email_err:
            print(f"Warning: Failed to send Cake credentials email: {email_err}")
    
    # Ringba Logic
    if decision.addToRingba:
        try:
            # --- PPC_NX Naming Logic ---
            # Default to PPC_N1 if no previous approved name found
            assigned_name = "PPC_N1"
            
            # Find the latest approved Ringba signup with the PPC_NX pattern
            last_ringba_signup = await db.signups.find_one(
                {"ringba_api_status": "APPROVED", "ringba_assigned_name": {"$regex": "^PPC_N\\d+$"}},
                sort=[("ringba_processed_at", -1)]
            )
            
            if last_ringba_signup and last_ringba_signup.get("ringba_assigned_name"):
                last_name = last_ringba_signup["ringba_assigned_name"]
                import re
                match = re.search(r"PPC_N(\d+)", last_name)
                if match:
                    next_number = int(match.group(1)) + 1
                    assigned_name = f"PPC_N{next_number}"

            ringba_payload = {
                "name": assigned_name,
                "subId": str(decision.ringba_sub_id or id),
                "createNumbers": True,
                "doNotCreateUser": True,
                "blockCallsIfCapped": False,
                "accessToRecordings": True
            }
            
            headers = {
                "Authorization": f"Token {ringba_conn['api_token']}",
                "Content-Type": "application/json"
            }
            
            ringba_url = f"{ringba_conn['api_url']}/{ringba_conn['account_id']}/Publishers"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(ringba_url, json=ringba_payload, headers=headers, timeout=30.0)
                ringba_raw_response = response.text
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    ringba_success = True
                    # Correctly map ringba affiliate id from publishers object
                    # User provided sample: {"transactionId": "...", "publishers": {"id": "123", ...}}
                    ringba_affiliate_id = result.get("publishers", {}).get("id")
                    
                    if not ringba_affiliate_id:
                        # Fallback if structure is different or top level
                        ringba_affiliate_id = result.get("id")
                        
                    ringba_message = f"Ringba Publisher '{assigned_name}' Created Successfully"
                    
                    # Store assigned name for next increment
                    update_fields["ringba_assigned_name"] = assigned_name
                    update_fields["ringba_sub_id"] = decision.ringba_sub_id

                    # Send Invitation if publisher created successfully
                    if ringba_affiliate_id:
                        try:
                            invite_url = f"{ringba_conn['api_url']}/{ringba_conn['account_id']}/Affiliates/{ringba_affiliate_id}/Invitations"
                            
                            email = signup_data.get('accountInfo', {}).get('email')
                            first_name = signup_data.get('accountInfo', {}).get('firstName', '')
                            last_name = signup_data.get('accountInfo', {}).get('lastName', '')

                            invite_payload = {
                                "email": email,
                                "confirmEmail": email,
                                "firstName": first_name,
                                "lastName": last_name
                            }

                            invite_response = await client.post(invite_url, json=invite_payload, headers=headers, timeout=30.0)
                            
                            if invite_response.status_code in [200, 201]:
                                ringba_message += ". Invitation Sent."
                            else:
                                ringba_message += f". Publisher Created but Invitation Failed: {invite_response.status_code}"
                        except Exception as invite_err:
                            ringba_message += f". Publisher Created but Invitation Error: {str(invite_err)}"
                else:
                    ringba_message = f"Ringba API Error: {response.status_code} - {response.text}"
                    
        except Exception as e:
            ringba_message = f"Ringba Connection Error: {str(e)}"

    # Determine overall status
    # If both requested, both must succeed? Or partial?
    # User requirement: "if both are checked then both api will hit".
    # Let's assume APPROVED if at least one requested API succeeded, or purely informational.
    # Usually we want to know if it failed.
    
    # --- Granular Status Update (Boolean) ---
    update_fields = {}
    if decision.addToCake:
        update_fields["cake_api_status"] = "APPROVED" if cake_success else "FAILED"
    if decision.addToRingba:
        update_fields["ringba_api_status"] = "APPROVED" if ringba_success else "FAILED"

    # --- Robust Global Status Derivation ---
    c_status = update_fields.get("cake_api_status", signup_data.get("cake_api_status"))
    r_status = update_fields.get("ringba_api_status", signup_data.get("ringba_api_status"))

    app_type = signup_data.get("marketingInfo", {}).get("applicationType")

    if app_type == "Both":
        # Both rejected → fully rejected
        if c_status == "REJECTED" and r_status == "REJECTED":
            new_status = SignupStatus.REJECTED
        # Both approved → fully approved
        elif c_status == "APPROVED" and r_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        # One approved, other anything else → partially approved (use APPROVED to unblock)
        elif c_status == "APPROVED" or r_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        # Both failed / pending
        elif c_status == "FAILED" and r_status == "FAILED":
            new_status = SignupStatus.PENDING
        else:
            new_status = SignupStatus.PENDING
    elif app_type == "Web Traffic":
        if c_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        elif c_status == "REJECTED":
            new_status = SignupStatus.REJECTED
        else:
            new_status = SignupStatus.PENDING
    elif app_type == "Call Traffic":
        if r_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        elif r_status == "REJECTED":
            new_status = SignupStatus.REJECTED
        else:
            new_status = SignupStatus.PENDING
    else:
        new_status = SignupStatus.PENDING

    # Determine overall process success for the HTTP response
    overall_success = True
    if decision.addToCake and not cake_success:
        overall_success = False
    if decision.addToRingba and not ringba_success:
        overall_success = False
    
    # If no API was selected, handle as success (manual approve)
    if not decision.addToCake and not decision.addToRingba:
        overall_success = True

    # --- Prepare Database Update ---
    update_data = {
        "status": new_status,
        "cake_message": cake_message,
        "cake_response": cake_raw_response,
        "ringba_message": ringba_message,
        "ringba_response": ringba_raw_response,
        "decision_reason": decision.reason,
        "processed_by": user.username,
        "processed_at": datetime.utcnow(),
        **update_fields
    }
    
    # Per-platform info
    if decision.addToCake:
        update_data["cake_decision_reason"] = decision.reason
        update_data["cake_processed_by"] = user.username
        update_data["cake_processed_at"] = update_data["processed_at"]
    
    if decision.addToRingba:
        update_data["ringba_decision_reason"] = decision.reason
        update_data["ringba_processed_by"] = user.username
        update_data["ringba_processed_at"] = update_data["processed_at"]

    if decision.cake_qa_responses:
        update_data["cake_qa_responses"] = [r.dict() for r in decision.cake_qa_responses]
    if decision.ringba_qa_responses:
        update_data["ringba_qa_responses"] = [r.dict() for r in decision.ringba_qa_responses]

    # Only Save ID if success
    if cake_success:
        update_data["cake_affiliate_id"] = cake_affiliate_id
    if ringba_success:
        update_data["ringba_affiliate_id"] = ringba_affiliate_id

    # Save results
    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    
    if not overall_success:
        detail_msg = []
        if decision.addToCake and not cake_success:
            detail_msg.append(f"Cake Failed: {cake_message}")
        if decision.addToRingba and not ringba_success:
            detail_msg.append(f"Ringba Failed: {ringba_message}")
        # Even if it "failed", we save the partial state.
        # The user sees a 400 but the DB might have partial success (e.g. one API worked).
        raise HTTPException(status_code=400, detail="; ".join(detail_msg))

    params_result = {
        "cake": {"id": cake_affiliate_id, "message": cake_message},
        "ringba": {"id": ringba_affiliate_id, "message": ringba_message}
    }

    return {"message": "Approval Processed", "details": params_result}

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

    # Strict Application Permission Check
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission') and user.application_permission:
        from models import ApplicationPermission
        app_type = signup_data.get("marketingInfo", {}).get("applicationType")
        
        if user.application_permission == ApplicationPermission.WEB_TRAFFIC:
            if app_type == "Call Traffic":
                raise HTTPException(status_code=403, detail="Web Traffic admins cannot reject Call Traffic signups")
        elif user.application_permission == ApplicationPermission.CALL_TRAFFIC:
             if app_type == "Web Traffic":
                raise HTTPException(status_code=403, detail="Call Traffic admins cannot reject Web Traffic signups")

    update_fields = {
        "decision_reason": decision.reason,
        "processed_by": user.username,
        "processed_at": datetime.utcnow()
    }

    # Granular Rejection Logic
    # If specific flags are provided, reject only those.
    # Otherwise (e.g. from global Reject button), reject everything that is currently Pending (None).
    
    cake_status = signup_data.get("cake_api_status")
    ringba_status = signup_data.get("ringba_api_status")
    app_type = signup_data.get("marketingInfo", {}).get("applicationType")

    # Determine what to reject
    if not decision.addToCake and not decision.addToRingba:
        # Global rejection (no specific API selected)
        if cake_status is None or cake_status == "FAILED":
            update_fields["cake_api_status"] = "REJECTED"
            update_fields["cake_decision_reason"] = decision.reason
            update_fields["cake_processed_by"] = user.username
            update_fields["cake_processed_at"] = update_fields["processed_at"]
        if ringba_status is None or ringba_status == "FAILED":
            update_fields["ringba_api_status"] = "REJECTED"
            update_fields["ringba_decision_reason"] = decision.reason
            update_fields["ringba_processed_by"] = user.username
            update_fields["ringba_processed_at"] = update_fields["processed_at"]
    else:
        # Granular rejection (specific API selected)
        if decision.addToCake:
            update_fields["cake_api_status"] = "REJECTED"
            update_fields["cake_decision_reason"] = decision.reason
            update_fields["cake_processed_by"] = user.username
            update_fields["cake_processed_at"] = update_fields["processed_at"]
        if decision.addToRingba:
            update_fields["ringba_api_status"] = "REJECTED"
            update_fields["ringba_decision_reason"] = decision.reason
            update_fields["ringba_processed_by"] = user.username
            update_fields["ringba_processed_at"] = update_fields["processed_at"]

    if decision.cake_qa_responses:
        update_fields["cake_qa_responses"] = [r.dict() for r in decision.cake_qa_responses]
    if decision.ringba_qa_responses:
        update_fields["ringba_qa_responses"] = [r.dict() for r in decision.ringba_qa_responses]

    # --- Robust Global Status Derivation ---
    c_status = update_fields.get("cake_api_status", cake_status)
    r_status = update_fields.get("ringba_api_status", ringba_status)

    if app_type == "Both":
        # Both rejected → fully rejected
        if c_status == "REJECTED" and r_status == "REJECTED":
            new_status = SignupStatus.REJECTED
        # Both approved → fully approved
        elif c_status == "APPROVED" and r_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        # One approved, other rejected → keep APPROVED (partial approval already done)
        elif c_status == "APPROVED" or r_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        else:
            new_status = SignupStatus.PENDING
    elif app_type == "Web Traffic":
        if c_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        elif c_status == "REJECTED":
            new_status = SignupStatus.REJECTED
        else:
            new_status = SignupStatus.PENDING
    elif app_type == "Call Traffic":
        if r_status == "APPROVED":
            new_status = SignupStatus.APPROVED
        elif r_status == "REJECTED":
            new_status = SignupStatus.REJECTED
        else:
            new_status = SignupStatus.PENDING
    else:
        new_status = SignupStatus.PENDING

    update_fields["status"] = new_status

    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_fields}
    )
    return {"message": "Rejected"}

@router.patch("/signups/{id}/referral")
async def update_referral(id: str, referral: str = Body(..., embed=True), user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update referrals")

    # Find the referrer user to get their ID
    referral_id = None
    if referral and referral not in ["Others", "Other", "None", ""]:
        referrer = await db.users.find_one({"full_name": referral})
        if referrer:
            referral_id = str(referrer["_id"])
    
    # Update both referral name and referral_id
    update_fields = {
        "companyInfo.referral": referral,
        "companyInfo.referral_id": referral_id if referral_id else ""
    }
    
    result = await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Signup not found")
        
    # Notify new referrer
    if referral and referral not in ["Others", "Other", "None", ""] and referral_id:
        referrer = await db.users.find_one({"_id": ObjectId(referral_id)})
        if referrer and referrer.get("email"):
             signup_data = await db.signups.find_one({"_id": ObjectId(id)})
             await send_referral_assignment_email(
                 to_email=referrer["email"],
                 signup_data=signup_data,
                 signup_id=id,
                 assigned_by=user.full_name or user.username
             )
        
    return {"message": "Referral updated successfully"}

@router.delete("/signups/{id}")
async def delete_signup(id: str, user: User = Depends(get_current_admin)):
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admins can delete signups")

    result = await db.signups.delete_one({"_id": ObjectId(id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Signup not found")

    return {"message": "Signup deleted successfully"}

@router.patch("/signups/{id}")
async def update_signup(id: str, update_data: SignupUpdate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update signup details")

    # Fetch original data to check for referral change
    original_signup = await db.signups.find_one({"_id": ObjectId(id)})
    if not original_signup:
        raise HTTPException(status_code=404, detail="Signup not found")

    update_doc = {}
    
    # Flatten nested updates for MongoDB $set using dot notation
    if update_data.companyInfo:
        for k, v in update_data.companyInfo.model_dump(exclude_none=True).items():
            update_doc[f"companyInfo.{k}"] = v
            
    if update_data.marketingInfo:
        for k, v in update_data.marketingInfo.model_dump(exclude_none=True).items():
            update_doc[f"marketingInfo.{k}"] = v
            
    if update_data.accountInfo:
        for k, v in update_data.accountInfo.model_dump(exclude_none=True).items():
            update_doc[f"accountInfo.{k}"] = v
            
    if update_data.paymentInfo:
        for k, v in update_data.paymentInfo.model_dump(exclude_none=True).items():
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

    # Check if referral changed and notify
    new_referral = update_doc.get("companyInfo.referral")
    if new_referral and new_referral != original_signup.get("companyInfo", {}).get("referral"):
         if new_referral not in ["Others", "Other", "None", ""]:
            new_referrer = await db.users.find_one({"full_name": new_referral})
            if new_referrer and new_referrer.get("email"):
                 # Fetch latest data or reuse updated info (constructing minimal dict for email)
                 # Better to fetch complete updated doc or just patch the original with updates
                 # For simplicity, let's just refetch or assume we have enough in original + update. 
                 # Actually, update_doc has flat keys which helps, but we need structure. 
                 # Let's just pass `original_signup` patched with `update_doc` implies structure changes.
                 # Easiest: refetch safely.
                 updated_signup = await db.signups.find_one({"_id": ObjectId(id)})
                 
                 await send_referral_assignment_email(
                     to_email=new_referrer["email"],
                     signup_data=updated_signup,
                     signup_id=id,
                     assigned_by=user.full_name or user.username
                 )

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
                "cake_affiliate_id": None,
                "cake_api_status": None,
                "cake_decision_reason": None,
                "cake_processed_by": None,
                "cake_processed_at": None,
                "ringba_affiliate_id": None,
                "ringba_api_status": None,
                "ringba_decision_reason": None,
                "ringba_processed_by": None,
                "ringba_processed_at": None
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

    # Restricted extensions
    ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.webp'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Supported types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

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

    return {"message": "Document deleted"}

from models import SignupNote

@router.post("/signups/{id}/notes")
async def add_signup_note(id: str, note: str = Body(..., embed=True), user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")
        
    # Check permissions (admins only or referrer?)
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        referral = signup_data.get("companyInfo", {}).get("referral")
        if referral != user.full_name:
             raise HTTPException(status_code=403, detail="Not authorized to add notes to this signup")

    new_note = SignupNote(
        content=note,
        author=user.full_name or user.username
    )
    
    await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$push": {"notes": new_note.dict()}}
    )
    
    return new_note

@router.put("/signups/{id}/notes/{note_id}")
async def update_signup_note(id: str, note_id: str, note: str = Body(..., embed=True), user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")
        
    # Determine if note exists and update it
    signup_note = next((n for n in signup_data.get("notes", []) if n.get("id") == note_id), None)
    if not signup_note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Check permissions
    is_author = signup_note.get("author") == (user.full_name or user.username)
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN] and not is_author:
         raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.signups.update_one(
        {"_id": ObjectId(id), "notes.id": note_id},
        {"$set": {"notes.$.content": note, "notes.$.updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Note not found or no changes made")
        
    updated_note = next((n for n in signup_data.get("notes", []) if n.get("id") == note_id), None)
    if updated_note:
        updated_note["content"] = note
        updated_note["updated_at"] = datetime.utcnow()
        
    return {"message": "Note updated", "note": updated_note}

@router.delete("/signups/{id}/notes/{note_id}")
async def delete_signup_note(id: str, note_id: str, user: User = Depends(get_current_admin)):
    signup_data = await db.signups.find_one({"_id": ObjectId(id)})
    if not signup_data:
        raise HTTPException(status_code=404, detail="Signup not found")
        
    signup_note = next((n for n in signup_data.get("notes", []) if n.get("id") == note_id), None)
    if not signup_note:
        raise HTTPException(status_code=404, detail="Note not found")

    is_author = signup_note.get("author") == (user.full_name or user.username)
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN] and not is_author:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    result = await db.signups.update_one(
        {"_id": ObjectId(id)},
        {"$pull": {"notes": {"id": note_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
        
    return {"message": "Note deleted"}
from models import UserCreate, UserInDB
from auth import get_password_hash

@router.get("/users", response_model=List[User])
async def get_users(user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    query = {}
    
    # Permission-based filtering
    # Super admin sees all users, no filtering needed
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        if user.application_permission == ApplicationPermission.WEB_TRAFFIC:
            # Show Web Traffic users and Both users
            query["application_permission"] = {"$in": ["Web Traffic", "Both"]}
        elif user.application_permission == ApplicationPermission.CALL_TRAFFIC:
            # Show Call Traffic users and Both users
            query["application_permission"] = {"$in": ["Call Traffic", "Both"]}
        # If user permission is BOTH, show all users (no additional filtering needed)
    
    cursor = db.users.find(query, {"hashed_password": 0}) # Try to exclude hashed_password if possible, though pydantic filters it out
    users = await cursor.to_list(length=100)
    return users

@router.post("/users", response_model=User)
async def create_user(user_in: UserCreate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    # Permission-based validation: ensure admins can only create users within their permission scope
    # Super admin can create any user
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        user_perm = user.application_permission
        new_user_perm = user_in.application_permission
        
        # Web admin can only create Web users
        if user_perm == ApplicationPermission.WEB_TRAFFIC and new_user_perm != ApplicationPermission.WEB_TRAFFIC:
            raise HTTPException(status_code=403, detail="Web admin can only create users with Web Traffic permission")
        
        # Call admin can only create Call users
        if user_perm == ApplicationPermission.CALL_TRAFFIC and new_user_perm != ApplicationPermission.CALL_TRAFFIC:
            raise HTTPException(status_code=403, detail="Call admin can only create users with Call Traffic permission")
        
        # Both permission admin can create any user (no additional restriction needed)
        
    # Validate can_approve_signups
    # Only Super Admin (and maybe Admin?) can grant approval permission. 
    # Let's start with: Any Admin can grant it, or restrict to Super Admin?
    # User requirement: "Super Admin and Admin should have the ability to grant or revoke"
    # So no extra check needed other than being an Admin (which is already checked at start of func)
    if user_in.can_approve_signups is None:
        # Default to True for Admins/Super Admins, False for Users? 
        # Or just default to True as per model default. 
        # Let's stick to model default (True) if not specified, or force explicit?
        # Model default is True.
        pass
        
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
         await send_invitation_email(
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
    
    # Prevent Admin from deleting other Admin
    if user.role == UserRole.ADMIN and target_user and target_user.get("role") == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admins cannot delete other Admins, only Super Admin can do this")
    
    # Prevent Web/Call admins from deleting users with Both permission
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        if target_user and target_user.get("application_permission") == "Both":
            if user.application_permission in [ApplicationPermission.WEB_TRAFFIC, ApplicationPermission.CALL_TRAFFIC]:
                raise HTTPException(status_code=403, detail="You cannot delete users with Both permission")
        
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

from models import UserUpdate

@router.patch("/users/{username}")
async def update_user(username: str, user_update: UserUpdate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update users")
    
    # Prevent users from updating themselves
    if user.username == username:
        raise HTTPException(status_code=403, detail="You cannot update your own account")
    
    # Prevent Web/Call admins from editing users with Both permission
    if user.role != UserRole.SUPER_ADMIN and hasattr(user, 'application_permission'):
        from models import ApplicationPermission
        target_user = await db.users.find_one({"username": username})
        if target_user and target_user.get("application_permission") == "Both":
            if user.application_permission in [ApplicationPermission.WEB_TRAFFIC, ApplicationPermission.CALL_TRAFFIC]:
                raise HTTPException(status_code=403, detail="You cannot update users with Both permission")
    
    # Build update dict with only provided fields
    update_data = {}
    if user_update.full_name is not None:
        update_data["full_name"] = user_update.full_name
    if user_update.email is not None:
        update_data["email"] = user_update.email
    if user_update.application_permission is not None:
        update_data["application_permission"] = user_update.application_permission
    if user_update.can_approve_signups is not None:
        update_data["can_approve_signups"] = user_update.can_approve_signups
    if user_update.can_view_reports is not None:
        update_data["can_view_reports"] = user_update.can_view_reports
    if user_update.password is not None:
        update_data["hashed_password"] = get_password_hash(user_update.password)
    if user_update.cake_account_manager_id is not None:
        update_data["cake_account_manager_id"] = user_update.cake_account_manager_id
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.users.update_one(
        {"username": username},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}

from models import SMTPConfigCreate

def _test_smtp_sync(config: SMTPConfigCreate):
    with smtplib.SMTP(config.host, config.port) as server:
        server.starttls()
        server.login(config.username, config.password)

@router.post("/settings/smtp/test")
async def test_smtp_config(config: SMTPConfigCreate, user: User = Depends(get_current_admin)):
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can test SMTP")

    try:
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _test_smtp_sync, config)
        return {"message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")
