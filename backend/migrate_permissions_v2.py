import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "vellko_affiliate")

async def migrate_permissions():
    print(f"Connecting to MongoDB at {MONGODB_URL}...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    users_collection = db.users
    
    print("Fetching all users...")
    users = await users_collection.find({}).to_list(length=None)
    print(f"Found {len(users)} users.")
    
    updated_count = 0
    for user in users:
        username = user.get("username")
        # Legacy field check
        can_approve_signups = user.get("can_approve_signups", True)
        
        # New fields (only set if not already present or if we want to force align)
        # For a clean migration, we align with the legacy field.
        new_permissions = {
            "can_approve_cake": can_approve_signups,
            "can_approve_ringba": can_approve_signups,
            "can_request_cake": can_approve_signups,
            "can_request_ringba": can_approve_signups
        }
        
        result = await users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": new_permissions}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            print(f"Updated permissions for user: {username} (Legacy: {can_approve_signups})")
        else:
            # Maybe already have them? Or no change needed.
            print(f"No changes needed for user: {username}")
            
    print(f"\nMigration complete. Total users updated: {updated_count}")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_permissions())
