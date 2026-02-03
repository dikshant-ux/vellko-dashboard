import asyncio
from database import db
import pprint

async def check_user():
    # Find the user (assuming 'admin' or the last created user)
    # We'll list all users to be sure
    cursor = db.users.find({})
    async for user in cursor:
        print(f"User: {user.get('username')}")
        print(f"  is_two_factor_enabled: {user.get('is_two_factor_enabled')}")
        print(f"  two_factor_secret: {user.get('two_factor_secret')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_user())
