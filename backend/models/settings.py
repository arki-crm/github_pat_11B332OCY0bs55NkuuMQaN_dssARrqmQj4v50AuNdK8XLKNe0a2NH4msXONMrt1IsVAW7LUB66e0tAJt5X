"""Settings-related Pydantic models"""

from pydantic import BaseModel
from typing import List, Optional


class CompanySettings(BaseModel):
    name: Optional[str] = "Arkiflo"
    address: Optional[str] = ""
    phone: Optional[str] = ""
    gst: Optional[str] = ""
    website: Optional[str] = ""
    support_email: Optional[str] = ""


class BrandingSettings(BaseModel):
    logo_url: Optional[str] = ""
    primary_color: Optional[str] = "#2563EB"
    secondary_color: Optional[str] = "#64748B"
    theme: Optional[str] = "light"  # light, dark
    favicon_url: Optional[str] = ""
    sidebar_default_collapsed: Optional[bool] = False


class LeadTATSettings(BaseModel):
    bc_call_done: Optional[int] = 1
    boq_shared: Optional[int] = 3
    site_meeting: Optional[int] = 2
    revised_boq_shared: Optional[int] = 2


class ProjectTATSettings(BaseModel):
    design_finalization: Optional[dict] = None
    production_preparation: Optional[dict] = None
    production: Optional[dict] = None
    delivery: Optional[dict] = None
    installation: Optional[dict] = None
    handover: Optional[dict] = None


class StageConfig(BaseModel):
    name: str
    order: int
    enabled: bool = True
    milestones: List[dict] = []


class SystemLog(BaseModel):
    id: str
    action: str
    user_id: str
    user_name: str
    user_role: str
    timestamp: str
    metadata: Optional[dict] = None


class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
