from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routers import public, users, admin, two_factor, offers, shared_offers
from database import settings

app = FastAPI(title="Vellko Affiliate Dashboard API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    settings.FRONTEND_URL, # Dynamic frontend URL from env
    "*", # Keep strict * allow for now or remove if strict security needed, but user wanted it working.
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(users.router)
app.include_router(admin.router)
from routers import settings as settings_router
app.include_router(settings_router.router)
app.include_router(two_factor.router, prefix="/auth/2fa", tags=["2FA"])
app.include_router(offers.router)
app.include_router(shared_offers.router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
async def root():
    return {"message": "Vellko Affiliate API is running (UPDATED)"}

