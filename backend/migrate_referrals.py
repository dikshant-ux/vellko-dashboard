import asyncio
from database import db
from models import User, SignupInDB
from bson import ObjectId

async def migrate_referrals():
    print("Starting referral migration...")
    
    # Get all users to create a lookup map (Name -> ID)
    # Also map username as a fallback if full_name is missing or ambiguous
    users_cursor = db.users.find({})
    users = await users_cursor.to_list(length=10000)
    
    name_to_id = {}
    for user in users:
        uid = str(user["_id"])
        if user.get("full_name"):
            name_to_id[user["full_name"]] = uid
        if user.get("username"):
            name_to_id[user["username"]] = uid # Fallback
            
    print(f"Loaded {len(users)} users for lookup.")

    # Find signups that have a referral name but NO referral_id
    query = {
        "companyInfo.referral": {"$ne": "", "$exists": True},
        "$or": [
            {"companyInfo.referral_id": {"$exists": False}},
            {"companyInfo.referral_id": None},
            {"companyInfo.referral_id": ""}
        ]
    }
    
    signups_cursor = db.signups.find(query)
    signups = await signups_cursor.to_list(length=10000)
    
    print(f"Found {len(signups)} signups to migrate.")
    
    updated_count = 0
    skipped_count = 0
    
    for signup in signups:
        referral_name = signup.get("companyInfo", {}).get("referral")
        
        if not referral_name:
            skipped_count += 1
            continue
            
        # Try to find user ID
        # Exact match
        matched_id = name_to_id.get(referral_name)
        
        if matched_id:
            await db.signups.update_one(
                {"_id": signup["_id"]},
                {"$set": {"companyInfo.referral_id": matched_id}}
            )
            updated_count += 1
            print(f"Updated signup {signup['_id']}: {referral_name} -> {matched_id}")
        else:
            print(f"Skipping signup {signup['_id']}: Referral '{referral_name}' not found in users.")
            skipped_count += 1

    print(f"Migration complete. Updated: {updated_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    loop.run_until_complete(migrate_referrals())
