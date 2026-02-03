import asyncio
from database import db

async def disable_2fa_admin():
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {"is_two_factor_enabled": False, "two_factor_secret": None}}
    )
    print(f"Modified count: {result.modified_count}")

if __name__ == "__main__":
    asyncio.run(disable_2fa_admin())
