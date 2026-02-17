from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://127.0.0.1:27017"
    DATABASE_NAME: str = "vellko_affiliate"
    SECRET_KEY: str # Required, no default for security in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Cake Marketing
    CAKE_API_KEY: str = ""
    CAKE_API_URL: str = "https://demo-new.cakemarketing.com/api/4/signup.asmx/Affiliate"
    CAKE_API_V2_URL: str = "https://demo-new.cakemarketing.com/api/2/addedit.asmx/Affiliate"
    CAKE_API_OFFERS_URL: str = "https://demo-new.cakemarketing.com/api/7/export.asmx/SiteOffers"
    CAKE_API_MEDIA_TYPES_URL: str = "https://demo-new.cakemarketing.com/api/1/signup.asmx/GetMediaTypes"
    
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

settings = Settings()

client = AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

async def get_database():
    return db
