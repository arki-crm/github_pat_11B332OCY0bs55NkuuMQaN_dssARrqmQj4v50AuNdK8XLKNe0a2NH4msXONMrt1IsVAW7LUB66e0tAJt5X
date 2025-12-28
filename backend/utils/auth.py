"""Authentication utilities"""

from fastapi import HTTPException, Request
from datetime import datetime, timezone

# These will be set by the main app
db = None

def set_db(database):
    global db
    db = database

async def get_current_user(request: Request):
    """Get current user from session token (cookie or header)"""
    from models.user import User
    
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone handling
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Handle datetime conversion
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    elif user_doc.get("created_at") is None:
        user_doc["created_at"] = datetime.now(timezone.utc)
    
    return User(**user_doc)


async def require_admin(request: Request):
    """Require admin role"""
    user = await get_current_user(request)
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
