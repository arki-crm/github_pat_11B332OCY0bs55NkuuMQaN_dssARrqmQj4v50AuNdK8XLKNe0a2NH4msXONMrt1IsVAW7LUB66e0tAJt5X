"""Project-related Pydantic models"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str
    project_name: str
    client_name: str
    client_phone: str
    stage: str  # "Pre 10%", "10-50%", "50-100%", "Completed"
    collaborators: List[str] = []  # List of user_ids
    summary: str
    updated_at: datetime
    created_at: datetime


class ProjectResponse(BaseModel):
    project_id: str
    project_name: str
    client_name: str
    client_phone: str
    stage: str
    collaborators: List[dict] = []  # Will include user details
    summary: str
    updated_at: str
    created_at: str


class ProjectCreate(BaseModel):
    project_name: str
    client_name: str
    client_phone: str
    stage: str = "Design Finalization"
    collaborators: List[str] = []
    summary: str = ""


class TimelineItem(BaseModel):
    id: str
    title: str
    date: str
    status: str  # "pending", "completed", "delayed"


class CommentItem(BaseModel):
    id: str
    user_id: str
    user_name: str
    role: str
    message: str
    is_system: bool = False
    created_at: str


class CommentCreate(BaseModel):
    message: str


class StageUpdate(BaseModel):
    stage: str
