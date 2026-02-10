from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List
from database import db
from models import User, UserRole, SMTPConfig, SMTPConfigCreate, SMTPConfigUpdate
from auth import get_current_user
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/admin/settings", tags=["settings"])

async def get_current_admin(current_user: str = Depends(get_current_user)):
    user_data = await db.users.find_one({"username": current_user})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(**user_data)
    if user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user

@router.get("/smtp", response_model=List[SMTPConfig])
async def get_smtp_configs(user: User = Depends(get_current_admin)):
    cursor = db.smtp_configs.find({}).sort("created_at", -1)
    configs = await cursor.to_list(length=100)
    return configs

@router.post("/smtp", response_model=SMTPConfig)
async def create_smtp_config(config: SMTPConfigCreate, user: User = Depends(get_current_admin)):
    config_dict = config.dict()
    config_dict["created_at"] = datetime.utcnow()
    config_dict["updated_at"] = datetime.utcnow()
    
    # If this is the first config, make it active by default
    count = await db.smtp_configs.count_documents({})
    if count == 0:
        config_dict["is_active"] = True
    elif config_dict["is_active"]:
        # If new one is active, deactivate others
        await db.smtp_configs.update_many({}, {"$set": {"is_active": False}})
        
    result = await db.smtp_configs.insert_one(config_dict)
    created_config = await db.smtp_configs.find_one({"_id": result.inserted_id})
    return created_config

@router.put("/smtp/{id}", response_model=SMTPConfig)
async def update_smtp_config(id: str, config: SMTPConfigUpdate, user: User = Depends(get_current_admin)):
    update_data = {k: v for k, v in config.dict(exclude_unset=True).items()}
    if not update_data:
         raise HTTPException(status_code=400, detail="No data provided")
         
    update_data["updated_at"] = datetime.utcnow()
    
    if update_data.get("is_active"):
        # Deactivate others
        await db.smtp_configs.update_many({"_id": {"$ne": ObjectId(id)}}, {"$set": {"is_active": False}})
        
    result = await db.smtp_configs.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
        
    updated_config = await db.smtp_configs.find_one({"_id": ObjectId(id)})
    return updated_config

@router.delete("/smtp/{id}")
async def delete_smtp_config(id: str, user: User = Depends(get_current_admin)):
    # Prevent deleting the last active one? 
    # For now allow, fallback to env vars.
    
    result = await db.smtp_configs.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
        
    return {"message": "Config deleted"}

@router.post("/smtp/{id}/activate")
async def activate_smtp_config(id: str, user: User = Depends(get_current_admin)):
    # Verify existence
    config = await db.smtp_configs.find_one({"_id": ObjectId(id)})
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
        
    # Deactivate all
    await db.smtp_configs.update_many({}, {"$set": {"is_active": False}})
    
    # Activate target
    await db.smtp_configs.update_one({"_id": ObjectId(id)}, {"$set": {"is_active": True}})
    
    return {"message": "SMTP Config activated"}
