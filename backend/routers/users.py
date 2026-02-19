from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import User, UserUpdate
from auth import get_current_user, get_password_hash

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    # current_user is already a User object from get_current_user
    return current_user

@router.put("/me", response_model=User)
async def update_user_me(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    existing_user_data = await db.users.find_one({"username": current_user.username})
    if not existing_user_data:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    
    if "password" in update_data:
        password = update_data.pop("password")
        update_data["hashed_password"] = get_password_hash(password)
        
    if update_data:
        # Check if full_name is being updated
        if "full_name" in update_data:
            old_name = existing_user_data.get("full_name")
            new_name = update_data["full_name"]
            
            # If name actually changed and old name existed
            if old_name and new_name and old_name != new_name:
                # Update all signups that referred to the old name
                await db.signups.update_many(
                    {"companyInfo.referral": old_name},
                    {"$set": {"companyInfo.referral": new_name}}
                )

        await db.users.update_one(
            {"username": current_user.username},
            {"$set": update_data}
        )
        
    # Return updated user
    updated_user_data = await db.users.find_one({"username": current_user.username})
    return User(**updated_user_data)
