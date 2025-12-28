"""Settings utilities"""

import uuid
from datetime import datetime, timezone

# These will be set by the main app
db = None

def set_db(database):
    global db
    db = database


async def log_system_action(action: str, user, metadata: dict = None):
    """Log a system action"""
    log_entry = {
        "id": f"log_{uuid.uuid4().hex[:8]}",
        "action": action,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_role": user.role,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {}
    }
    await db.system_logs.insert_one(log_entry)
    return log_entry


async def get_settings(key: str, default_value: dict):
    """Get settings by key"""
    settings = await db.settings.find_one({"key": key}, {"_id": 0})
    if settings:
        return settings.get("value", default_value)
    return default_value


async def save_settings(key: str, value: dict, user):
    """Save settings with logging"""
    await db.settings.update_one(
        {"key": key},
        {"$set": {"value": value, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    await log_system_action(f"Updated {key} settings", user)
