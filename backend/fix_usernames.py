import asyncio
from database import db
from models import User

async def fix_usernames():
    print("Scanning for users with trailing/leading whitespace...")
    try:
        cursor = db.users.find({})
        users = await cursor.to_list(length=1000)
        
        count = 0
        for u in users:
            username = u.get('username')
            if username and (username.strip() != username):
                clean_username = username.strip()
                print(f"Fixing '{username}' -> '{clean_username}'")
                await db.users.update_one(
                    {"_id": u["_id"]},
                    {"$set": {"username": clean_username}}
                )
                count += 1
        
        print(f"Fixed {count} users.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_usernames())
