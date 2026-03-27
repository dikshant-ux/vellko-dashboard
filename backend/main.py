from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from routers import public, users, admin, two_factor, offers, shared_offers, call_offers
from database import settings
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Vellko Affiliate Dashboard API")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    settings.FRONTEND_URL, # Dynamic frontend URL from env
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    # Log errors safely
    errors = exc.errors()
    logger.error(f"Validation error: {errors}")
    
    # Return a safe error response by converting non-serializable objects (like bytes)
    def clean_error_response(obj):
        if isinstance(obj, list):
            return [clean_error_response(v) for v in obj]
        if isinstance(obj, dict):
            return {k: clean_error_response(v) for k, v in obj.items()}
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        return str(obj) if not isinstance(obj, (int, float, bool, str, type(None))) else obj

    return JSONResponse(
        status_code=422,
        content={"detail": clean_error_response(errors)},
    )

app.include_router(public.router)
app.include_router(users.router)
app.include_router(admin.router)
from routers import settings as settings_router
app.include_router(settings_router.router)
app.include_router(two_factor.router, prefix="/auth/2fa", tags=["2FA"])
app.include_router(offers.router)
app.include_router(call_offers.router)

app.include_router(shared_offers.router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from routers import qa_forms
app.include_router(qa_forms.router)

from routers import reports as reports_router
app.include_router(reports_router.router)

@app.get("/")
async def root():
    return {"message": "Vellko Affiliate API is running (UPDATED)"}

