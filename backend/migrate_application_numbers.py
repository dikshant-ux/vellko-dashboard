import asyncio
from database import db

async def migrate():
    # Find all signups sorted by creation date ascending
    cursor = db.signups.find({}).sort("created_at", 1)
    signups = await cursor.to_list(length=None)
    
    if not signups:
        print("No signups found.")
        return

    # Initialize counter starting from 0
    current_seq = 0
    
    # Process each signup in order
    for signup in signups:
        current_seq += 1
        app_num = f"VK-{current_seq}"
        print(f"Assigning {app_num} to signup: {signup['_id']}")
        await db.signups.update_one(
            {"_id": signup["_id"]},
            {"$set": {"application_number": app_num}}
        )

    # Update the counters collection to the highest sequence
    print(f"Setting signup_application_number sequence to {current_seq}")
    await db.counters.update_one(
        {"_id": "signup_application_number"},
        {"$set": {"seq": current_seq}},
        upsert=True
    )
    
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
