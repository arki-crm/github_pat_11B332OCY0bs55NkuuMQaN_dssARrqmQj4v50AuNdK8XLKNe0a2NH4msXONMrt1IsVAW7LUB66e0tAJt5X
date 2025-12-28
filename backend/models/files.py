"""Files, Notes, and Collaborators Pydantic models"""

from pydantic import BaseModel
from typing import Optional


class FileUpload(BaseModel):
    file_name: str
    file_url: str
    file_type: str  # "image", "pdf", "doc", "other"


class FileItem(BaseModel):
    id: str
    file_name: str
    file_url: str
    file_type: str
    uploaded_by: str
    uploaded_by_name: str
    uploaded_at: str


class NoteCreate(BaseModel):
    title: str
    content: str = ""


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class NoteItem(BaseModel):
    id: str
    title: str
    content: str
    created_by: str
    created_by_name: str
    created_at: str
    updated_at: str


class CollaboratorAdd(BaseModel):
    user_id: str
