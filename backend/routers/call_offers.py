from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile, Form
from typing import List, Optional, Dict, Any
from database import db
from models import CallOffer, CallOfferCreate, CallOfferUpdate, User, UserRole
from auth import get_current_user
from bson import ObjectId
from datetime import datetime
import csv
import io
import json

router = APIRouter(prefix="/call-offers", tags=["call-offers"])

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

async def check_call_permission(current_user: User = Depends(get_current_user)):
    # Super Admin can see everything
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user
        
    # Check application permissions for ADMIN and USER roles
    allowed_permissions = ["Call Traffic", "Both"]
    if current_user.application_permission not in allowed_permissions:
        raise HTTPException(status_code=403, detail="Access denied: Call Traffic permission required")
    
    return current_user

@router.post("", response_model=CallOffer)
async def create_call_offer(offer: CallOfferCreate, user: User = Depends(get_current_admin)):
    offer_dict = offer.dict()
    offer_dict["created_at"] = datetime.utcnow()
    offer_dict["updated_at"] = datetime.utcnow()
    offer_dict["created_by"] = user.username
    
    result = await db.call_offers.insert_one(offer_dict)
    offer_dict["_id"] = result.inserted_id
    return offer_dict

@router.get("", response_model=Dict[str, Any])
async def get_call_offers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    coverage: Optional[str] = None,
    status: Optional[str] = None,
    user: User = Depends(check_call_permission)
):
    query = {}
    if search:
        query["$or"] = [
            {"campaign_name": {"$regex": search, "$options": "i"}},
            {"campaign_id": {"$regex": search, "$options": "i"}},
            {"verticals": {"$regex": search, "$options": "i"}}
        ]
    
    if coverage:
        query["coverage"] = {"$regex": f"\\b{coverage}\\b", "$options": "i"} # Match whole word for state codes
    
    if status:
        query["status"] = status
    elif user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        # For non-admins, only show Active offers by default
        query["status"] = "Active"
    
    total = await db.call_offers.count_documents(query)
    cursor = db.call_offers.find(query).skip(skip).limit(limit).sort("created_at", -1)
    offers = await cursor.to_list(length=limit)
    
    # Format ObjectId for JSON
    for offer in offers:
        offer["_id"] = str(offer["_id"])
        
    return {"items": offers, "total": total}

@router.get("/filters")
async def get_call_offer_filters(user: User = Depends(check_call_permission)):
    # Get unique values for each field
    # For verticals, we need to split by comma and trim
    
    # Simple values first
    pipeline = [
        {"$group": {
            "_id": None,
            "campaign_types": {"$addToSet": "$campaign_type"},
            "traffic_allowed": {"$addToSet": "$traffic_allowed"},
            "target_geos": {"$addToSet": "$target_geo"},
            "verticals_raw": {"$addToSet": "$verticals"},
            "coverage_raw": {"$addToSet": "$coverage"}
        }}
    ]
    
    result = await db.call_offers.aggregate(pipeline).to_list(length=1)
    
    if not result:
        return {
            "verticals": [],
            "campaign_types": [],
            "traffic_allowed": [],
            "target_geos": [],
            "coverage": []
        }
    
    data = result[0]
    
    # Process verticals (split by comma, flatten, unique, non-empty)
    verticals = set()
    for v_str in data.get("verticals_raw", []):
        if not v_str: continue
        parts = [p.strip() for p in v_str.split(",") if p.strip()]
        for p in parts:
            verticals.add(p)
            
    # Process coverage (split by comma, flatten, unique, non-empty)
    coverage = set()
    for c_str in data.get("coverage_raw", []):
        if not c_str: continue
        parts = [p.strip() for p in c_str.split(",") if p.strip()]
        for p in parts:
            coverage.add(p)
            
    return {
        "verticals": sorted(list(verticals)),
        "campaign_types": sorted([v for v in data.get("campaign_types", []) if v]),
        "traffic_allowed": sorted([v for v in data.get("traffic_allowed", []) if v]),
        "target_geos": sorted([v for v in data.get("target_geos", []) if v]),
        "coverage": sorted(list(coverage))
    }

@router.get("/{id}", response_model=CallOffer)
async def get_call_offer(id: str, user: User = Depends(check_call_permission)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    offer = await db.call_offers.find_one({"_id": ObjectId(id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer

@router.put("/{id}", response_model=CallOffer)
async def update_call_offer(id: str, update: CallOfferUpdate, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.call_offers.find_one_and_update(
        {"_id": ObjectId(id)},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Offer not found")
    return result

@router.delete("/{id}")
async def delete_call_offer(id: str, user: User = Depends(get_current_admin)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    result = await db.call_offers.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"message": "Offer deleted successfully"}

@router.post("/batch")
async def batch_create_call_offers(offers: List[CallOfferCreate], user: User = Depends(get_current_admin)):
    if not offers:
        return {"message": "No offers provided", "count": 0}
    
    now = datetime.utcnow()
    docs = []
    for o in offers:
        doc = o.dict()
        doc["created_at"] = now
        doc["updated_at"] = now
        doc["created_by"] = user.username
        docs.append(doc)
    
    result = await db.call_offers.insert_many(docs)
    return {"message": f"Successfully created {len(result.inserted_ids)} offers", "count": len(result.inserted_ids)}

@router.post("/analyze")
async def analyze_call_offers_csv(file: UploadFile = File(...), user: User = Depends(get_current_admin)):
    print(f"DEBUG: analyze_call_offers_csv called for file: {file.filename}")
    if not file.filename.lower().endswith('.csv'):
        print(f"DEBUG: File rejected (not .csv): {file.filename}")
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    print(f"DEBUG: File read bytes: {len(content)}")
    try:
        decoded = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        decoded = content.decode('latin1')
        
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
        print("DEBUG: CSV rows empty after parsing")
        raise HTTPException(status_code=400, detail="Empty CSV file")
        
    # Clean headers (remove BOM residues if any, though utf-8-sig should handle it)
    headers = [h.strip().strip('"').strip("'") for h in rows[0]]
    print(f"DEBUG: Parsed headers: {headers}")
    preview = []
    for row in rows[1:4]: # Get first 3 rows as preview
        preview.append([str(cell).strip() for cell in row])
        
    return {
        "headers": headers,
        "preview": preview,
        "filename": file.filename
    }

@router.post("/upload")
async def upload_call_offers(
    file: UploadFile = File(...), 
    mapping_json: Optional[str] = Form(None),
    user: User = Depends(get_current_admin)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
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
        
    reader_raw = csv.reader(io.StringIO(decoded), dialect=dialect)
    rows = list(reader_raw)
    if not rows:
        raise HTTPException(status_code=400, detail="Empty CSV")
    
    raw_headers = rows[0]
    data_rows = rows[1:]

    # Final Mapping
    field_to_idx = {}
    
    # Check if we have an explicit mapping from the frontend
    explicit_mapping = None
    if mapping_json:
        try:
            explicit_mapping = json.loads(mapping_json)
            # mapping_json expected format: {"verticals": 0, "campaign_id": 1, ...}
            for field, idx in explicit_mapping.items():
                if idx is not None and isinstance(idx, int):
                    field_to_idx[field] = idx
        except Exception as e:
            print(f"Error parsing mapping_json: {e}")

    # Fallback to intelligent automatic mapping if explicit mapping is missing or incomplete
    if not explicit_mapping:
        mapping_aliases = {
            "verticals": ["verticals", "vertical", "category", "vertical / category", "verticals/category"],
            "campaign_id": ["campaign id", "campaignid", "id", "campaign"],
            "campaign_name": ["campaign name", "campaignname", "name", "offer name", "offer", "campaign"],
            "campaign_type": ["campaign type", "campaigntype", "type", "campaign"],
            "payout_range": ["payout / buffer range", "payout range", "payout", "buffer range", "payout/buffer", "payout / b", "payout / b,"],
            "traffic_allowed": ["traffic allowed", "traffic", "allowed traffic", "traffic allo"],
            "hours_of_operation": ["hours of operation", "hours", "operation hours", "operating hours", "hours of c"],
            "target_geo": ["target geo", "geo", "target", "geography"],
            "capping": ["caping", "capping", "cap", "limit", "aping"],
            "coverage": ["coverage", "states", "area", "region", "regions"],
            "details": ["details", "description", "note", "notes"],
            "status": ["status"]
        }

        campaign_count = 0
        for idx, h in enumerate(raw_headers):
            if not h: continue
            h_clean = h.lower().strip()
            
            # Special handling for ambiguous "Campaign" duplicates
            if h_clean == "campaign":
                campaign_count += 1
                if campaign_count == 1:
                    if "campaign_id" not in field_to_idx: field_to_idx["campaign_id"] = idx
                elif campaign_count == 2:
                    if "campaign_name" not in field_to_idx: field_to_idx["campaign_name"] = idx
                elif campaign_count == 3:
                    if "campaign_type" not in field_to_idx: field_to_idx["campaign_type"] = idx
                continue

            # Normal fuzzy matching
            for field, aliases in mapping_aliases.items():
                if any(alias == h_clean for alias in aliases) or any(h_clean.startswith(alias) for alias in aliases):
                    if field not in field_to_idx:
                        field_to_idx[field] = idx
                        break
        
    def get_val(row, field):
        idx = field_to_idx.get(field)
        if idx is not None and idx < len(row):
            return str(row[idx]).strip()
        return ""

    docs = []
    now = datetime.utcnow()
    for row in data_rows:
        if not any(row): continue # Skip empty rows
        try:
            doc = {
                "verticals": get_val(row, "verticals"),
                "campaign_id": get_val(row, "campaign_id"),
                "campaign_name": get_val(row, "campaign_name"),
                "campaign_type": get_val(row, "campaign_type"),
                "payout_buffer_range": get_val(row, "payout_range"),
                "traffic_allowed": get_val(row, "traffic_allowed"),
                "hours_of_operation": get_val(row, "hours_of_operation"),
                "target_geo": get_val(row, "target_geo"),
                "capping": get_val(row, "capping"),
                "coverage": get_val(row, "coverage"),
                "details": get_val(row, "details"),
                "status": get_val(row, "status") or "Active",
                "created_at": now,
                "updated_at": now,
                "created_by": user.username
            }
            # Basic validation
            if doc["campaign_name"] or doc["campaign_id"]:
                docs.append(doc)
        except Exception:
            continue
            
    if not docs:
        raise HTTPException(status_code=400, detail="No valid offers found in CSV. Please check your headers.")
        
    result = await db.call_offers.insert_many(docs)
    return {"message": f"Successfully imported {len(result.inserted_ids)} offers", "count": len(result.inserted_ids)}

