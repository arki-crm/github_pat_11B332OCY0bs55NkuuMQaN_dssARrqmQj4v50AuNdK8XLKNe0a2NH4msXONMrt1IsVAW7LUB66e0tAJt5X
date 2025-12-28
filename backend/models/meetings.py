"""Meeting-related Pydantic models"""

from pydantic import BaseModel
from typing import Optional


class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: Optional[str] = None
    lead_id: Optional[str] = None
    scheduled_for: str  # userId (designer)
    date: str
    start_time: str
    end_time: str
    location: Optional[str] = ""


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    lead_id: Optional[str] = None
    scheduled_for: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
