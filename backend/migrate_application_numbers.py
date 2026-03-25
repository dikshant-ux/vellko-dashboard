import asyncio
from database import db

async def migrate():
    # Find all signups sorted by creation date ascending
    cursor = db.signups.find({}).sort("created_at", 1)
    signups = await cursor.to_list(length=None)
    
    if not signups:
        print("No signups found.")
        return

    # Initialize counter starting from 10000
    current_seq = 10000
    
    # Process each signup in order
    for signup in signups:
        if not signup.get("application_number"):
            current_seq += 1
            app_num = f"VK-{current_seq:05d}"
            print(f"Assigning {app_num} to signup: {signup['_id']}")
            await db.signups.update_one(
                {"_id": signup["_id"]},
                {"$set": {"application_number": app_num}}
            )
        else:
            print(f"Skipping {signup['_id']}, already has app number: {signup['application_number']}")
            
            # Extract sequence number if possible to ensure our counter stays ahead
            app_num = signup["application_number"]
            if app_num.startswith("VK-"):
                try:
                    seq_val = int(app_num.split("-")[1])
                    if seq_val > current_seq:
                        current_seq = seq_val
                except ValueError:
                    pass

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
