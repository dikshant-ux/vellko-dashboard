import asyncio
from database import db
from auth import get_password_hash
from models import UserInDB, UserRole

async def create_admin():
    username = "admin12"
    password = "password123"
    
    existing = await db.users.find_one({"username": username})
    if existing:
        print("Admin already exists")
        return

    admin_user = {
        "username": username,
        "hashed_password": get_password_hash(password),
        "email": "admin2@example.com",
        "full_name": "Super Admin",
        "role": UserRole.SUPER_ADMIN,
        "disabled": False
    }
    
    await db.users.insert_one(admin_user)
    print(f"Created admin user: {username} / {password}")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    loop.run_until_complete(create_admin())
