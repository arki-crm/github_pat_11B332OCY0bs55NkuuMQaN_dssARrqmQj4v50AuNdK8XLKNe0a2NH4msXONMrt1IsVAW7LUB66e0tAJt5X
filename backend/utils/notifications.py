"""Notification utilities"""

import uuid
from datetime import datetime, timezone

# These will be set by the main app
db = None

def set_db(database):
    global db
    db = database


async def create_notification(user_id: str, title: str, message: str, notif_type: str, link_url: str = None):
    """Create a notification for a user"""
    notification = {
        "id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "link_url": link_url,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification


async def notify_users(user_ids: list, title: str, message: str, notif_type: str, link_url: str = None):
    """Send notification to multiple users"""
    for user_id in user_ids:
        if user_id:
            await create_notification(user_id, title, message, notif_type, link_url)


async def get_relevant_users_for_project(project: dict):
    """Get admins, managers, and project collaborators"""
    user_ids = set()
    
    # Add collaborators
    for collab_id in project.get("collaborators", []):
        user_ids.add(collab_id)
    
    # Add all admins and managers
    admins_managers = await db.users.find(
        {"role": {"$in": ["Admin", "Manager"]}, "status": "Active"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    for user in admins_managers:
        user_ids.add(user["user_id"])
    
    return list(user_ids)


async def get_relevant_users_for_lead(lead: dict):
    """Get admins, managers, presales assigned, and designer"""
    user_ids = set()
    
    # Add assigned presales
    if lead.get("assigned_to"):
        user_ids.add(lead["assigned_to"])
    
    # Add designer if assigned
    if lead.get("designer_id"):
        user_ids.add(lead["designer_id"])
    
    # Add all admins and managers
    admins_managers = await db.users.find(
        {"role": {"$in": ["Admin", "Manager"]}, "status": "Active"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    for user in admins_managers:
        user_ids.add(user["user_id"])
    
    return list(user_ids)
