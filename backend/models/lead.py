"""Lead-related Pydantic models"""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime


class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_id: str
    customer_name: str
    customer_phone: str
    source: str  # "Meta", "Walk-in", "Referral", "Others"
    status: str  # "New", "Contacted", "Waiting", "Qualified", "Dropped"
    stage: str  # Lead stages
    assigned_to: Optional[str] = None  # Pre-sales user ID
    designer_id: Optional[str] = None  # Designer user ID
    is_converted: bool = False
    project_id: Optional[str] = None  # If converted to project
    timeline: List[dict] = []
    comments: List[dict] = []
    updated_at: datetime
    created_at: datetime


class LeadCreate(BaseModel):
    customer_name: str
    customer_phone: str
    source: str = "Others"
    status: str = "New"


class LeadStageUpdate(BaseModel):
    stage: str


class LeadAssignDesigner(BaseModel):
    designer_id: str
