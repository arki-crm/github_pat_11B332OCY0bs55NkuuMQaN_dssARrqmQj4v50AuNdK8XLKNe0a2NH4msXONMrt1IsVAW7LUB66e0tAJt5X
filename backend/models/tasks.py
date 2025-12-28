"""Task-related Pydantic models"""

from pydantic import BaseModel
from typing import Optional


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: Optional[str] = None  # None for standalone tasks
    assigned_to: str
    priority: str = "Medium"  # Low, Medium, High
    due_date: str


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
