from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request, BackgroundTasks, UploadFile, File, Form
from typing import List, Optional, Dict, Any
import httpx
import xmltodict
import math
import csv
import io
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import UpdateOne
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
        # Smart fallback for dot-separated list indices (e.g., "entries.0.payout_amount")
        elif isinstance(current, list) and part.isdigit():
            idx = int(part)
            if 0 <= idx < len(current):
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

    # Wipe existing offers for this advertiser to ensure database consistency with current API state
    await db.advertiser_offers.delete_many({"advertiser_id": adv_id})

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
            
        tracking_link = ""
        if mapping_obj.tracking_link:
            raw_track = get_nested_value(raw_offer, mapping_obj.tracking_link)
            tracking_link = str(raw_track) if raw_track is not None else ""
            
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
            "tracking_link": tracking_link,
            "custom_fields": custom_fields,
            "raw_data": raw_offer,
            "synced_at": datetime.now(timezone.utc)
        }
        synced_offers.append(offer_doc)

    # If we parsed offers, update DB using bulk_write (upsert based on advertiser_id + offer_id)
    if synced_offers:
        operations = [
            UpdateOne(
                {"advertiser_id": adv_id, "offer_id": offer_doc["offer_id"]},
                {"$set": offer_doc},
                upsert=True
            )
            for offer_doc in synced_offers
        ]
        await db.advertiser_offers.bulk_write(operations)
        
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
    
    # Fetch unique custom columns defined across all advertisers (from API response mapping AND CSV custom headers)
    custom_columns_raw = await db.advertisers.distinct("response_mapping.custom_mappings.key")
    csv_columns_raw = await db.advertisers.distinct("custom_columns")
    custom_columns = list(set([col for col in custom_columns_raw if col] + [col for col in csv_columns_raw if col]))

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

class CustomColumnRequest(BaseModel):
    name: str

class CustomColumnUpdateRequest(BaseModel):
    old_name: str
    new_name: str

# API Endpoint: Get Consolidated Custom Columns
@router.get("/meta/custom-columns")
async def get_all_custom_columns(user: User = Depends(get_current_admin)):
    # 1. Fetch from system_custom_columns collection
    system_cols = await db.system_custom_columns.find().to_list(length=1000)
    system_col_names = [col["name"] for col in system_cols]
    
    # 2. Fetch unique custom columns defined across all advertisers response mappings
    custom_columns_raw = await db.advertisers.distinct("response_mapping.custom_mappings.key")
    # Fetch unique custom columns defined across all advertisers custom_columns field
    csv_columns_raw = await db.advertisers.distinct("custom_columns")
    
    custom_columns = list(set(
        system_col_names + 
        [col for col in custom_columns_raw if col] + 
        [col for col in csv_columns_raw if col]
    ))
    return {"custom_columns": sorted(custom_columns)}

# API Endpoint: Add a new custom column
@router.post("/meta/custom-columns")
async def add_custom_column(payload: CustomColumnRequest, user: User = Depends(get_current_admin)):
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Column name cannot be empty")
        
    # Check if already exists in system list
    exists = await db.system_custom_columns.find_one({"name": name_clean})
    if exists:
        raise HTTPException(status_code=400, detail="Custom column already exists")
        
    await db.system_custom_columns.insert_one({
        "name": name_clean,
        "created_at": datetime.now(timezone.utc)
    })
    return {"success": True, "message": f"Custom column '{name_clean}' added successfully"}

# API Endpoint: Rename an existing custom column
@router.put("/meta/custom-columns")
async def update_custom_column(payload: CustomColumnUpdateRequest, user: User = Depends(get_current_admin)):
    old_clean = payload.old_name.strip()
    new_clean = payload.new_name.strip()
    
    if not old_clean or not new_clean:
        raise HTTPException(status_code=400, detail="Old and new names cannot be empty")
        
    if old_clean == new_clean:
        return {"success": True, "message": "No changes needed"}
        
    # Update system_custom_columns collection
    await db.system_custom_columns.update_many(
        {"name": old_clean},
        {"$set": {"name": new_clean}}
    )
    
    # Update advertisers custom_columns lists
    await db.advertisers.update_many(
        {"custom_columns": old_clean},
        {"$set": {"custom_columns.$": new_clean}}
    )
    
    # Update advertisers response mappings keys
    await db.advertisers.update_many(
        {"response_mapping.custom_mappings.key": old_clean},
        {"$set": {"response_mapping.custom_mappings.$[elem].key": new_clean}},
        array_filters=[{"elem.key": old_clean}]
    )
    
    # Update advertiser_offers keys inside custom_fields
    await db.advertiser_offers.update_many(
        {f"custom_fields.{old_clean}": {"$exists": True}},
        {"$rename": {f"custom_fields.{old_clean}": f"custom_fields.{new_clean}"}}
    )
    
    return {"success": True, "message": f"Successfully renamed '{old_clean}' to '{new_clean}' system-wide."}

# API Endpoint: Delete a custom column
@router.delete("/meta/custom-columns")
async def delete_custom_column(name: str = Query(...), user: User = Depends(get_current_admin)):
    name_clean = name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Column name cannot be empty")
        
    # Delete from system list
    await db.system_custom_columns.delete_many({"name": name_clean})
    
    # Pull from advertisers' custom_columns list
    await db.advertisers.update_many(
        {"custom_columns": name_clean},
        {"$pull": {"custom_columns": name_clean}}
    )
    
    # Pull from response_mappings
    await db.advertisers.update_many(
        {"response_mapping.custom_mappings.key": name_clean},
        {"$pull": {"response_mapping.custom_mappings": {"key": name_clean}}}
    )
    
    return {"success": True, "message": f"Custom column '{name_clean}' deleted successfully"}

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


def normalize_header(h: str) -> str:
    # Remove non-alphanumeric chars, convert to lowercase
    h_clean = "".join(c for c in h if c.isalnum()).lower()
    if h_clean in ["offerid", "id", "siteofferid", "offernumber"]:
        return "offer_id"
    if h_clean in ["name", "offername", "title", "siteoffername"]:
        return "name"
    if h_clean in ["payout", "amount", "price", "rate"]:
        return "payout"
    if h_clean in ["vertical", "category", "verticalname", "niche"]:
        return "vertical"
    if h_clean in ["status", "state", "siteofferstatus", "statusname"]:
        return "status"
    if h_clean in ["previewlink", "link", "url", "previewurl", "offerlink"]:
        return "preview_link"
    if h_clean in ["trackinglink", "trackingurl", "tracklink", "trackurl"]:
        return "tracking_link"
    return h.strip()


# API Endpoint: Analyze CSV file for columns mapping
@router.post("/{id}/analyze-csv")
async def analyze_advertiser_offers_csv(
    id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_admin)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
        
    advertiser = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not advertiser:
        raise HTTPException(status_code=404, detail="Advertiser not found")
        
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    try:
        content = await file.read()
        try:
            decoded = content.decode('utf-8-sig') # Handle potential BOM
        except UnicodeDecodeError:
            decoded = content.decode('latin1') # Fallback
            
        # Detect delimiter more robustly
        sample = decoded[:1024]
        delimiters = [',', ';', '\t', '|']
        dialect = 'excel' # Default
        
        try:
            sniffer = csv.Sniffer()
            if any(d in sample for d in delimiters):
                dialect = sniffer.sniff(sample, delimiters=delimiters)
        except csv.Error:
            pass
            
        reader = csv.reader(io.StringIO(decoded), dialect=dialect)
        rows = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="Empty CSV file")
            
        # Clean headers
        headers = [h.strip().strip('"').strip("'") for h in rows[0]]
        preview = []
        for row in rows[1:4]: # Get first 3 rows as preview
            preview.append([str(cell).strip() for cell in row])
            
        return {
            "headers": headers,
            "preview": preview,
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file for analysis: {str(e)}")


# API Endpoint: Upload Offers via CSV with Optional mapping_json
@router.post("/{id}/upload-csv")
async def upload_advertiser_offers_csv(
    id: str,
    file: UploadFile = File(...),
    mapping_json: Optional[str] = Form(None),
    request: Request = None,
    user: User = Depends(get_current_admin)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid Advertiser ID format")
        
    advertiser = await db.advertisers.find_one({"_id": ObjectId(id)})
    if not advertiser:
        raise HTTPException(status_code=404, detail="Advertiser not found")
        
    adv_id = str(advertiser["_id"])
    adv_name = advertiser["name"]
    adv_custom_id = advertiser.get("advertiser_id", "")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Uploaded file must be a CSV file")
        
    try:
        contents = await file.read()
        try:
            decoded = contents.decode("utf-8-sig")
        except UnicodeDecodeError:
            decoded = contents.decode("latin1")
            
        # Detect delimiter more robustly
        sample = decoded[:1024]
        delimiters = [',', ';', '\t', '|']
        dialect = 'excel'
        try:
            sniffer = csv.Sniffer()
            if any(d in sample for d in delimiters):
                dialect = sniffer.sniff(sample, delimiters=delimiters)
        except csv.Error:
            pass
            
        reader_raw = csv.reader(io.StringIO(decoded), dialect=dialect)
        rows = list(reader_raw)
        if not rows:
            raise HTTPException(status_code=400, detail="Empty CSV file")
            
        raw_headers = [h.strip().strip('"').strip("'") for h in rows[0]]
        data_rows = rows[1:]
        
        # Check mapping
        field_to_idx = {}
        custom_field_mappings = {}
        explicit_mapping = None
        if mapping_json:
            import json
            try:
                explicit_mapping = json.loads(mapping_json)
                for field, idx in explicit_mapping.items():
                    if idx is not None and idx != "none":
                        try:
                            idx_int = int(idx)
                            if field in ["offer_id", "name", "payout", "vertical", "status", "preview_link", "tracking_link"]:
                                field_to_idx[field] = idx_int
                            else:
                                custom_field_mappings[field] = idx_int
                        except ValueError:
                            pass
            except Exception as e:
                print(f"Error parsing mapping_json: {e}")
                
        # If mapping is not provided, do fallback intelligent mapping using normalize_header
        if not explicit_mapping:
            for idx, h in enumerate(raw_headers):
                norm_key = normalize_header(h)
                if norm_key in ["offer_id", "name", "payout", "vertical", "status", "preview_link", "tracking_link"]:
                    if norm_key not in field_to_idx:
                        field_to_idx[norm_key] = idx
                        
        # Required validation
        if "offer_id" not in field_to_idx or "name" not in field_to_idx:
            raise HTTPException(
                status_code=400, 
                detail="CSV mapping must align at least 'Offer ID' and 'Offer Name' columns."
            )
            
        # Determine which columns are standard mapped columns
        mapped_indices = set(field_to_idx.values()).union(set(custom_field_mappings.values()))
        
        uploaded_offers = []
        all_custom_keys = set()
        
        for row in data_rows:
            if not any(row):
                continue
                
            def get_cell_val(field: str, default: str = "") -> str:
                idx = field_to_idx.get(field)
                if idx is not None and 0 <= idx < len(row):
                    return str(row[idx]).strip()
                return default
                
            offer_id = get_cell_val("offer_id")
            name = get_cell_val("name")
            payout = get_cell_val("payout")
            vertical = get_cell_val("vertical")
            status = get_cell_val("status", "Active")
            preview_link = get_cell_val("preview_link")
            tracking_link = get_cell_val("tracking_link")
            
            if not offer_id or not name:
                continue
                
            # Collect custom fields (explicitly mapped custom fields first)
            custom_fields = {}
            for field_key, idx in custom_field_mappings.items():
                if 0 <= idx < len(row):
                    custom_fields[field_key] = str(row[idx]).strip()
                    
            # Raw data is the original row represented as a dictionary
            raw_data = {}
            for idx, cell_val in enumerate(row):
                if idx < len(raw_headers):
                    raw_data[raw_headers[idx]] = str(cell_val).strip()
                    
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
                "tracking_link": tracking_link,
                "custom_fields": custom_fields,
                "raw_data": raw_data,
                "synced_at": datetime.now(timezone.utc)
            }
            uploaded_offers.append(offer_doc)
            all_custom_keys.update(custom_fields.keys())
            
        if not uploaded_offers:
            raise HTTPException(status_code=400, detail="No valid offers found in the CSV file")
            
        # Perform bulk upsert
        operations = [
            UpdateOne(
                {"advertiser_id": adv_id, "offer_id": offer_doc["offer_id"]},
                {"$set": offer_doc},
                upsert=True
            )
            for offer_doc in uploaded_offers
        ]
        
        await db.advertiser_offers.bulk_write(operations)
        
        # Save custom columns on the Advertiser document for quick frontend rendering
        if all_custom_keys:
            await db.advertisers.update_one(
                {"_id": ObjectId(adv_id)},
                {"$addToSet": {"custom_columns": {"$each": list(all_custom_keys)}}}
            )
            
        await log_activity(
            username=user.username,
            action="Uploaded Advertiser Offers CSV",
            details=f"Uploaded {len(uploaded_offers)} offers from CSV for advertiser {adv_name}",
            request=request
        )
        
        return {
            "success": True,
            "message": f"Successfully imported/updated {len(uploaded_offers)} offers from CSV.",
            "offers_count": len(uploaded_offers)
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")
