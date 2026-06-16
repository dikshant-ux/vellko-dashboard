from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request, BackgroundTasks
from typing import List, Optional, Dict, Any
import httpx
import xmltodict
import math
from datetime import datetime, timezone
from bson import ObjectId
from database import db
from models import Advertiser, AdvertiserOffer, ResponseMapping, HeaderItem, User, UserRole
from auth import get_current_user
from activity_utils import log_activity
from pydantic import BaseModel


router = APIRouter(prefix="/admin/advertisers", tags=["Advertisers"])

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

# Helper to retrieve nested values in JSON payloads using dot notation and indexers
def get_nested_value(data: Any, path: str) -> Any:
    if not path or path.strip() in [".", "$", ""]:
        return data
    parts = path.split('.')
    current = data
    for part in parts:
        if current is None:
            return None
        # Handle list indexing like "items[0]"
        if '[' in part and part.endswith(']'):
            sub_parts = part.split('[')
            key = sub_parts[0]
            indices = [int(idx[:-1]) for idx in sub_parts[1:]]
            if key:
                if isinstance(current, dict) and key in current:
                    current = current[key]
                else:
                    return None
            for idx in indices:
                if isinstance(current, list) and 0 <= idx < len(current):
                    current = current[idx]
                else:
                    return None
        else:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
    return current

# API Fetch helper
async def fetch_external_offers_api(api_url: str, method: str, headers_list: List[HeaderItem], request_payload: Optional[str]) -> Any:
    headers = {}
    for h in headers_list:
        headers[h.key] = h.value

    # Parse request payload (JSON or parameters)
    data = None
    json_data = None
    if request_payload and request_payload.strip():
        import json
        try:
            json_data = json.loads(request_payload)
        except json.JSONDecodeError:
            data = request_payload

    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        method_upper = method.upper()
        if method_upper == "GET":
            params = None
            if json_data and isinstance(json_data, dict):
                params = json_data
            response = await client.get(api_url, headers=headers, params=params)
        elif method_upper == "POST":
            if json_data is not None:
                response = await client.post(api_url, headers=headers, json=json_data)
            else:
                response = await client.post(api_url, headers=headers, content=data)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported HTTP method: {method}")

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"External API returned status {response.status_code}: {response.text[:300]}")

        content_type = response.headers.get("content-type", "").lower()
        text_content = response.text.strip()

        if "application/json" in content_type or text_content.startswith(("{", "[")):
            try:
                return response.json()
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to parse JSON response: {str(e)}")
        elif "application/xml" in content_type or "text/xml" in content_type or text_content.startswith("<"):
            try:
                return xmltodict.parse(response.content)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to parse XML response: {str(e)}")
        else:
            # Fallback parsing
            try:
                return response.json()
            except:
                try:
                    return xmltodict.parse(response.content)
                except:
                    raise HTTPException(status_code=400, detail=f"Unable to parse response as JSON or XML. Content snippet: {text_content[:200]}")

# Sync offers helper
async def sync_advertiser_offers_db(advertiser: Dict[str, Any]) -> int:
    adv_id = str(advertiser["_id"])
    adv_name = advertiser["name"]
    adv_custom_id = advertiser.get("advertiser_id", "")
    mapping = advertiser.get("response_mapping")
    
    if not mapping:
        return 0

    # Retrieve response mapping configuration
    mapping_obj = ResponseMapping(**mapping)
    headers_list = [HeaderItem(**h) for h in advertiser.get("headers", [])]
    
    # Fetch API payload
    response_data = await fetch_external_offers_api(
        api_url=advertiser["api_url"],
        method=advertiser.get("method", "GET"),
        headers_list=headers_list,
        request_payload=advertiser.get("request_payload")
    )
    
    # Extract offers list
    offers_raw = get_nested_value(response_data, mapping_obj.offers_path)
    
    if offers_raw is None:
        raise HTTPException(status_code=400, detail=f"Offers list path '{mapping_obj.offers_path}' resolved to null.")
        
    if not isinstance(offers_raw, list):
        # If single item, make it a list
        if isinstance(offers_raw, dict):
            offers_raw = [offers_raw]
        else:
            raise HTTPException(status_code=400, detail=f"Offers path '{mapping_obj.offers_path}' did not resolve to a list or dict object.")

    synced_offers = []
    for raw_offer in offers_raw:
        # Map values using helper
        raw_id = get_nested_value(raw_offer, mapping_obj.offer_id)
        raw_name = get_nested_value(raw_offer, mapping_obj.offer_name)
        raw_payout = get_nested_value(raw_offer, mapping_obj.payout)
        
        # Guard required fields
        if raw_id is None or raw_name is None:
            continue
            
        offer_id = str(raw_id)
        name = str(raw_name)
        payout = str(raw_payout) if raw_payout is not None else ""
        
        # Optional fields
        vertical = ""
        if mapping_obj.vertical:
            raw_vert = get_nested_value(raw_offer, mapping_obj.vertical)
            vertical = str(raw_vert) if raw_vert is not None else ""
            
        status = "Active"
        if mapping_obj.status:
            raw_stat = get_nested_value(raw_offer, mapping_obj.status)
            status = str(raw_stat) if raw_stat is not None else "Active"
            
        preview_link = ""
        if mapping_obj.preview_link:
            raw_prev = get_nested_value(raw_offer, mapping_obj.preview_link)
            preview_link = str(raw_prev) if raw_prev is not None else ""
            
        # Dynamic custom fields extraction
        custom_fields = {}
        if mapping_obj.custom_mappings:
            for item in mapping_obj.custom_mappings:
                raw_val = get_nested_value(raw_offer, item.path)
                custom_fields[item.key] = str(raw_val) if raw_val is not None else ""

        offer_doc = {
            "advertiser_id": adv_id,
            "advertiser_name": adv_name,
            "advertiser_custom_id": adv_custom_id,
            "offer_id": offer_id,
            "name": name,
            "payout": payout,
            "vertical": vertical,
            "status": status,
            "preview_link": preview_link,
            "custom_fields": custom_fields,
            "raw_data": raw_offer,
            "synced_at": datetime.now(timezone.utc)
        }
        synced_offers.append(offer_doc)

    # If we parsed offers, update DB
    # Clear existing offers for this advertiser
    await db.advertiser_offers.delete_many({"advertiser_id": adv_id})
    
    if synced_offers:
        await db.advertiser_offers.insert_many(synced_offers)
        
    return len(synced_offers)

# API Endpoint: Test API
class TestAPIRequest(BaseModel):
    api_url: str
    method: str = "GET"
    headers: List[HeaderItem] = []
    request_payload: Optional[str] = None

@router.post("/test-api")
async def test_advertiser_api(req: TestAPIRequest, user: User = Depends(get_current_admin)):
    try:
        response_json = await fetch_external_offers_api(
            api_url=req.api_url,
            method=req.method,
            headers_list=req.headers,
            request_payload=req.request_payload
        )
        return {"success": True, "payload": response_json}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"API Connection Request Failed: {str(e)}")

# API Endpoint: Get Consolidated Offers
@router.get("/offers")
async def get_consolidated_offers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_field: str = Query("name"),
    sort_descending: bool = Query(False),
    user: User = Depends(get_current_user)
):
    query = {}
    
    # Fetch unique custom columns defined across all advertisers
    custom_columns_raw = await db.advertisers.distinct("response_mapping.custom_mappings.key")
    custom_columns = [col for col in custom_columns_raw if col]

    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query_or = [
            {"name": search_regex},
            {"offer_id": search_regex},
            {"advertiser_name": search_regex},
            {"advertiser_custom_id": search_regex},
            {"vertical": search_regex},
            {"status": search_regex}
        ]
        # Dynamically search inside custom_fields values as well!
        for col in custom_columns:
            query_or.append({f"custom_fields.{col}": search_regex})
            
        query["$or"] = query_or

    total_count = await db.advertiser_offers.count_documents(query)
    skip = (page - 1) * limit
    sort_dir = -1 if sort_descending else 1
    
    cursor = db.advertiser_offers.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    
    # Serialize items
    serialized = []
    for item in items:
        item["_id"] = str(item["_id"])
        serialized.append(item)
        
    total_pages = math.ceil(total_count / limit) if limit > 0 else 0
    return {
        "success": True,
        "row_count": total_count,
        "offers": serialized,
        "custom_columns": custom_columns,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

# CRUD Endpoint: Create Advertiser
class AdvertiserCreate(BaseModel):
    advertiser_id: str = ""
    name: str
    api_url: str
    method: str = "GET"
    headers: List[HeaderItem] = []
    request_payload: Optional[str] = None
    auto_sync_hours: int = 3

@router.post("", response_model=Advertiser)
async def create_advertiser(adv_in: AdvertiserCreate, request: Request, user: User = Depends(get_current_admin)):
    existing = await db.advertisers.find_one({"name": adv_in.name})
    if existing:
        raise HTTPException(status_code=400, detail="Advertiser with this name already exists")
        
    adv_dict = adv_in.dict()
    adv_dict["created_at"] = datetime.now(timezone.utc)
    adv_dict["updated_at"] = datetime.now(timezone.utc)
    adv_dict["response_mapping"] = None
    
    result = await db.advertisers.insert_one(adv_dict)
    adv_dict["_id"] = result.inserted_id
    
    await log_activity(
        username=user.username,
        action="Created Advertiser API config",
        details=f"Created advertiser configuration: {adv_in.name}",
        request=request
    )
    
    return Advertiser(**adv_dict)

# CRUD Endpoint: List Advertisers
@router.get("")
async def list_advertisers(user: User = Depends(get_current_admin)):
    cursor = db.advertisers.find()
    items = await cursor.to_list(length=100)
    serialized = []
    for item in items:
        item["_id"] = str(item["_id"])
        # FetchSyncedOffersCount
        offers_count = await db.advertiser_offers.count_documents({"advertiser_id": item["_id"]})
        item["offers_count"] = offers_count
        serialized.append(item)
    return serialized

# CRUD Endpoint: Get Single Advertiser
@router.get("/{id}", response_model=Advertiser)
async def get_advertiser(id: str, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
    item = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not item:
        raise HTTPException(status_code=404, detail="Advertiser not found")
    return Advertiser(**item)

# CRUD Endpoint: Update Advertiser
class AdvertiserUpdate(BaseModel):
    advertiser_id: Optional[str] = None
    name: Optional[str] = None
    api_url: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[List[HeaderItem]] = None
    request_payload: Optional[str] = None
    auto_sync_hours: Optional[int] = None

@router.put("/{id}", response_model=Advertiser)
async def update_advertiser(id: str, adv_in: AdvertiserUpdate, request: Request, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
    
    existing = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Advertiser not found")
        
    update_data = adv_in.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.advertisers.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    
    updated = await db.advertisers.find_one({"_id": ObjectId(id)})
    
    # Update advertiser_name / advertiser_custom_id in synced offers if changed
    set_dict = {}
    if adv_in.name and adv_in.name != existing.get("name"):
        set_dict["advertiser_name"] = adv_in.name
    if adv_in.advertiser_id is not None and adv_in.advertiser_id != existing.get("advertiser_id"):
        set_dict["advertiser_custom_id"] = adv_in.advertiser_id
    if set_dict:
        await db.advertiser_offers.update_many(
            {"advertiser_id": id},
            {"$set": set_dict}
        )

    await log_activity(
        username=user.username,
        action="Updated Advertiser API config",
        details=f"Updated advertiser configuration: {updated.get('name')}",
        request=request
    )
    
    return Advertiser(**updated)

# CRUD Endpoint: Delete Advertiser
@router.delete("/{id}")
async def delete_advertiser(id: str, request: Request, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
        
    existing = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Advertiser not found")
        
    # Delete advertiser config
    await db.advertisers.delete_one({"_id": ObjectId(id)})
    
    # Delete synced offers
    deleted_offers = await db.advertiser_offers.delete_many({"advertiser_id": id})
    
    await log_activity(
        username=user.username,
        action="Deleted Advertiser API config",
        details=f"Deleted advertiser {existing.get('name')} and cleared {deleted_offers.deleted_count} synced offers",
        request=request
    )
    
    return {"message": "Advertiser and synced offers deleted successfully", "deleted_offers_count": deleted_offers.deleted_count}

# Background Sync Worker Task
async def run_sync_in_background(adv_id: str):
    await db.advertisers.update_one(
        {"_id": ObjectId(adv_id)},
        {"$set": {
            "sync_status": "SYNCING",
            "last_sync_error": None
        }}
    )
    try:
        adv = await db.advertisers.find_one({"_id": ObjectId(adv_id)})
        if adv:
            await sync_advertiser_offers_db(adv)
            await db.advertisers.update_one(
                {"_id": ObjectId(adv_id)},
                {"$set": {
                    "sync_status": "SUCCESS",
                    "last_sync_error": None,
                    "last_synced_at": datetime.now(timezone.utc)
                }}
            )
    except Exception as e:
        await db.advertisers.update_one(
            {"_id": ObjectId(adv_id)},
            {"$set": {
                "sync_status": "FAILED",
                "last_sync_error": str(e),
                "last_synced_at": datetime.now(timezone.utc)
            }}
        )

# API Endpoint: Save Mapping and trigger Sync
@router.post("/{id}/save-mapping")
async def save_response_mapping(id: str, mapping: ResponseMapping, request: Request, background_tasks: BackgroundTasks, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
        
    existing = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Advertiser not found")
        
    mapping_dict = mapping.dict()
    await db.advertisers.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "response_mapping": mapping_dict,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Trigger Sync in background
    background_tasks.add_task(run_sync_in_background, id)
    
    await log_activity(
        username=user.username,
        action="Configured Advertiser Mapping",
        details=f"Configured response mapping for advertiser {existing.get('name')}. Sync started in background.",
        request=request
    )
    
    return {"message": "Mapping saved and synchronization started in the background successfully"}

# API Endpoint: Manual Sync
@router.post("/{id}/sync")
async def sync_advertiser_offers(id: str, request: Request, background_tasks: BackgroundTasks, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
        
    existing = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Advertiser not found")
        
    if not existing.get("response_mapping"):
        raise HTTPException(status_code=400, detail="Advertiser must have response mapping configured before syncing offers")
        
    # Trigger Sync in background
    background_tasks.add_task(run_sync_in_background, id)
    
    await log_activity(
        username=user.username,
        action="Synced Advertiser Offers",
        details=f"Synced offers for advertiser {existing.get('name')} in the background.",
        request=request
    )
    
    return {"message": "Offers synchronization started in the background successfully"}
