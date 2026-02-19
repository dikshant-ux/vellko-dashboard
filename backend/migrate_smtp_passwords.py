"""
One-time migration script to encrypt all existing plaintext SMTP passwords in the database.

Run this ONCE after adding DATA_ENCRYPTION_KEY to your .env file:
    python migrate_smtp_passwords.py

The script is idempotent: it checks each password and skips already-encrypted ones.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
import base64
import hashlib


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://127.0.0.1:27017"
    DATABASE_NAME: str = "vellko_affiliate"
    SECRET_KEY: str
    DATA_ENCRYPTION_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()


def get_smtp_fernet_key() -> bytes:
    key_source = settings.DATA_ENCRYPTION_KEY if settings.DATA_ENCRYPTION_KEY else settings.SECRET_KEY
    key = hashlib.sha256(key_source.encode()).digest()
    return base64.urlsafe_b64encode(key)


def encrypt_smtp_password(value: str) -> str:
    from cryptography.fernet import Fernet
    if not value:
        return ""
    f = Fernet(get_smtp_fernet_key())
    return f.encrypt(value.encode()).decode()


def is_already_encrypted(value: str) -> bool:
    """Attempt to decrypt; if it succeeds it's already encrypted."""
    from cryptography.fernet import Fernet, InvalidToken
    if not value:
        return False
    try:
        f = Fernet(get_smtp_fernet_key())
        f.decrypt(value.encode())
        return True  # Successfully decrypted — already encrypted
    except (InvalidToken, Exception):
        return False  # Was plaintext


async def migrate():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    cursor = db.smtp_configs.find({})
    configs = await cursor.to_list(length=None)

    updated = 0
    skipped = 0

    for config in configs:
        password = config.get("password", "")
        config_id = config["_id"]

        if not password:
            skipped += 1
            continue

        if is_already_encrypted(password):
            print(f"  [SKIP] Config '{config.get('name', config_id)}' — already encrypted.")
            skipped += 1
            continue

        encrypted = encrypt_smtp_password(password)
        await db.smtp_configs.update_one(
            {"_id": config_id},
            {"$set": {"password": encrypted}}
        )
        print(f"  [OK]   Config '{config.get('name', config_id)}' — password encrypted.")
        updated += 1

    print(f"\nMigration complete. {updated} encrypted, {skipped} skipped.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
