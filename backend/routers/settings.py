from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List
from database import db
from models import User, UserRole, SMTPConfig, SMTPConfigCreate, SMTPConfigUpdate, APIConnection, APIConnectionCreate, APIConnectionUpdate, APIConnectionType
from auth import get_current_user
from bson import ObjectId
from datetime import datetime
from encryption_utils import encrypt_field, decrypt_field

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

# API Connection Endpoints
@router.get("/connections", response_model=List[APIConnection])
async def get_api_connections(user: User = Depends(get_current_admin)):
    cursor = db.api_connections.find({}).sort("created_at", -1)
    connections = await cursor.to_list(length=100)
    
    # Mask keys for frontend
    for conn in connections:
        if conn.get("cake_details"):
            conn["cake_details"]["api_key"] = "****"
        if conn.get("ringba_details"):
            conn["ringba_details"]["api_token"] = "****"
            
    return connections

@router.post("/connections", response_model=APIConnection)
async def create_api_connection(connection: APIConnectionCreate, user: User = Depends(get_current_admin)):
    connection_dict = connection.dict()
    
    # Encrypt keys
    if connection_dict.get("cake_details"):
        connection_dict["cake_details"]["api_key"] = encrypt_field(connection_dict["cake_details"]["api_key"])
    if connection_dict.get("ringba_details"):
        connection_dict["ringba_details"]["api_token"] = encrypt_field(connection_dict["ringba_details"]["api_token"])

    connection_dict["created_at"] = datetime.utcnow()
    connection_dict["updated_at"] = datetime.utcnow()
    
    # Check if first of its type
    count = await db.api_connections.count_documents({"type": connection.type})
    if count == 0:
        connection_dict["is_active"] = True
    elif connection_dict["is_active"]:
        # Deactivate others of same type
        await db.api_connections.update_many({"type": connection.type}, {"$set": {"is_active": False}})
        
    result = await db.api_connections.insert_one(connection_dict)
    created_connection = await db.api_connections.find_one({"_id": result.inserted_id})
    return created_connection

@router.put("/connections/{id}", response_model=APIConnection)
async def update_api_connection(id: str, connection: APIConnectionUpdate, user: User = Depends(get_current_admin)):
    update_data = {k: v for k, v in connection.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided")
        
    update_data["updated_at"] = datetime.utcnow()
    
    # Encrypt keys if provided and not masked
    if update_data.get("cake_details"):
        # If frontend sent mask "****", don't update the key
        if update_data["cake_details"].get("api_key") == "****":
            # Get existing to preserve
            existing = await db.api_connections.find_one({"_id": ObjectId(id)})
            if existing and existing.get("cake_details"):
                update_data["cake_details"]["api_key"] = existing["cake_details"]["api_key"]
        else:
            update_data["cake_details"]["api_key"] = encrypt_field(update_data["cake_details"]["api_key"])
            
    if update_data.get("ringba_details"):
        if update_data["ringba_details"].get("api_token") == "****":
            existing = await db.api_connections.find_one({"_id": ObjectId(id)})
            if existing and existing.get("ringba_details"):
                update_data["ringba_details"]["api_token"] = existing["ringba_details"]["api_token"]
        else:
            update_data["ringba_details"]["api_token"] = encrypt_field(update_data["ringba_details"]["api_token"])
    
    if update_data.get("is_active"):
        # Get target connection to know its type
        target = await db.api_connections.find_one({"_id": ObjectId(id)})
        if not target:
            raise HTTPException(status_code=404, detail="Connection not found")
        # Deactivate others of same type
        await db.api_connections.update_many(
            {"_id": {"$ne": ObjectId(id)}, "type": target["type"]}, 
            {"$set": {"is_active": False}}
        )
        
    result = await db.api_connections.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    updated_connection = await db.api_connections.find_one({"_id": ObjectId(id)})
    return updated_connection

@router.delete("/connections/{id}")
async def delete_api_connection(id: str, user: User = Depends(get_current_admin)):
    result = await db.api_connections.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"message": "Connection deleted"}

@router.post("/connections/{id}/activate")
async def activate_api_connection(id: str, user: User = Depends(get_current_admin)):
    connection = await db.api_connections.find_one({"_id": ObjectId(id)})
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    # Deactivate all of same type
    await db.api_connections.update_many({"type": connection["type"]}, {"$set": {"is_active": False}})
    
    # Activate target
    await db.api_connections.update_one({"_id": ObjectId(id)}, {"$set": {"is_active": True}})
    
    return {"message": f"{connection['type']} connection activated"}
