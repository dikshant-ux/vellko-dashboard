from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routers import public, users, admin, two_factor

app = FastAPI(title="Vellko Affiliate Dashboard API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "*", # Temporary debug for CORS
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
app.include_router(two_factor.router, prefix="/auth/2fa", tags=["2FA"])

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
async def root():
    return {"message": "Vellko Affiliate API is running (UPDATED)"}

