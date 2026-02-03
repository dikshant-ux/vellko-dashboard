
import asyncio
from database import db
from auth import get_password_hash
from models import UserRole

async def seed():
    # Create Admin
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        print("Creating admin user...")
        await db.users.insert_one({
            "username": "admin",
            "full_name": "System Admin",
            "email": "admin@vellko.com",
            "role": UserRole.ADMIN,
            "disabled": False,
            "hashed_password": get_password_hash("admin123")
        })
    else:
        print("Admin user already exists.")

    # Create Referral Partner
    partner_user = await db.users.find_one({"username": "partner1"})
    if not partner_user:
        print("Creating partner user...")
        await db.users.insert_one({
            "username": "partner1",
            "full_name": "John Doe Partner",
            "email": "partner1@vellko.com",
            "role": UserRole.USER,
            "disabled": False,
            "hashed_password": get_password_hash("partner123")
        })
    else:
        print("Partner user already exists.")
        
    print("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed())
