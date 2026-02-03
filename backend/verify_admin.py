import asyncio
from database import db
from auth import get_password_hash, verify_password
from models import UserInDB

async def check_admin():
    username = "admin"
    password = "password123"
    
    print(f"Checking for user: {username}")
    user_data = await db.users.find_one({"username": username})
    
    if not user_data:
        print("ERROR: Admin user NOT found in database.")
        print("Attempting to create admin user now...")
        admin_user = {
            "username": username,
            "hashed_password": get_password_hash(password),
            "email": "admin@example.com",
            "full_name": "Super Admin",
            "role": "ADMIN",
            "disabled": False
        }
        await db.users.insert_one(admin_user)
        print("Admin user created successfully.")
    else:
        print("Admin user FOUND.")
        user = UserInDB(**user_data)
        print(f"Stored Hash: {user.hashed_password}")
        
        is_valid = verify_password(password, user.hashed_password)
        print(f"Password '{password}' valid? {is_valid}")
        
        if not is_valid:
            print("Password invalid. Resetting password...")
            new_hash = get_password_hash(password)
            await db.users.update_one(
                {"username": username},
                {"$set": {"hashed_password": new_hash}}
            )
            print("Password reset to 'password123'.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    loop.run_until_complete(check_admin())
