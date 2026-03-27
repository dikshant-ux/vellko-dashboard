from fastapi import APIRouter, Depends, HTTPException, Query, Body, File, UploadFile
from typing import List, Optional, Dict, Any
from database import db
from models import CallOffer, CallOfferCreate, CallOfferUpdate, User, UserRole
from auth import get_current_user
from bson import ObjectId
from datetime import datetime
import csv
import io

router = APIRouter(prefix="/call-offers", tags=["call-offers"])

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
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
    search: Optional[str] = None
):
    query = {}
    if search:
        query["$or"] = [
            {"campaign_name": {"$regex": search, "$options": "i"}},
            {"campaign_id": {"$regex": search, "$options": "i"}},
            {"verticals": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.call_offers.count_documents(query)
    cursor = db.call_offers.find(query).skip(skip).limit(limit).sort("created_at", -1)
    offers = await cursor.to_list(length=limit)
    
    # Format ObjectId for JSON
    for offer in offers:
        offer["_id"] = str(offer["_id"])
        
    return {"items": offers, "total": total}

@router.get("/filters")
async def get_call_offer_filters():
    # Get unique values for each field
    # For verticals, we need to split by comma and trim
    
    # Simple values first
    pipeline = [
        {"$group": {
            "_id": None,
            "campaign_types": {"$addToSet": "$campaign_type"},
            "traffic_allowed": {"$addToSet": "$traffic_allowed"},
            "target_geos": {"$addToSet": "$target_geo"},
            "verticals_raw": {"$addToSet": "$verticals"}
        }}
    ]
    
    result = await db.call_offers.aggregate(pipeline).to_list(length=1)
    
    if not result:
        return {
            "verticals": [],
            "campaign_types": [],
            "traffic_allowed": [],
            "target_geos": []
        }
    
    data = result[0]
    
    # Process verticals (split by comma, flatten, unique, non-empty)
    verticals = set()
    for v_str in data.get("verticals_raw", []):
        if not v_str: continue
        parts = [p.strip() for p in v_str.split(",") if p.strip()]
        for p in parts:
            verticals.add(p)
    
    return {
        "verticals": sorted(list(verticals)),
        "campaign_types": sorted([v for v in data.get("campaign_types", []) if v]),
        "traffic_allowed": sorted([v for v in data.get("traffic_allowed", []) if v]),
        "target_geos": sorted([v for v in data.get("target_geos", []) if v])
    }

@router.get("/{id}", response_model=CallOffer)
async def get_call_offer(id: str):
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

@router.post("/upload")
async def upload_call_offers(file: UploadFile = File(...), user: User = Depends(get_current_admin)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    try:
        decoded = content.decode('utf-8-sig') # Handle potential BOM
    except UnicodeDecodeError:
        decoded = content.decode('latin1') # Fallback
        
    # Detect delimiter
    sample = decoded[:1024]
    try:
        dialect = csv.Sniffer().sniff(sample)
    except csv.Error:
        dialect = 'excel' # Default
        
    reader = csv.DictReader(io.StringIO(decoded), dialect=dialect)
    
    # Expected headers: 
    # Verticals, Campaign ID, Campaign Name, Campaign Type, Payout Range, Traffic Allowed, Hours, Target Geo, Capping, Details
    # Mapping CSV headers to model fields (case-insensitive and handling spaces)
    mapping = {
        "verticals": ["verticals", "vertical", "category", "vertical / category", "verticals/category"],
        "campaign_id": ["campaign id", "campaignid", "id", "campaign"],
        "campaign_name": ["campaign name", "campaignname", "name", "offer name", "offer"],
        "campaign_type": ["campaign type", "campaigntype", "type"],
        "payout_range": ["payout / buffer range", "payout range", "payout", "buffer range", "payout/buffer"],
        "traffic_allowed": ["traffic allowed", "traffic", "allowed traffic"],
        "hours_of_operation": ["hours of operation", "hours", "operation hours", "operating hours"],
        "target_geo": ["target geo", "geo", "target", "geography"],
        "capping": ["caping", "capping", "cap", "limit"],
        "details": ["details", "description", "note", "notes"]
    }

    def find_val(row, field_mapping):
        for header, value in row.items():
            if header and header.lower().strip() in field_mapping:
                return str(value).strip()
        return ""

    docs = []
    now = datetime.utcnow()
    for row in reader:
        try:
            doc = {
                "verticals": find_val(row, mapping["verticals"]),
                "campaign_id": find_val(row, mapping["campaign_id"]),
                "campaign_name": find_val(row, mapping["campaign_name"]),
                "campaign_type": find_val(row, mapping["campaign_type"]),
                "payout_buffer_range": find_val(row, mapping["payout_range"]),
                "traffic_allowed": find_val(row, mapping["traffic_allowed"]),
                "hours_of_operation": find_val(row, mapping["hours_of_operation"]),
                "target_geo": find_val(row, mapping["target_geo"]),
                "capping": find_val(row, mapping["capping"]),
                "details": find_val(row, mapping["details"]),
                "created_at": now,
                "updated_at": now,
                "created_by": user.username
            }
            # Basic validation: must have at least a name
            if doc["campaign_name"]:
                docs.append(doc)
        except Exception:
            continue
            
    if not docs:
        raise HTTPException(status_code=400, detail="No valid offers found in CSV")
        
    result = await db.call_offers.insert_many(docs)
    return {"message": f"Successfully uploaded {len(result.inserted_ids)} offers", "count": len(result.inserted_ids)}

@router.get("/filters")
async def get_call_offer_filters():
    # Get unique values for each field
    # For verticals, we need to split by comma and trim
    
    # Simple values first
    pipeline = [
        {"$group": {
            "_id": None,
            "campaign_types": {"$addToSet": "$campaign_type"},
            "traffic_allowed": {"$addToSet": "$traffic_allowed"},
            "target_geos": {"$addToSet": "$target_geo"},
            "verticals_raw": {"$addToSet": "$verticals"}
        }}
    ]
    
    result = await db.call_offers.aggregate(pipeline).to_list(length=1)
    
    if not result:
        return {
            "verticals": [],
            "campaign_types": [],
            "traffic_allowed": [],
            "target_geos": []
        }
    
    data = result[0]
    
    # Process verticals (split by comma, flatten, unique, non-empty)
    verticals = set()
    for v_str in data.get("verticals_raw", []):
        if not v_str: continue
        parts = [p.strip() for p in v_str.split(",") if p.strip()]
        for p in parts:
            verticals.add(p)
    
    return {
        "verticals": sorted(list(verticals)),
        "campaign_types": sorted([v for v in data.get("campaign_types", []) if v]),
        "traffic_allowed": sorted([v for v in data.get("traffic_allowed", []) if v]),
        "target_geos": sorted([v for v in data.get("target_geos", []) if v])
    }
