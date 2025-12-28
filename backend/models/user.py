"""User-related Pydantic models"""

from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "Designer"  # Admin, PreSales, Designer, Manager, Trainee
    phone: Optional[str] = None
    status: str = "Active"  # Active, Inactive
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    phone: Optional[str] = None
    status: str = "Active"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_login: Optional[str] = None


class UserInvite(BaseModel):
    name: str
    email: str
    role: str
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    picture: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    picture: Optional[str] = None


class SessionRequest(BaseModel):
    session_id: str


class RoleUpdateRequest(BaseModel):
    role: str
