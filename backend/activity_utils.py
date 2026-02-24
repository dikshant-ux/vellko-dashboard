from datetime import datetime
from typing import Optional, Union
from fastapi import Request
from database import db
from models import ActivityLog

async def log_activity(
    username: str,
    action: str,
    details: str,
    api_type: Optional[str] = None,
    target_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    request: Optional[Request] = None
):
    """
    Log a user activity to the user_activities collection.
    This is designed to be non-blocking and safe to call from any route.
    """
    if request and not ip_address:
        # Check X-Forwarded-For for public IP if behind a proxy
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None

    try:
        activity = ActivityLog(
            username=username,
            action=action,
            details=details,
            api_type=api_type,
            target_id=target_id,
            ip_address=ip_address,
            timestamp=datetime.utcnow()
        )
        # Using the new collection user_activities to avoid migrations
        await db.user_activities.insert_one(activity.dict(by_alias=True, exclude_none=True))
    except Exception as e:
        # Logging error to console to avoid crashing the main request flow
        print(f"CRITICAL: Failed to log activity for {username}: {e}")
