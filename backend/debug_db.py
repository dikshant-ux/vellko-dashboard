import asyncio
from database import db
from models import User

async def list_users():
    print("Connecting to DB...")
    # Trigger connection if needed (db module usually connects on import or first use depending on setup)
    # Assuming db.users is effectively a collection object from motor
    
    try:
        cursor = db.users.find({})
        users = await cursor.to_list(length=100)
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"Username: '{u.get('username')}', Email: '{u.get('email')}', Role: '{u.get('role')}'")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_users())
