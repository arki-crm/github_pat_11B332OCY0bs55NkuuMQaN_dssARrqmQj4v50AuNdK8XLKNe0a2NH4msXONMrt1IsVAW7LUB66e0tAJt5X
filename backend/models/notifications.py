"""Notification-related Pydantic models"""

from pydantic import BaseModel
from typing import Optional


class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str  # "stage-change" | "task" | "milestone" | "comment" | "system"
    link_url: Optional[str] = None


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None
