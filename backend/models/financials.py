"""Project Financials Pydantic models"""

from pydantic import BaseModel
from typing import List, Optional


class ProjectFinancialsUpdate(BaseModel):
    project_value: Optional[float] = None
    payment_schedule: Optional[List[dict]] = None
    custom_payment_schedule_enabled: Optional[bool] = None
    custom_payment_schedule: Optional[List[dict]] = None


class PaymentCreate(BaseModel):
    amount: float
    mode: str  # Cash, Bank, UPI, Other
    reference: Optional[str] = ""
    date: Optional[str] = None
