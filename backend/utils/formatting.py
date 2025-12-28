"""Formatting utilities"""

from datetime import datetime


def format_datetime(dt):
    """Format datetime to ISO string"""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt) if dt else None


def format_user_response(user_doc):
    """Format user document for API response"""
    return {
        "user_id": user_doc.get("user_id"),
        "email": user_doc.get("email"),
        "name": user_doc.get("name"),
        "picture": user_doc.get("picture"),
        "role": user_doc.get("role", "Designer"),
        "phone": user_doc.get("phone"),
        "status": user_doc.get("status", "Active"),
        "created_at": format_datetime(user_doc.get("created_at")),
        "updated_at": format_datetime(user_doc.get("updated_at")),
        "last_login": format_datetime(user_doc.get("last_login"))
    }
