from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://127.0.0.1:27017"
    DATABASE_NAME: str = "vellko_affiliate"
    SECRET_KEY: str # Required, no default for security in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # SECURITY: Separate encryption key for DB secrets (SMTP passwords, etc.).
    # Set this in .env to a long random string. Defaults to SECRET_KEY if not set (backward compat).
    DATA_ENCRYPTION_KEY: str = ""
    
    # Cake Marketing
    CAKE_API_KEY: str = ""
    CAKE_API_URL: str = "https://demo-new.cakemarketing.com/api/4/signup.asmx/Affiliate"
    CAKE_API_V2_URL: str = "https://demo-new.cakemarketing.com/api/2/addedit.asmx/Affiliate"
    CAKE_API_OFFERS_URL: str = "https://demo-new.cakemarketing.com/api/7/export.asmx/SiteOffers"
    CAKE_API_MEDIA_TYPES_URL: str = "https://demo-new.cakemarketing.com/api/1/signup.asmx/GetMediaTypes"
    CAKE_API_VERTICALS_URL: str = "https://demo-new.cakemarketing.com/api/2/get.asmx/Verticals"
    
    # SMTP Settings
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    
    # Frontend URL for links (Public)
    FRONTEND_URL: str = "http://localhost:3000"

    # Ringba Settings
    RINGBA_API_URL: str = "https://api.ringba.com/v2"
    RINGBA_API_TOKEN: str = ""
    RINGBA_ACCOUNT_ID: str = ""

    class Config:
        env_file = ".env"
        # Determine extra handling if .env has extra/missing (default is ignore extras)

import httpx
from datetime import datetime, timedelta

settings = Settings()

client = AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

# Connection Pooling
http_client = httpx.AsyncClient(timeout=30.0)

# Local caching for connections to avoid DB lookups on every request
_connection_cache = {}
CACHE_TTL = 300 # 5 minutes

async def get_database():
    return db

def decrypt_if_needed(val: str) -> str:
    from encryption_utils import decrypt_field
    return decrypt_field(val)

async def get_active_cake_connection():
    now = datetime.now()
    if "cake" in _connection_cache:
        expiry = _connection_cache["cake"]["expiry"]
        if now < expiry:
            return _connection_cache["cake"]["data"]

    connection = await db.api_connections.find_one({"type": "CAKE", "is_active": True})
    if connection:
        details = connection.get("cake_details", {})
        # Ensure new keys are present even for old connections
        if "api_verticals_url" not in details:
            details["api_verticals_url"] = settings.CAKE_API_VERTICALS_URL
        if "api_offers_url" not in details:
            details["api_offers_url"] = settings.CAKE_API_OFFERS_URL
        if "api_media_types_url" not in details:
            details["api_media_types_url"] = settings.CAKE_API_MEDIA_TYPES_URL
            
        if details.get("api_key"):
            details["api_key"] = decrypt_if_needed(details["api_key"])
        
        _connection_cache["cake"] = {
            "data": details,
            "expiry": now + timedelta(seconds=CACHE_TTL)
        }
        return details
        
    default_details = {
        "api_key": settings.CAKE_API_KEY,
        "api_url": settings.CAKE_API_URL,
        "api_v2_url": settings.CAKE_API_V2_URL,
        "api_offers_url": settings.CAKE_API_OFFERS_URL,
        "api_media_types_url": settings.CAKE_API_MEDIA_TYPES_URL,
        "api_verticals_url": settings.CAKE_API_VERTICALS_URL
    }
    _connection_cache["cake"] = {
        "data": default_details,
        "expiry": now + timedelta(seconds=CACHE_TTL)
    }
    return default_details

async def get_active_ringba_connection():
    connection = await db.api_connections.find_one({"type": "RINGBA", "is_active": True})
    if connection:
        details = connection.get("ringba_details", {})
        if details.get("api_token"):
            details["api_token"] = decrypt_if_needed(details["api_token"])
        return details
    return {
        "api_token": settings.RINGBA_API_TOKEN,
        "api_url": settings.RINGBA_API_URL,
        "account_id": settings.RINGBA_ACCOUNT_ID
    }
