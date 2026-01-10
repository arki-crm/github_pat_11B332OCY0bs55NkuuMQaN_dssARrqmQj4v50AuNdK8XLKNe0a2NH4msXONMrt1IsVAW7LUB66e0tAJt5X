from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import aiofiles
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# File upload directory for Academy
UPLOADS_DIR = ROOT_DIR / "uploads" / "academy"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file extensions for Academy uploads
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB max for videos

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ MODELS ============

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
    senior_manager_view: Optional[bool] = False  # V1 permission toggle

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    picture: Optional[str] = None
    senior_manager_view: Optional[bool] = None  # V1 permission toggle

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    picture: Optional[str] = None

class SessionRequest(BaseModel):
    session_id: str

class LocalLoginRequest(BaseModel):
    email: str
    password: str

class RoleUpdateRequest(BaseModel):
    role: str

# ============ LOCAL AUTH HELPERS ============

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = "arkiflo_local_salt_2024"  # Fixed salt for simplicity
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

# ============ PROJECT MODELS ============

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str
    project_name: str
    client_name: str
    client_phone: str
    stage: str  # "Pre 10%", "10-50%", "50-100%", "Completed"
    collaborators: List[str] = []  # List of user_ids
    summary: str
    # Hold/Activate/Deactivate system
    hold_status: str = "Active"  # "Active", "Hold", "Deactivated"
    hold_history: List[dict] = []  # History of status changes with reasons
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

# ============ FILES, NOTES, COLLABORATORS MODELS ============

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

# ============ LEAD MODELS ============

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_id: str
    pid: Optional[str] = None  # Project ID (ARKI-PID-XXXXX) - generated when converted from Pre-Sales
    # Customer Details (persistent across all stages)
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_requirements: Optional[str] = None  # Brief/Requirements
    source: str  # "Meta", "Walk-in", "Referral", "Others"
    budget: Optional[float] = None  # Customer budget
    # Lead Status & Stage
    status: str  # "New", "Contacted", "Waiting", "Qualified", "Dropped"
    stage: str  # Lead stages
    assigned_to: Optional[str] = None  # Pre-sales user ID
    designer_id: Optional[str] = None  # Designer user ID
    is_converted: bool = False
    project_id: Optional[str] = None  # If converted to project
    # Hold/Activate/Deactivate system
    hold_status: str = "Active"  # "Active", "Hold", "Deactivated"
    hold_history: List[dict] = []  # History of status changes with reasons
    timeline: List[dict] = []
    comments: List[dict] = []
    files: List[dict] = []  # Files attached to lead
    collaborators: List[dict] = []  # Collaborators with details
    updated_at: datetime
    created_at: datetime

class LeadCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_requirements: Optional[str] = None
    source: str = "Others"
    budget: Optional[float] = None
    status: str = "In Progress"
    assigned_to: Optional[str] = None  # For direct lead creation

class LeadUpdate(BaseModel):
    """For updating customer details - respects role-based permissions"""
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_requirements: Optional[str] = None
    source: Optional[str] = None
    budget: Optional[float] = None

class LeadStageUpdate(BaseModel):
    stage: str

class LeadAssignDesigner(BaseModel):
    designer_id: str

# ============ HOLD/ACTIVATE/DEACTIVATE MODELS ============

class HoldStatusUpdate(BaseModel):
    action: str  # "Hold", "Activate", "Deactivate"
    reason: str

# ============ WARRANTY & SERVICE REQUEST MODELS ============

class Warranty(BaseModel):
    model_config = ConfigDict(extra="ignore")
    warranty_id: str
    pid: str
    project_id: str
    project_name: str
    customer_name: str
    customer_address: Optional[str] = None
    customer_phone: str
    customer_email: Optional[str] = None
    handover_date: str
    warranty_start_date: str
    warranty_end_date: str  # handover_date + 10 years
    warranty_status: str = "Active"  # Active, Expired, Voided
    warranty_book_url: Optional[str] = None
    vendor_warranty_files: List[dict] = []  # [{name, url, uploaded_at}]
    materials_list: List[str] = []
    modules_list: List[str] = []
    service_requests: List[str] = []  # List of service_request_ids
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class WarrantyCreate(BaseModel):
    warranty_book_url: Optional[str] = None
    vendor_warranty_files: Optional[List[dict]] = []
    materials_list: Optional[List[str]] = []
    modules_list: Optional[List[str]] = []
    notes: Optional[str] = None

# Service Request Stages (9 steps - forward-only)
SERVICE_REQUEST_STAGES = [
    "New",
    "Assigned to Technician",
    "Technician Visit Scheduled",
    "Technician Visited",
    "Spare Parts Required",
    "Waiting for Spares",
    "Work In Progress",
    "Completed",
    "Closed"
]

# Service Request Issue Categories
SERVICE_ISSUE_CATEGORIES = [
    "Hardware Issue",
    "Fitting Issue",
    "Surface Damage",
    "Hinge/Drawer Problem",
    "Water Damage",
    "Electrical Issue",
    "Door Alignment",
    "Soft-close Issue",
    "General Maintenance",
    "Other"
]

# Delay Reasons
SERVICE_DELAY_REASONS = [
    "Customer not available",
    "Spare not received",
    "Workmanship not available",
    "Technician not available",
    "Vendor delay",
    "Factory delay",
    "Revisit required",
    "Complex repair",
    "Weather issue",
    "Other"
]

# Delay Owners
SERVICE_DELAY_OWNERS = [
    "Technician",
    "Vendor",
    "Company",
    "Customer"
]

class ServiceRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    service_request_id: str
    pid: Optional[str] = None  # Can be null for unlinked requests
    warranty_id: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    # Customer info
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    # Issue details
    issue_category: str
    issue_description: str
    issue_images: List[dict] = []  # [{url, uploaded_at, uploaded_by}]
    priority: str = "Medium"  # High, Medium, Low
    warranty_status: str = "Unknown"  # Active, Expired, Unknown
    # Workflow
    stage: str = "New"
    assigned_technician_id: Optional[str] = None
    assigned_technician_name: Optional[str] = None
    # SLA tracking
    sla_visit_by: str  # Auto-generated: created_at + 72 hours
    actual_visit_date: Optional[str] = None
    expected_closure_date: Optional[str] = None  # Set by technician after inspection
    actual_closure_date: Optional[str] = None
    # Delay tracking
    delay_count: int = 0
    delays: List[dict] = []  # [{reason, owner, notes, new_expected_date, logged_by, logged_at}]
    last_delay_reason: Optional[str] = None
    last_delay_owner: Optional[str] = None
    # Work details
    before_photos: List[dict] = []
    after_photos: List[dict] = []
    technician_notes: List[dict] = []
    spare_parts: List[dict] = []  # [{name, status, ordered_at, received_at}]
    # Activity
    timeline: List[dict] = []
    comments: List[dict] = []
    # Source
    source: str = "Internal"  # Internal, Google Form
    # Timestamps
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ServiceRequestCreate(BaseModel):
    pid: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    issue_category: str
    issue_description: str
    issue_images: Optional[List[dict]] = []
    priority: Optional[str] = "Medium"

class ServiceRequestFromGoogleForm(BaseModel):
    name: str
    phone: str
    pid: Optional[str] = None
    issue_description: str
    image_urls: Optional[List[str]] = []

class ServiceRequestStageUpdate(BaseModel):
    stage: str
    notes: Optional[str] = None

class ServiceRequestAssignTechnician(BaseModel):
    technician_id: str

class ServiceRequestDelayUpdate(BaseModel):
    delay_reason: str
    delay_owner: str
    new_expected_date: str
    notes: Optional[str] = None

class ServiceRequestClosureDate(BaseModel):
    expected_closure_date: str

# ============ ACADEMY MODELS ============

# Default Academy Categories
DEFAULT_ACADEMY_CATEGORIES = [
    {"name": "Pre-Sales Training", "description": "Learn the pre-sales process and qualification techniques", "order": 1, "icon": "user-plus"},
    {"name": "BC (Briefing Call) Training", "description": "Master the briefing call process and client communication", "order": 2, "icon": "phone"},
    {"name": "Sales Training", "description": "Sales techniques and closing strategies", "order": 3, "icon": "target"},
    {"name": "Designer Training", "description": "Design principles, tools, and workflow", "order": 4, "icon": "palette"},
    {"name": "Measurement Training", "description": "Site measurement techniques and best practices", "order": 5, "icon": "ruler"},
    {"name": "Client Handling Training", "description": "Client communication and relationship management", "order": 6, "icon": "users"},
    {"name": "Arki Dots Complete Process Guide", "description": "End-to-end process documentation", "order": 7, "icon": "book-open"}
]

class AcademyCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category_id: str
    name: str
    description: Optional[str] = None
    icon: str = "folder"  # lucide icon name
    order: int = 0
    lesson_count: int = 0
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime

class AcademyCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "folder"
    order: Optional[int] = 0

class AcademyLesson(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lesson_id: str
    category_id: str
    title: str
    description: Optional[str] = None
    content_type: str  # "video", "pdf", "text", "mixed"
    # Content fields
    video_url: Optional[str] = None  # YouTube embed or uploaded file URL
    video_type: Optional[str] = None  # "youtube", "uploaded"
    pdf_url: Optional[str] = None
    text_content: Optional[str] = None  # Rich text/markdown
    images: List[dict] = []  # [{url, caption}]
    # Metadata
    order: int = 0
    duration_minutes: Optional[int] = None  # Estimated reading/watching time
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime

class AcademyLessonCreate(BaseModel):
    category_id: str
    title: str
    description: Optional[str] = None
    content_type: str = "text"
    video_url: Optional[str] = None
    video_type: Optional[str] = None
    pdf_url: Optional[str] = None
    text_content: Optional[str] = None
    images: Optional[List[dict]] = []
    order: Optional[int] = 0
    duration_minutes: Optional[int] = None

class AcademyLessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    video_url: Optional[str] = None
    video_type: Optional[str] = None
    pdf_url: Optional[str] = None
    text_content: Optional[str] = None
    images: Optional[List[dict]] = None
    order: Optional[int] = None
    duration_minutes: Optional[int] = None

# Lead stages
LEAD_STAGES = [
    "BC Call Done",
    "BOQ Shared",
    "Site Meeting",
    "Revised BOQ Shared",
    "Waiting for Booking",
    "Booking Completed"
]

# Lead milestones for timeline
LEAD_MILESTONES = [
    {"title": "Lead Created", "stage_ref": "BC Call Done"},
    {"title": "BC Call Completed", "stage_ref": "BC Call Done"},
    {"title": "BOQ Shared", "stage_ref": "BOQ Shared"},
    {"title": "Site Meeting", "stage_ref": "Site Meeting"},
    {"title": "Revised BOQ Shared", "stage_ref": "Revised BOQ Shared"},
    {"title": "Waiting for Booking", "stage_ref": "Waiting for Booking"},
    {"title": "Booking Completed", "stage_ref": "Booking Completed"}
]

# ============ TAT (Time-to-Action) CONFIGURATION ============

# Lead TAT Rules (days from previous milestone completion)
LEAD_TAT = {
    "Lead Created": 0,  # Immediate
    "BC Call Completed": 1,  # 1 day after lead creation
    "BOQ Shared": 3,  # 3 days after BC Call Done
    "Site Meeting": 2,  # 2 days after BOQ Shared
    "Revised BOQ Shared": 2,  # 2 days after Site Meeting
    "Waiting for Booking": None,  # No fixed date
    "Booking Completed": None  # No fixed date
}

# Project TAT Rules (days from previous milestone completion)
PROJECT_TAT = {
    # Design Finalization
    "Site Measurement": 1,
    "Site Validation": 2,
    "Design Meeting": 3,
    "Design Meeting – 2": 2,
    "Final Design Proposal & Material Selection": 3,
    "Sign-off KWS Units & Payment": 2,
    "Kickoff Meeting": 2,
    # Production Preparation (3 days apart)
    "Factory Slot Allocation": 3,
    "JIT Project Delivery Plan": 3,
    "Non-Modular Dependencies": 3,
    "Raw Material Procurement": 3,
    # Production (4 days apart)
    "Production Kick-start": 4,
    "Full Order Confirmation": 4,
    "PIV / Site Readiness": 4,
    # Delivery (5 days after PIV)
    "Modular Order Delivery at Site": 5,
    # Installation (3 days apart)
    "Modular Installation": 3,
    "Non-Modular Dependency Work for Handover": 3,
    # Handover (2 days apart)
    "Handover with Snag": 2,
    "Cleaning": 2,
    "Handover Without Snag": 2
}

# Stage order for timeline logic - 6 main stages
STAGE_ORDER = [
    "Design Finalization",
    "Production Preparation",
    "Production",
    "Delivery",
    "Installation",
    "Handover"
]

# Default TAT days for substages (used in timeline regeneration)
DEFAULT_TAT_DAYS = {
    "site_measurement": 1,
    "design_meeting_1": 3,
    "design_meeting_2": 2,
    "design_meeting_3": 2,
    "final_design_presentation": 3,
    "material_selection": 2,
    "payment_collection_50": 2,
    "production_drawing_prep": 3,
    "validation_internal": 2,
    "kws_signoff": 2,
    "kickoff_meeting": 2,
    "vendor_mapping": 3,
    "factory_slot_allocation": 3,
    "jit_delivery_plan": 3,
    "non_modular_dependency": 5,
    "raw_material_procurement": 5,
    "production_kickstart": 4,
    "factory_qc": 5,
    "production_ready": 3,
    "payment_collection_45": 2,
    "dispatch_scheduled": 2,
    "installation_team_scheduled": 2,
    "materials_dispatched": 3,
    "delivery_confirmed": 2,
    "final_inspection": 2,
    "cleaning": 1,
    "handover_docs": 1,
    "project_handover": 1,
    "csat": 3,
    "review_video_photos": 2,
    "issue_warranty_book": 1,
    "closed": 1
}

# ============ DESIGN WORKFLOW SYSTEM (Phase 15) ============

# 9-Step Design Workflow Stages (after booking)
DESIGN_WORKFLOW_STAGES = [
    "Measurement Required",
    "Floor Plan Creation", 
    "Floor Plan Meeting",
    "First Design Presentation",
    "Corrections & Second Presentation",
    "Material Selection Meeting",
    "Final Design Lock",
    "Production Drawings Preparation",
    "Validation & Kickoff"
]

# Design workflow stage metadata
DESIGN_STAGE_CONFIG = {
    "Measurement Required": {
        "order": 0,
        "expected_days": 2,
        "auto_tasks": ["Request Site Measurement", "Upload Measurement Files"],
        "notify_roles": ["DesignManager"],
        "required_uploads": ["measurement_file"],
        "next_stage_trigger": "upload_complete"
    },
    "Floor Plan Creation": {
        "order": 1,
        "expected_days": 3,
        "auto_tasks": ["Create Floor Plan", "Review Floor Plan"],
        "notify_roles": ["DesignManager"],
        "required_uploads": ["floor_plan"],
        "next_stage_trigger": "manual"
    },
    "Floor Plan Meeting": {
        "order": 2,
        "expected_days": 2,
        "auto_tasks": ["Schedule Floor Plan Meeting", "Conduct Meeting", "Upload Meeting Notes"],
        "notify_roles": ["DesignManager"],
        "requires_meeting": True,
        "next_stage_trigger": "meeting_complete"
    },
    "First Design Presentation": {
        "order": 3,
        "expected_days": 5,
        "auto_tasks": ["Create 3D/2D Design", "Prepare Presentation", "Schedule Presentation Meeting"],
        "notify_roles": ["DesignManager"],
        "required_uploads": ["design_presentation"],
        "requires_meeting": True,
        "next_stage_trigger": "meeting_complete"
    },
    "Corrections & Second Presentation": {
        "order": 4,
        "expected_days": 4,
        "auto_tasks": ["Apply Client Corrections", "Create Second Version", "Schedule Review Meeting"],
        "notify_roles": ["DesignManager"],
        "required_uploads": ["corrected_design"],
        "requires_meeting": True,
        "next_stage_trigger": "meeting_complete"
    },
    "Material Selection Meeting": {
        "order": 5,
        "expected_days": 2,
        "auto_tasks": ["Prepare Material Options", "Schedule Material Meeting", "Document Material Selection"],
        "notify_roles": ["DesignManager"],
        "requires_meeting": True,
        "next_stage_trigger": "meeting_complete"
    },
    "Final Design Lock": {
        "order": 6,
        "expected_days": 2,
        "auto_tasks": ["Finalize Design", "Get Client Sign-off", "Lock Design Version"],
        "notify_roles": ["DesignManager", "ProductionManager"],
        "required_uploads": ["final_design", "sign_off_document"],
        "next_stage_trigger": "upload_complete"
    },
    "Production Drawings Preparation": {
        "order": 7,
        "expected_days": 5,
        "auto_tasks": ["Create Production Drawings", "Create Cutting List", "Prepare Technical Documents"],
        "notify_roles": ["ProductionManager"],
        "required_uploads": ["production_drawings", "cutting_list"],
        "next_stage_trigger": "upload_complete"
    },
    "Validation & Kickoff": {
        "order": 8,
        "expected_days": 3,
        "auto_tasks": ["Validate Drawings", "Site Validation", "Conduct Kickoff Meeting", "Send to Production"],
        "notify_roles": ["ProductionManager"],
        "requires_validation": True,
        "next_stage_trigger": "validation_complete"
    }
}

# Task templates for auto-task engine
DESIGN_TASK_TEMPLATES = {
    "Request Site Measurement": {
        "description": "Request measurement team to visit site and take measurements",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Upload Measurement Files": {
        "description": "Upload site measurement files after completion",
        "priority": "High", 
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Create Floor Plan": {
        "description": "Create floor plan based on site measurements",
        "priority": "Medium",
        "duration_days": 2,
        "assigned_to_role": "Designer"
    },
    "Review Floor Plan": {
        "description": "Review floor plan for accuracy",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "DesignManager"
    },
    "Schedule Floor Plan Meeting": {
        "description": "Schedule meeting with client to discuss floor plan",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer",
        "creates_meeting": True
    },
    "Conduct Meeting": {
        "description": "Conduct the scheduled meeting",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Upload Meeting Notes": {
        "description": "Upload meeting notes and action items",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Create 3D/2D Design": {
        "description": "Create 3D visualization and 2D drawings for presentation",
        "priority": "High",
        "duration_days": 4,
        "assigned_to_role": "Designer"
    },
    "Prepare Presentation": {
        "description": "Prepare design presentation for client",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Schedule Presentation Meeting": {
        "description": "Schedule design presentation meeting with client",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer",
        "creates_meeting": True
    },
    "Apply Client Corrections": {
        "description": "Apply corrections based on client feedback",
        "priority": "High",
        "duration_days": 2,
        "assigned_to_role": "Designer"
    },
    "Create Second Version": {
        "description": "Create second version of design with corrections",
        "priority": "High",
        "duration_days": 2,
        "assigned_to_role": "Designer"
    },
    "Schedule Review Meeting": {
        "description": "Schedule review meeting with client",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer",
        "creates_meeting": True
    },
    "Prepare Material Options": {
        "description": "Prepare material options and samples for client",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Schedule Material Meeting": {
        "description": "Schedule material selection meeting with client",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer",
        "creates_meeting": True
    },
    "Document Material Selection": {
        "description": "Document final material selections",
        "priority": "Medium",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Finalize Design": {
        "description": "Finalize design with all corrections and material selections",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Get Client Sign-off": {
        "description": "Get client sign-off on final design",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Lock Design Version": {
        "description": "Lock design version and prepare for production",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "DesignManager"
    },
    "Create Production Drawings": {
        "description": "Create detailed production drawings",
        "priority": "High",
        "duration_days": 3,
        "assigned_to_role": "Designer"
    },
    "Create Cutting List": {
        "description": "Create cutting list for production",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Prepare Technical Documents": {
        "description": "Prepare all technical documents for production",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "Designer"
    },
    "Validate Drawings": {
        "description": "Validate production drawings for accuracy",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "ProductionManager"
    },
    "Site Validation": {
        "description": "Validate site readiness for installation",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "ProductionManager"
    },
    "Conduct Kickoff Meeting": {
        "description": "Conduct production kickoff meeting",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "ProductionManager",
        "creates_meeting": True
    },
    "Send to Production": {
        "description": "Send project to production queue",
        "priority": "High",
        "duration_days": 1,
        "assigned_to_role": "ProductionManager"
    }
}

# ============ AUTH HELPERS ============

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone handling
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Handle datetime conversion
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    elif user_doc.get("created_at") is None:
        user_doc["created_at"] = datetime.now(timezone.utc)
    
    return User(**user_doc)

async def require_admin(request: Request) -> User:
    """Require admin role"""
    user = await get_current_user(request)
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/session")
async def create_session(request: SessionRequest, response: Response):
    """Exchange session_id for session_token and create/update user"""
    try:
        # Call Emergent auth API to get user data
        async with httpx.AsyncClient() as client_http:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = auth_response.json()
        
        email = auth_data["email"]
        name = auth_data["name"]
        picture = auth_data.get("picture")
        session_token = auth_data["session_token"]
        
        now = datetime.now(timezone.utc)
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            
            # Check if user is inactive
            if existing_user.get("status") == "Inactive":
                raise HTTPException(status_code=403, detail="Your account is inactive. Please contact an administrator.")
            
            # Update user info and last_login
            initials = "".join([n[0].upper() for n in name.split()[:2]]) if name else "U"
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": name, 
                    "picture": picture,
                    "initials": initials,
                    "last_login": now.isoformat(),
                    "updated_at": now.isoformat()
                }}
            )
            role = existing_user["role"]
        else:
            # Check if this is the first user (becomes Admin)
            user_count = await db.users.count_documents({})
            role = "Admin" if user_count == 0 else "Designer"
            
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            initials = "".join([n[0].upper() for n in name.split()[:2]]) if name else "U"
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": role,
                "phone": None,
                "status": "Active",
                "initials": initials,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "last_login": now.isoformat()
            }
            await db.users.insert_one(new_user)
        
        # Create session
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Remove old sessions for this user
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        # Get fresh user data
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {
            "user_id": user_doc["user_id"],
            "email": user_doc["email"],
            "name": user_doc["name"],
            "picture": user_doc.get("picture"),
            "role": user_doc["role"]
        }
        
    except httpx.RequestError as e:
        logger.error(f"Auth API request failed: {e}")
        raise HTTPException(status_code=500, detail="Authentication service error")

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user with permissions"""
    user = await get_current_user(request)
    
    # Get full user doc for permissions
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        user_doc = {"role": user.role}
    
    effective_permissions = get_user_permissions(user_doc)
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "role": user.role,
        "custom_permissions": user_doc.get("custom_permissions", False),
        "permissions": user_doc.get("permissions", []),
        "effective_permissions": effective_permissions
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}


# ============ LOCAL LOGIN SYSTEM ============

@api_router.post("/auth/local-login")
async def local_login(credentials: LocalLoginRequest, response: Response):
    """
    Local login for testing outside Emergent environment.
    This does NOT replace Google OAuth - it's an additional option for local testing.
    """
    # Find user by email with local password
    user_doc = await db.users.find_one(
        {"email": credentials.email, "local_password": {"$exists": True}},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user_doc.get("local_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user is active
    if user_doc.get("status") != "Active":
        raise HTTPException(status_code=403, detail="Account is not active")
    
    # Create session
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
        "login_type": "local"
    })
    
    # Update last login
    await db.users.update_one(
        {"user_id": user_doc["user_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    logger.info(f"Local login successful for user: {credentials.email}")
    
    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "user_id": user_doc["user_id"],
            "email": user_doc["email"],
            "name": user_doc["name"],
            "role": user_doc["role"],
            "picture": user_doc.get("picture")
        }
    }


@api_router.post("/auth/setup-local-admin")
async def setup_local_admin(request: Request):
    """
    Setup a local admin user for testing.
    This creates the predefined admin user with local password.
    Can only be called once - subsequent calls will update the password.
    """
    # Predefined admin credentials
    admin_email = "thaha.pakayil@gmail.com"
    admin_password = "password123"
    admin_name = "Thaha Pakayil"
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": admin_email}, {"_id": 0})
    
    now = datetime.now(timezone.utc)
    hashed_password = hash_password(admin_password)
    
    if existing_user:
        # Update existing user with local password
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "local_password": hashed_password,
                "role": "Admin",
                "status": "Active",
                "updated_at": now.isoformat()
            }}
        )
        logger.info(f"Updated local admin: {admin_email}")
        return {
            "success": True,
            "message": "Local admin updated successfully",
            "email": admin_email,
            "role": "Admin"
        }
    else:
        # Create new admin user
        user_id = f"local_admin_{uuid.uuid4().hex[:8]}"
        user_doc = {
            "user_id": user_id,
            "email": admin_email,
            "name": admin_name,
            "picture": "https://ui-avatars.com/api/?name=Thaha+Pakayil&background=2563eb&color=fff",
            "role": "Admin",
            "status": "Active",
            "local_password": hashed_password,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.users.insert_one(user_doc)
        logger.info(f"Created local admin: {admin_email}")
        
        return {
            "success": True,
            "message": "Local admin created successfully",
            "email": admin_email,
            "role": "Admin",
            "user_id": user_id
        }


@api_router.get("/auth/check-local-admin")
async def check_local_admin():
    """Check if local admin is set up"""
    admin_email = "thaha.pakayil@gmail.com"
    existing_user = await db.users.find_one(
        {"email": admin_email, "local_password": {"$exists": True}},
        {"_id": 0, "email": 1, "role": 1, "name": 1}
    )
    
    if existing_user:
        return {
            "exists": True,
            "email": existing_user.get("email"),
            "name": existing_user.get("name"),
            "role": existing_user.get("role")
        }
    return {"exists": False}

# ============ USER MANAGEMENT ============

# ============ V1 SIMPLIFIED RBAC SYSTEM ============

# 6 Core Roles ONLY (V1 Foundation)
VALID_ROLES = [
    "Admin",                  # Full system access, user management, all dashboards
    "PreSales",               # Lead creation, qualification, handover
    "SalesManager",           # All leads not booked, funnel view, reassign leads, sales pipeline
    "Designer",               # Assigned leads/projects, sales stages, design Kanban, meetings, files
    "DesignManager",          # All designers' tasks, delays, drawings, meetings, bottlenecks
    "ProductionOpsManager",   # Validation, kick-off, production, delivery, installation, handover
    "OperationLead",          # Ground-level execution: delivery, installation, handover milestones
    "Technician",             # Service requests, visit completion, SLA tracking
    "Accountant",             # Finance: add/view transactions, basic reports
    "SeniorAccountant"        # Finance: verify transactions, all reports, manage categories
]

# ============ PERMISSION SYSTEM ============

# All available permissions (granular access control)
AVAILABLE_PERMISSIONS = {
    # Pre-Sales Permissions
    "presales": {
        "name": "Pre-Sales",
        "permissions": [
            {"id": "presales.view", "name": "View Pre-Sales", "description": "View pre-sales leads list and details"},
            {"id": "presales.create", "name": "Create Pre-Sales", "description": "Create new pre-sales leads"},
            {"id": "presales.update", "name": "Update Pre-Sales", "description": "Update pre-sales lead status"},
            {"id": "presales.convert", "name": "Convert Pre-Sales", "description": "Convert pre-sales to leads"}
        ]
    },
    # Leads Permissions
    "leads": {
        "name": "Leads",
        "permissions": [
            {"id": "leads.view", "name": "View Leads", "description": "View leads (assigned/collaborated only)"},
            {"id": "leads.view_all", "name": "View All Leads", "description": "View all leads in the system"},
            {"id": "leads.create", "name": "Create Leads", "description": "Create new leads directly"},
            {"id": "leads.update", "name": "Update Leads", "description": "Update lead stages and details"},
            {"id": "leads.convert", "name": "Convert Leads", "description": "Convert leads to projects"}
        ]
    },
    # Projects Permissions
    "projects": {
        "name": "Projects",
        "permissions": [
            {"id": "projects.view", "name": "View Projects", "description": "View projects (assigned/collaborated only)"},
            {"id": "projects.view_all", "name": "View All Projects", "description": "View all projects in the system"},
            {"id": "projects.manage_collaborators", "name": "Manage Collaborators", "description": "Add/remove project collaborators"}
        ]
    },
    # Milestone Permissions - Explicit per-stage control
    "milestones": {
        "name": "Milestone Updates",
        "permissions": [
            {"id": "milestones.update.design", "name": "Update Design Milestones", "description": "Update Design Finalization stage milestones"},
            {"id": "milestones.update.production", "name": "Update Production Milestones", "description": "Update Production stage milestones"},
            {"id": "milestones.update.delivery", "name": "Update Delivery Milestones", "description": "Update Delivery stage milestones"},
            {"id": "milestones.update.installation", "name": "Update Installation Milestones", "description": "Update Installation stage milestones"},
            {"id": "milestones.update.handover", "name": "Update Handover Milestones", "description": "Update Handover stage milestones"}
        ]
    },
    # Warranty & Service Permissions
    "warranty": {
        "name": "Warranty & Service",
        "permissions": [
            {"id": "warranty.view", "name": "View Warranty", "description": "View warranty records"},
            {"id": "warranty.update", "name": "Update Warranty", "description": "Update warranty details and dates"},
            {"id": "service.view", "name": "View Service Requests", "description": "View service requests (assigned only for technicians)"},
            {"id": "service.view_all", "name": "View All Service Requests", "description": "View all service requests"},
            {"id": "service.create", "name": "Create Service Requests", "description": "Create new service requests"},
            {"id": "service.update", "name": "Update Service Requests", "description": "Update service request status"}
        ]
    },
    # Academy Permissions
    "academy": {
        "name": "Academy",
        "permissions": [
            {"id": "academy.view", "name": "View Academy", "description": "View training content"},
            {"id": "academy.manage", "name": "Manage Academy", "description": "Create/edit categories and lessons"}
        ]
    },
    # Admin Permissions
    "admin": {
        "name": "Administration",
        "permissions": [
            {"id": "admin.manage_users", "name": "Manage Users", "description": "Create, edit, and manage user accounts"},
            {"id": "admin.assign_permissions", "name": "Assign Permissions", "description": "Modify user permissions"},
            {"id": "admin.view_reports", "name": "View Reports", "description": "Access analytics and reports"},
            {"id": "admin.system_settings", "name": "System Settings", "description": "Modify system configuration"}
        ]
    },
    # Finance/Accounting Permissions (Phase 1)
    "finance": {
        "name": "Finance & Accounting",
        "permissions": [
            {"id": "finance.view_dashboard", "name": "View Finance Dashboard", "description": "View finance overview and summaries"},
            {"id": "finance.view_cashbook", "name": "View Cash Book", "description": "View daily cash book entries"},
            {"id": "finance.view_bankbook", "name": "View Bank Book", "description": "View bank account transactions"},
            {"id": "finance.add_transaction", "name": "Add Transaction", "description": "Create new financial entries"},
            {"id": "finance.edit_transaction", "name": "Edit Transaction", "description": "Modify existing entries (unlocked days only)"},
            {"id": "finance.delete_transaction", "name": "Delete Transaction", "description": "Remove entries (unlocked days only)"},
            {"id": "finance.verify_transaction", "name": "Verify Transaction", "description": "Mark transactions as verified"},
            {"id": "finance.close_day", "name": "Close Day", "description": "Lock daily entries permanently"},
            {"id": "finance.view_reports", "name": "View Finance Reports", "description": "Access financial reports and summaries"},
            {"id": "finance.manage_accounts", "name": "Manage Accounts", "description": "Add/edit bank and cash accounts"},
            {"id": "finance.manage_categories", "name": "Manage Categories", "description": "Add/edit expense categories"},
            {"id": "finance.set_opening_balance", "name": "Set Opening Balance", "description": "Set initial account balances"},
            {"id": "finance.import_data", "name": "Import Data", "description": "Import financial data from files"},
            {"id": "finance.export_data", "name": "Export Data", "description": "Export financial data to files"}
        ]
    }
}

# Default permissions for each role (for backward compatibility)
DEFAULT_ROLE_PERMISSIONS = {
    "Admin": [
        # Admin gets everything
        "presales.view", "presales.create", "presales.update", "presales.convert",
        "leads.view", "leads.view_all", "leads.create", "leads.update", "leads.convert",
        "projects.view", "projects.view_all", "projects.manage_collaborators",
        # Milestone permissions - Admin gets all
        "milestones.update.design", "milestones.update.production", 
        "milestones.update.delivery", "milestones.update.installation", "milestones.update.handover",
        "warranty.view", "warranty.update", "service.view", "service.view_all", "service.create", "service.update",
        "academy.view", "academy.manage",
        "admin.manage_users", "admin.assign_permissions", "admin.view_reports", "admin.system_settings",
        # Finance permissions - Admin gets all
        "finance.view_dashboard", "finance.view_cashbook", "finance.view_bankbook",
        "finance.add_transaction", "finance.edit_transaction", "finance.delete_transaction",
        "finance.verify_transaction", "finance.close_day", "finance.view_reports",
        "finance.manage_accounts", "finance.manage_categories", "finance.set_opening_balance",
        "finance.import_data", "finance.export_data"
    ],
    "PreSales": [
        "presales.view", "presales.create", "presales.update", "presales.convert",
        "leads.view", "leads.create",
        "academy.view"
    ],
    "SalesManager": [
        "presales.view", "presales.create", "presales.update", "presales.convert",
        "leads.view", "leads.view_all", "leads.create", "leads.update", "leads.convert",
        "projects.view", "projects.view_all",
        "warranty.view", "service.view", "service.view_all", "service.create",
        "academy.view", "academy.manage",
        "admin.view_reports"
    ],
    "Designer": [
        "leads.view", "leads.update",
        "projects.view", "milestones.update.design",
        "academy.view"
    ],
    "DesignManager": [
        "leads.view", "leads.view_all", "leads.update",
        "projects.view", "projects.view_all", "milestones.update.design", "projects.manage_collaborators",
        "academy.view", "academy.manage",
        "admin.view_reports"
    ],
    "ProductionOpsManager": [
        "projects.view", "projects.view_all", 
        "milestones.update.production", "milestones.update.delivery", 
        "milestones.update.installation", "milestones.update.handover",
        "projects.manage_collaborators",
        "warranty.view", "warranty.update", "service.view", "service.view_all", "service.create", "service.update",
        "academy.view", "academy.manage",
        "admin.view_reports"
    ],
    "OperationLead": [
        # Ground-level execution role - assigned projects only
        "projects.view",
        # Can update delivery, installation, handover milestones only
        "milestones.update.delivery", "milestones.update.installation", "milestones.update.handover",
        "academy.view"
    ],
    "Technician": [
        "service.view", "service.update",
        "academy.view"
    ],
    "Accountant": [
        # Basic finance access - add and view transactions
        "finance.view_dashboard", "finance.view_cashbook", "finance.view_bankbook",
        "finance.add_transaction", "finance.view_reports"
    ],
    "SeniorAccountant": [
        # Extended finance access - verify, manage categories, all reports
        "finance.view_dashboard", "finance.view_cashbook", "finance.view_bankbook",
        "finance.add_transaction", "finance.edit_transaction", "finance.verify_transaction",
        "finance.view_reports", "finance.manage_categories", "finance.export_data"
    ]
}


def get_user_permissions(user_doc: dict) -> list:
    """Get user's effective permissions (always use stored permissions if present, otherwise role defaults)"""
    # If user has permissions array stored, use that (admin-assigned or role-based)
    stored_perms = user_doc.get("permissions", [])
    if stored_perms:
        return stored_perms
    # Fallback to role-based defaults if no permissions stored
    role = user_doc.get("role", "")
    return DEFAULT_ROLE_PERMISSIONS.get(role, [])


def has_permission(user_doc: dict, permission: str) -> bool:
    """Check if user has a specific permission"""
    # Admin always has all permissions
    if user_doc.get("role") == "Admin":
        return True
    permissions = get_user_permissions(user_doc)
    return permission in permissions


# Role categories for permission checks
DESIGN_ROLES = ["Designer", "DesignManager"]
SALES_ROLES = ["PreSales", "SalesManager", "Designer"]  # Designer handles sales stages too
SALES_MANAGER_ROLES = ["Admin", "SalesManager"]  # Can manage sales dashboard
MANAGER_ROLES = ["Admin", "SalesManager", "DesignManager", "ProductionOpsManager"]
EXECUTION_ROLES = ["Admin", "ProductionOpsManager"]

# ============ SIMPLIFIED STAGE FLOW (V1) ============

# PID (Project ID) Generation - Sequential counter
async def generate_pid():
    """Generate unique PID in format ARKI-PID-XXXXX"""
    # Get current counter or create new one
    counter_doc = await db.counters.find_one_and_update(
        {"_id": "pid_counter"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True
    )
    counter_value = counter_doc.get("value", 1)
    return f"ARKI-PID-{counter_value:05d}"

# A. Sales Stages (6 stages)
SALES_STAGES = [
    "BC Call Done",
    "Quotation Shared",
    "Revised Quotation", 
    "Site Visit",
    "Waiting for Booking",
    "Booking Completed"
]

# B. Design Stages (7 stages)
DESIGN_STAGES = [
    "Measurement Completed",
    "Floor Plan Ready",
    "Design Stage 1 Completed",
    "Design Stage 2 Completed",
    "Material Selection Completed",
    "Design Lock",
    "Drawings Completed"
]

# C. Execution Stages (6 stages)
EXECUTION_STAGES = [
    "Validation",
    "Kick-Off",
    "Production",
    "Delivery",
    "Installation",
    "Handover"
]

# All stages combined (19 total for V1)
ALL_PROJECT_STAGES = SALES_STAGES + DESIGN_STAGES + EXECUTION_STAGES

# Pre-booking stages (for Sales Manager)
PRE_BOOKING_STAGES = SALES_STAGES[:-1]  # All except "Booking Completed"

# ============ AUTO-COLLABORATOR SYSTEM (V1) ============

STAGE_COLLABORATOR_ROLES = {
    # Sales Stages - PreSales + Designer (assigned)
    "BC Call Done": ["PreSales"],
    "Quotation Shared": ["PreSales"],
    "Revised Quotation": ["PreSales"],
    "Site Visit": ["PreSales"],
    "Waiting for Booking": ["PreSales"],
    
    # After Booking - Design Manager joins
    "Booking Completed": ["DesignManager"],
    
    # Design Stages - DesignManager + Designer
    "Measurement Completed": ["DesignManager"],
    "Floor Plan Ready": ["DesignManager"],
    "Design Stage 1 Completed": ["DesignManager"],
    "Design Stage 2 Completed": ["DesignManager"],
    "Material Selection Completed": ["DesignManager"],
    "Design Lock": ["DesignManager", "ProductionOpsManager"],
    "Drawings Completed": ["DesignManager", "ProductionOpsManager"],
    
    # Execution Stages - ProductionOpsManager
    "Validation": ["ProductionOpsManager"],
    "Kick-Off": ["ProductionOpsManager"],
    "Production": ["ProductionOpsManager"],
    "Delivery": ["ProductionOpsManager"],
    "Installation": ["ProductionOpsManager"],
    "Handover": ["ProductionOpsManager"]
}

def format_user_response(user_doc):
    """Format user document for API response"""
    def format_dt(dt):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return str(dt) if dt else None
    
    # Get effective permissions
    effective_permissions = get_user_permissions(user_doc)
    
    return {
        "user_id": user_doc.get("user_id"),
        "email": user_doc.get("email"),
        "name": user_doc.get("name"),
        "picture": user_doc.get("picture"),
        "role": user_doc.get("role", "Designer"),
        "phone": user_doc.get("phone"),
        "status": user_doc.get("status", "Active"),
        "senior_manager_view": user_doc.get("senior_manager_view", False),  # V1 permission toggle
        "custom_permissions": user_doc.get("custom_permissions", False),
        "permissions": user_doc.get("permissions", []),
        "effective_permissions": effective_permissions,
        "created_at": format_dt(user_doc.get("created_at")),
        "updated_at": format_dt(user_doc.get("updated_at")),
        "last_login": format_dt(user_doc.get("last_login"))
    }

@api_router.get("/users")
async def list_all_users(
    request: Request,
    status: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None
):
    """List all users (Admin and SalesManager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build query
    query = {}
    
    if status and status != "all":
        query["status"] = status
    
    if role and role != "all":
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        users = [
            u for u in users
            if search_lower in u.get("name", "").lower()
            or search_lower in u.get("email", "").lower()
        ]
    
    # Sort by created_at descending
    def get_sort_key(user):
        created_at = user.get("created_at", "")
        if isinstance(created_at, datetime):
            return created_at.isoformat()
        return str(created_at) if created_at else ""
    
    users.sort(key=get_sort_key, reverse=True)
    
    return [format_user_response(u) for u in users]

@api_router.get("/users/active")
async def get_active_users(request: Request):
    """Get list of active users (for collaborator dropdowns)"""
    user = await get_current_user(request)
    
    users = await db.users.find(
        {"status": "Active"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}
    ).to_list(1000)
    
    return users

@api_router.get("/users/active/designers")
async def get_active_designers(request: Request):
    """Get list of active designers (for assignment dropdowns)"""
    user = await get_current_user(request)
    
    designers = await db.users.find(
        {"status": "Active", "role": "Designer"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}
    ).to_list(1000)
    
    return designers

@api_router.get("/users/available")
async def get_available_users(request: Request):
    """Get list of all users (for adding collaborators)"""
    user = await get_current_user(request)
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Allow if Admin OR has projects.manage_collaborators permission
    # Also allow specific manager roles for backward compatibility
    allowed_roles = ["Admin", "SalesManager", "DesignManager", "ProductionOpsManager"]
    has_manage_collaborators = has_permission(user_doc, "projects.manage_collaborators")
    
    if user.role not in allowed_roles and not has_manage_collaborators:
        raise HTTPException(status_code=403, detail="Access denied - cannot manage collaborators")
    
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}).to_list(1000)
    return users

@api_router.get("/users/designers")
async def get_designers(request: Request):
    """Get list of all designers (for assigning to leads)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "SalesManager", "DesignManager", "ProductionOpsManager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    designers = await db.users.find(
        {"role": "Designer"}, 
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}
    ).to_list(1000)
    return designers

@api_router.get("/users/{user_id}")
async def get_user_by_id(user_id: str, request: Request):
    """Get single user by ID (Admin and Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return format_user_response(target_user)

@api_router.post("/users/invite")
async def invite_user(invite_data: UserInvite, request: Request):
    """Invite a new user (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate role
    if invite_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    now = datetime.now(timezone.utc)
    new_user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Generate avatar from initials if no picture
    initials = "".join([n[0].upper() for n in invite_data.name.split()[:2]]) if invite_data.name else "U"
    
    new_user = {
        "user_id": new_user_id,
        "email": invite_data.email,
        "name": invite_data.name,
        "picture": None,  # Will be set when user logs in with Google
        "role": invite_data.role,
        "phone": invite_data.phone,
        "status": "Active",
        "senior_manager_view": invite_data.senior_manager_view or False,  # V1 permission
        "initials": initials,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "last_login": None,
        "invited_by": user.user_id
    }
    
    await db.users.insert_one(new_user)
    
    return {
        "message": f"Invite sent to {invite_data.email}",
        "user_id": new_user_id,
        "user": format_user_response(new_user)
    }


# ============ LOCAL USER MANAGEMENT ============

class LocalUserCreate(BaseModel):
    """Create user with local password for testing"""
    email: str
    name: str
    password: str
    role: str
    phone: Optional[str] = None

class PasswordChange(BaseModel):
    """Password change request"""
    current_password: Optional[str] = None  # Optional for admin reset
    new_password: str

class PasswordReset(BaseModel):
    """Password reset by admin"""
    email: str
    new_password: str


@api_router.post("/users/create-local")
async def create_local_user(user_data: LocalUserCreate, request: Request):
    """Create a new user with local password (Admin only) - for testing"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate role
    if user_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Validate password
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    now = datetime.now(timezone.utc)
    new_user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Generate avatar from initials
    initials = "".join([n[0].upper() for n in user_data.name.split()[:2]]) if user_data.name else "U"
    
    new_user = {
        "user_id": new_user_id,
        "email": user_data.email,
        "name": user_data.name,
        "picture": f"https://ui-avatars.com/api/?name={user_data.name.replace(' ', '+')}&background=2563eb&color=fff",
        "role": user_data.role,
        "phone": user_data.phone,
        "status": "Active",
        "local_password": hash_password(user_data.password),  # Hash password
        "initials": initials,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "last_login": None,
        "created_by": user.user_id
    }
    
    await db.users.insert_one(new_user)
    
    # Don't return password in response
    new_user.pop("local_password", None)
    new_user.pop("_id", None)
    
    return {
        "success": True,
        "message": f"User {user_data.email} created with local login",
        "user": new_user
    }


@api_router.put("/users/{user_id}/password")
async def change_user_password(user_id: str, pwd_data: PasswordChange, request: Request):
    """Change user password (self or Admin)"""
    user = await get_current_user(request)
    
    # Find target user
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission check
    is_self = user.user_id == user_id
    is_admin = user.role == "Admin"
    
    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # If self-change, verify current password
    if is_self and not is_admin:
        if not pwd_data.current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        if not verify_password(pwd_data.current_password, target_user.get("local_password", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(pwd_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "local_password": hash_password(pwd_data.new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Password updated successfully"}


@api_router.post("/auth/reset-password")
async def admin_reset_password(reset_data: PasswordReset, request: Request):
    """Admin resets user password"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find user by email
    target_user = await db.users.find_one({"email": reset_data.email}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate new password
    if len(reset_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    await db.users.update_one(
        {"email": reset_data.email},
        {"$set": {
            "local_password": hash_password(reset_data.new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": f"Password reset for {reset_data.email}"}


# ============ PERMISSIONS MANAGEMENT ENDPOINTS ============

@api_router.get("/permissions/available")
async def get_available_permissions(request: Request):
    """Get all available permissions grouped by category"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "permission_groups": AVAILABLE_PERMISSIONS,
        "default_role_permissions": DEFAULT_ROLE_PERMISSIONS
    }


@api_router.get("/users/{user_id}/permissions")
async def get_user_permissions_endpoint(user_id: str, request: Request):
    """Get a user's current permissions"""
    user = await get_current_user(request)
    
    # Users can view their own permissions, Admin can view anyone's
    if user.user_id != user_id and user.role != "Admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    effective_permissions = get_user_permissions(target_user)
    
    return {
        "user_id": user_id,
        "role": target_user.get("role"),
        "custom_permissions": target_user.get("custom_permissions", False),
        "permissions": target_user.get("permissions", []),
        "effective_permissions": effective_permissions,
        "default_role_permissions": DEFAULT_ROLE_PERMISSIONS.get(target_user.get("role"), [])
    }


class PermissionsUpdate(BaseModel):
    permissions: List[str]
    custom_permissions: bool = True  # True = use custom, False = use role defaults


@api_router.put("/users/{user_id}/permissions")
async def update_user_permissions(user_id: str, perm_data: PermissionsUpdate, request: Request):
    """Update a user's permissions (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required to modify permissions")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot modify another Admin's permissions
    if target_user.get("role") == "Admin" and user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot modify another Admin's permissions")
    
    # Validate permissions
    all_valid_permissions = []
    for group in AVAILABLE_PERMISSIONS.values():
        for perm in group["permissions"]:
            all_valid_permissions.append(perm["id"])
    
    invalid_perms = [p for p in perm_data.permissions if p not in all_valid_permissions]
    if invalid_perms:
        raise HTTPException(status_code=400, detail=f"Invalid permissions: {invalid_perms}")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "permissions": perm_data.permissions,
            "custom_permissions": perm_data.custom_permissions,
            "updated_at": now.isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Permissions updated",
        "permissions": perm_data.permissions,
        "custom_permissions": perm_data.custom_permissions
    }


@api_router.post("/users/{user_id}/permissions/reset-to-role")
async def reset_user_permissions_to_role(user_id: str, request: Request):
    """Reset a user's permissions to their role defaults"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role = target_user.get("role")
    default_perms = DEFAULT_ROLE_PERMISSIONS.get(role, [])
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "permissions": default_perms,
            "custom_permissions": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": f"Permissions reset to {role} defaults",
        "permissions": default_perms
    }


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update_data: UserUpdate, request: Request):
    """Update user details (Admin and Manager with restrictions)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Manager restrictions
    if user.role == "Manager":
        # Cannot edit Admin users
        if target_user.get("role") == "Admin":
            raise HTTPException(status_code=403, detail="Managers cannot edit Admin users")
        
        # Cannot edit other Managers
        if target_user.get("role") == "Manager" and target_user.get("user_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Managers cannot edit other Managers")
        
        # Cannot change status
        if update_data.status is not None:
            raise HTTPException(status_code=403, detail="Managers cannot change user status")
        
        # Can only assign Designer, PreSales, or Trainee roles
        if update_data.role and update_data.role not in ["Designer", "PreSales", "Trainee"]:
            raise HTTPException(status_code=403, detail="Managers can only assign Designer, PreSales, or Trainee roles")
    
    # Validate role if provided
    if update_data.role and update_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
    
    # Validate status if provided
    if update_data.status and update_data.status not in ["Active", "Inactive"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'Active' or 'Inactive'")
    
    # Cannot deactivate yourself
    if update_data.status == "Inactive" and user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update_data.name is not None:
        update_dict["name"] = update_data.name
        # Update initials
        initials = "".join([n[0].upper() for n in update_data.name.split()[:2]]) if update_data.name else "U"
        update_dict["initials"] = initials
    
    if update_data.phone is not None:
        update_dict["phone"] = update_data.phone
    
    if update_data.role is not None:
        update_dict["role"] = update_data.role
    
    if update_data.status is not None:
        update_dict["status"] = update_data.status
    
    if update_data.picture is not None:
        update_dict["picture"] = update_data.picture
    
    # Only Admin can set senior_manager_view permission
    if update_data.senior_manager_view is not None:
        if user.role != "Admin":
            raise HTTPException(status_code=403, detail="Only Admin can set Senior Manager View permission")
        update_dict["senior_manager_view"] = update_data.senior_manager_view
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_dict}
    )
    
    # Return updated user
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return format_user_response(updated_user)

@api_router.put("/users/{user_id}/status")
async def toggle_user_status(user_id: str, request: Request):
    """Toggle user status Active/Inactive (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot deactivate yourself
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    
    current_status = target_user.get("status", "Active")
    new_status = "Inactive" if current_status == "Active" else "Active"
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"User status changed to {new_status}", "status": new_status}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Cannot delete yourself
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "User deleted successfully"}

# ============ PROFILE ENDPOINTS ============

@api_router.get("/profile")
async def get_profile(request: Request):
    """Get current user profile"""
    user = await get_current_user(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return format_user_response(user_doc)

@api_router.put("/profile")
async def update_profile(update_data: ProfileUpdate, request: Request):
    """Update current user profile"""
    user = await get_current_user(request)
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update_data.name is not None:
        update_dict["name"] = update_data.name
        # Update initials
        initials = "".join([n[0].upper() for n in update_data.name.split()[:2]]) if update_data.name else "U"
        update_dict["initials"] = initials
    
    if update_data.phone is not None:
        update_dict["phone"] = update_data.phone
    
    if update_data.picture is not None:
        update_dict["picture"] = update_data.picture
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_dict}
    )
    
    # Return updated profile
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return format_user_response(updated_user)

# ============ LEGACY USER ENDPOINTS (keep for backwards compatibility) ============

@api_router.get("/auth/users", response_model=List[UserResponse])
async def list_users(request: Request):
    """List all users (Admin only) - Legacy endpoint"""
    await require_admin(request)
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(
        user_id=u["user_id"],
        email=u["email"],
        name=u["name"],
        picture=u.get("picture"),
        role=u["role"],
        phone=u.get("phone"),
        status=u.get("status", "Active")
    ) for u in users]

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(user_id: str, role_update: RoleUpdateRequest, request: Request):
    """Update user role (Admin only) - Legacy endpoint"""
    await require_admin(request)
    
    if role_update.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role_update.role, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated successfully", "role": role_update.role}

# ============ PROJECT ENDPOINTS ============

@api_router.get("/projects")
async def list_projects(
    request: Request, 
    stage: Optional[str] = None, 
    search: Optional[str] = None,
    time_filter: Optional[str] = None,  # this_month, last_month, this_quarter, custom, all
    start_date: Optional[str] = None,   # For custom date range (ISO format)
    end_date: Optional[str] = None      # For custom date range (ISO format)
):
    """List projects - Designer sees only assigned, Admin/Manager sees all"""
    user = await get_current_user(request)
    
    # Build query
    query = {}
    
    # Role-based filtering: Designer/OperationLead only sees assigned projects
    if user.role in ["Designer", "OperationLead"]:
        query["collaborators"] = user.user_id
    
    # Stage filter
    if stage and stage != "all":
        query["stage"] = stage
    
    # Time-based filter
    if time_filter and time_filter != "all":
        now = datetime.now(timezone.utc)
        date_filter = None
        
        if time_filter == "this_month":
            first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            date_filter = {"$gte": first_of_month.isoformat()}
        elif time_filter == "last_month":
            first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month = first_of_this_month - timedelta(days=1)
            first_of_last_month = last_month.replace(day=1)
            date_filter = {"$gte": first_of_last_month.isoformat(), "$lt": first_of_this_month.isoformat()}
        elif time_filter == "this_quarter":
            quarter = (now.month - 1) // 3
            first_month_of_quarter = quarter * 3 + 1
            first_of_quarter = now.replace(month=first_month_of_quarter, day=1, hour=0, minute=0, second=0, microsecond=0)
            date_filter = {"$gte": first_of_quarter.isoformat()}
        elif time_filter == "custom" and start_date:
            date_filter = {"$gte": start_date}
            if end_date:
                date_filter["$lte"] = end_date
        
        if date_filter:
            query["created_at"] = date_filter
    
    # Fetch projects
    projects = await db.projects.find(query, {"_id": 0}).to_list(1000)
    
    # Apply search filter (client-side for simplicity)
    if search:
        search_lower = search.lower()
        projects = [
            p for p in projects 
            if search_lower in p.get("project_name", "").lower() 
            or search_lower in p.get("client_name", "").lower()
            or search_lower in p.get("client_phone", "").replace(" ", "")
        ]
    
    # Get collaborator details for each project
    all_user_ids = set()
    for p in projects:
        all_user_ids.update(p.get("collaborators", []))
    
    # Fetch all collaborator users at once
    users_map = {}
    if all_user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": list(all_user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        ).to_list(1000)
        users_map = {u["user_id"]: u for u in users_list}
    
    # Build response with collaborator details
    result = []
    for p in projects:
        collaborator_details = [
            {
                "user_id": uid,
                "name": users_map.get(uid, {}).get("name", "Unknown"),
                "picture": users_map.get(uid, {}).get("picture")
            }
            for uid in p.get("collaborators", [])
            if uid in users_map
        ]
        
        # Handle datetime conversion
        updated_at = p.get("updated_at", p.get("created_at", ""))
        created_at = p.get("created_at", "")
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        
        result.append({
            "project_id": p["project_id"],
            "pid": p.get("pid"),  # CRITICAL: Include PID in list
            "project_name": p["project_name"],
            "client_name": p["client_name"],
            "client_phone": p["client_phone"],
            "stage": p["stage"],
            "hold_status": p.get("hold_status", "Active"),
            "collaborators": collaborator_details,
            "summary": p.get("summary", ""),
            "updated_at": updated_at,
            "created_at": created_at
        })
    
    # Sort by updated_at descending
    result.sort(key=lambda x: x["updated_at"], reverse=True)
    
    return result

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """Get single project by ID"""
    user = await get_current_user(request)
    
    # PreSales cannot access project details
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access for Designer role
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get collaborator details
    collaborator_details = []
    for uid in project.get("collaborators", []):
        user_doc = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1})
        if user_doc:
            collaborator_details.append(user_doc)
    
    # Handle datetime
    updated_at = project.get("updated_at", project.get("created_at", ""))
    created_at = project.get("created_at", "")
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    
    return {
        "project_id": project["project_id"],
        "pid": project.get("pid"),  # CRITICAL: Include PID
        "project_name": project["project_name"],
        "client_name": project["client_name"],
        "client_phone": project["client_phone"],
        "client_email": project.get("client_email"),
        "client_address": project.get("client_address"),
        "client_requirements": project.get("client_requirements"),
        "lead_source": project.get("lead_source"),
        "budget": project.get("budget"),
        "project_value": project.get("project_value"),
        "stage": project["stage"],
        "hold_status": project.get("hold_status", "Active"),
        "hold_reason": project.get("hold_reason"),
        "collaborators": collaborator_details,
        "summary": project.get("summary", ""),
        "timeline": project.get("timeline", []),
        "lead_timeline": project.get("lead_timeline", []),
        "comments": project.get("comments", []),
        "files": project.get("files", []),
        "notes": project.get("notes", []),
        "lead_id": project.get("lead_id"),
        # CRITICAL: Include milestone state for proper rehydration on page load
        "completed_substages": project.get("completed_substages", []),
        "percentage_substages": project.get("percentage_substages", {}),
        "updated_at": updated_at,
        "created_at": created_at
    }

@api_router.post("/projects/{project_id}/comments")
async def add_comment(project_id: str, comment: CommentCreate, request: Request):
    """Add a comment to a project"""
    user = await get_current_user(request)
    
    # PreSales cannot access project details
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access for Designer role
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create comment
    new_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": comment.message,
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to comments array
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$push": {"comments": new_comment},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Check for @mentions in the comment
    try:
        import re
        mentions = re.findall(r'@(\w+)', comment.message)
        if mentions:
            # Find mentioned users
            for mention in mentions:
                mentioned_user = await db.users.find_one(
                    {"name": {"$regex": f"^{mention}", "$options": "i"}, "status": "Active"},
                    {"_id": 0, "user_id": 1, "name": 1}
                )
                if mentioned_user and mentioned_user["user_id"] != user.user_id:
                    await create_notification(
                        mentioned_user["user_id"],
                        "You were mentioned",
                        f"{user.name} mentioned you in a comment on '{project.get('project_name', 'a project')}'",
                        "comment",
                        f"/projects/{project_id}"
                    )
    except Exception as e:
        print(f"Error processing mentions: {e}")
    
    return new_comment

@api_router.put("/projects/{project_id}/customer-details")
async def update_project_customer_details(project_id: str, request: Request):
    """
    Update customer details on a project.
    - Only Admin/SalesManager can edit customer details on projects
    - Designers and others can only view
    """
    user = await get_current_user(request)
    body = await request.json()
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Only Admin and SalesManager can edit project customer details
    if user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Only Admin or Sales Manager can edit customer details on projects")
    
    # Build update dict
    now = datetime.now(timezone.utc)
    update_dict = {"updated_at": now.isoformat()}
    
    allowed_fields = ["client_name", "client_phone", "client_email", 
                      "client_address", "client_requirements", "lead_source", "budget"]
    
    for field in allowed_fields:
        if field in body:
            update_dict[field] = body[field]
    
    if len(update_dict) > 1:  # More than just updated_at
        await db.projects.update_one(
            {"project_id": project_id},
            {"$set": update_dict}
        )
        
        # Add system comment
        system_comment = {
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"Customer details updated by {user.name}",
            "is_system": True,
            "created_at": now.isoformat()
        }
        await db.projects.update_one(
            {"project_id": project_id},
            {"$push": {"comments": system_comment}}
        )
    
    # Return updated project
    updated_project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated_project

@api_router.put("/projects/{project_id}/stage")
async def update_stage(project_id: str, stage_update: StageUpdate, request: Request):
    """Update project stage - forward-only progression (except Admin)"""
    user = await get_current_user(request)
    
    # PreSales cannot access project details
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate stage
    if stage_update.stage not in STAGE_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {STAGE_ORDER}")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access for Designer role - can only change own projects
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    old_stage = project.get("stage", "Design Finalization")
    new_stage = stage_update.stage
    
    if old_stage == new_stage:
        return {"message": "Stage unchanged", "stage": new_stage}
    
    # FORWARD-ONLY VALIDATION (except Admin)
    old_index = STAGE_ORDER.index(old_stage) if old_stage in STAGE_ORDER else 0
    new_index = STAGE_ORDER.index(new_stage)
    
    if new_index < old_index:
        # Backward movement requested
        if user.role != "Admin":
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot move backward from '{old_stage}' to '{new_stage}'. Stage progression is forward-only. Only Admin can rollback stages."
            )
        # Admin can rollback - add special note
        rollback_note = f" (Admin rollback from '{old_stage}')"
    else:
        rollback_note = ""
    
    now = datetime.now(timezone.utc)
    
    # Create system comment for stage change
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Stage updated from \"{old_stage}\" to \"{new_stage}\"{rollback_note}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    # Update timeline based on new stage with TAT-aware logic
    timeline = project.get("timeline", [])
    new_stage_index = STAGE_ORDER.index(new_stage)
    
    for item in timeline:
        item_stage = item.get("stage_ref", "")
        if item_stage in STAGE_ORDER:
            item_index = STAGE_ORDER.index(item_stage)
            if item_index < new_stage_index:
                # Past stages - mark as completed
                item["status"] = "completed"
                if not item.get("completedDate"):
                    item["completedDate"] = now.isoformat()
            elif item_index == new_stage_index:
                # Current stage - first milestone in stage is completed
                milestones_in_stage = [t for t in timeline if t.get("stage_ref") == item_stage]
                is_first = milestones_in_stage and milestones_in_stage[0]["id"] == item["id"]
                if is_first:
                    item["status"] = "completed"
                    if not item.get("completedDate"):
                        item["completedDate"] = now.isoformat()
                else:
                    # Check if delayed
                    expected_date_str = item.get("expectedDate", item.get("date", ""))
                    if expected_date_str:
                        try:
                            expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                            if expected.tzinfo is None:
                                expected = expected.replace(tzinfo=timezone.utc)
                            if expected < now:
                                item["status"] = "delayed"
                            else:
                                item["status"] = "pending"
                        except:
                            item["status"] = "pending"
                    else:
                        item["status"] = "pending"
            else:
                # Future stages - check if delayed
                expected_date_str = item.get("expectedDate", item.get("date", ""))
                if expected_date_str:
                    try:
                        expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                        if expected.tzinfo is None:
                            expected = expected.replace(tzinfo=timezone.utc)
                        if expected < now:
                            item["status"] = "delayed"
                        else:
                            item["status"] = "pending"
                    except:
                        item["status"] = "pending"
                else:
                    item["status"] = "pending"
                item["completedDate"] = None
    
    # Update project
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "stage": new_stage,
                "timeline": timeline,
                "updated_at": now.isoformat()
            },
            "$push": {"comments": system_comment}
        }
    )
    
    # Auto-add collaborators based on new stage (Livspace-style)
    try:
        await auto_add_stage_collaborators(
            project_id, 
            new_stage,
            f"Stage changed from {old_stage} to {new_stage}"
        )
    except Exception as e:
        print(f"Error auto-adding collaborators: {e}")
    
    # Add activity entry for stage change
    activity_entry = {
        "id": str(uuid.uuid4()),
        "type": "stage_change",
        "message": f"Stage updated: {old_stage} → {new_stage}",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat(),
        "metadata": {
            "old_stage": old_stage,
            "new_stage": new_stage
        }
    }
    await db.projects.update_one(
        {"project_id": project_id},
        {"$push": {"activity": activity_entry}}
    )
    
    # Send notifications to relevant users
    try:
        relevant_users = await get_relevant_users_for_project(project)
        # Remove the user who made the change
        relevant_users = [uid for uid in relevant_users if uid != user.user_id]
        
        await notify_users(
            relevant_users,
            "Stage Updated",
            f"{user.name} moved project '{project.get('project_name', 'Unknown')}' to stage '{new_stage}'",
            "stage-change",
            f"/projects/{project_id}"
        )
    except Exception as e:
        print(f"Error sending notifications: {e}")
    
    return {
        "message": "Stage updated successfully",
        "stage": new_stage,
        "system_comment": system_comment
    }


# ============ TIMELINE REGENERATION ============

class TimelineRegenerationRequest(BaseModel):
    """Request to regenerate timeline from a specific stage"""
    from_stage: str  # Stage ID to regenerate from
    reason: str  # "customer_delay", "site_delay", "payment_delay", "vendor_delay", "other"
    notes: Optional[str] = None

VALID_DELAY_REASONS = [
    "customer_delay",
    "site_delay", 
    "payment_delay",
    "vendor_delay",
    "material_delay",
    "other"
]

@api_router.post("/projects/{project_id}/regenerate-timeline")
async def regenerate_project_timeline(project_id: str, regen_data: TimelineRegenerationRequest, request: Request):
    """
    Regenerate remaining timeline from a specific stage onwards.
    This is used when external delays (customer, site, payment) push the schedule.
    Original delays remain visible in activity log.
    """
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "ProductionOpsManager", "DesignManager"]:
        raise HTTPException(status_code=403, detail="Only managers can regenerate timeline")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if regen_data.reason not in VALID_DELAY_REASONS:
        raise HTTPException(status_code=400, detail=f"Invalid reason. Must be one of: {VALID_DELAY_REASONS}")
    
    now = datetime.now(timezone.utc)
    timeline = project.get("timeline", [])
    
    # Find the starting point for regeneration
    from_stage = regen_data.from_stage
    found_stage = False
    stages_to_regenerate = []
    
    for item in timeline:
        if item.get("stage_ref") == from_stage or item.get("id") == from_stage:
            found_stage = True
        
        if found_stage and item.get("status") != "completed":
            stages_to_regenerate.append(item)
    
    if not found_stage:
        raise HTTPException(status_code=400, detail="Stage not found in timeline")
    
    if not stages_to_regenerate:
        raise HTTPException(status_code=400, detail="No pending stages to regenerate from this point")
    
    # Calculate new expected dates based on today
    current_date = now
    updated_count = 0
    
    for i, item in enumerate(timeline):
        if item in stages_to_regenerate:
            # Get TAT for this stage (default 3 days)
            tat_days = DEFAULT_TAT_DAYS.get(item.get("stage_ref") or item.get("id"), 3)
            
            # Calculate new expected date
            new_expected = current_date + timedelta(days=tat_days)
            
            # Store original expected date for reference
            original_expected = item.get("expected_date")
            
            # Update the timeline item
            item["expected_date"] = new_expected.isoformat()
            item["regenerated"] = True
            item["regenerated_at"] = now.isoformat()
            item["regenerated_reason"] = regen_data.reason
            item["original_expected_date"] = original_expected
            
            current_date = new_expected
            updated_count += 1
    
    # Create activity entry
    reason_labels = {
        "customer_delay": "Customer Delay",
        "site_delay": "Site Not Ready",
        "payment_delay": "Payment Delay",
        "vendor_delay": "Vendor Delay",
        "material_delay": "Material Delay",
        "other": "Other"
    }
    
    activity_entry = {
        "id": str(uuid.uuid4()),
        "type": "timeline_regeneration",
        "message": f"Timeline regenerated from '{from_stage}' onwards. Reason: {reason_labels.get(regen_data.reason, regen_data.reason)}. {updated_count} stages updated.",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat(),
        "metadata": {
            "from_stage": from_stage,
            "reason": regen_data.reason,
            "notes": regen_data.notes,
            "stages_updated": updated_count
        }
    }
    
    # Update project
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "timeline": timeline,
                "updated_at": now.isoformat()
            },
            "$push": {"activity": activity_entry}
        }
    )
    
    # Add system comment
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"📅 Timeline regenerated from '{from_stage}'. Reason: {reason_labels.get(regen_data.reason)}. {regen_data.notes or 'No additional notes.'}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": project_id},
        {"$push": {"comments": system_comment}}
    )
    
    return {
        "success": True,
        "message": f"Timeline regenerated. {updated_count} stages updated.",
        "stages_updated": updated_count,
        "from_stage": from_stage,
        "reason": regen_data.reason
    }

# ============ SUB-STAGE PROGRESSION SYSTEM ============

# Milestone groups with sub-stages (matching frontend)
MILESTONE_GROUPS = [
    {
        "id": "design_finalization",
        "name": "Design Finalization",
        "subStages": [
            {"id": "site_measurement", "name": "Site Measurement", "order": 1},
            {"id": "design_meeting_1", "name": "Design Meeting 1 – Layout Discussion", "order": 2},
            {"id": "design_meeting_2", "name": "Design Meeting 2 – First Draft of 3D Designs", "order": 3},
            {"id": "design_meeting_3", "name": "Design Meeting 3 – Final Draft of 3D Designs", "order": 4},
            {"id": "final_design_presentation", "name": "Final Design Presentation", "order": 5},
            {"id": "material_selection", "name": "Material Selection", "order": 6},
            {"id": "payment_collection_50", "name": "Payment Collection – 50%", "order": 7},
            {"id": "production_drawing_prep", "name": "Production Drawing Preparation", "order": 8},
            {"id": "validation_internal", "name": "Validation (Internal Check)", "order": 9},
            {"id": "kws_signoff", "name": "KWS Sign-Off Document Preparation", "order": 10},
            {"id": "kickoff_meeting", "name": "Kick-Off Meeting", "order": 11}
        ]
    },
    {
        "id": "production",
        "name": "Production",
        "subStages": [
            {"id": "vendor_mapping", "name": "Vendor Mapping", "order": 1},
            {"id": "factory_slot_allocation", "name": "Factory Slot Allocation", "order": 2},
            {"id": "jit_delivery_plan", "name": "JIT / Project Delivery Plan (By Operations Lead)", "order": 3},
            {"id": "non_modular_dependency", "name": "Non-Modular Dependency Works", "order": 4, "type": "percentage"},
            {"id": "raw_material_procurement", "name": "Raw Material Procurement – Modular", "order": 5},
            {"id": "production_kickstart", "name": "Production Kick-Start", "order": 6},
            {"id": "modular_production_complete", "name": "Modular Production Completed (Factory)", "order": 7},
            {"id": "quality_check_inspection", "name": "Quality Check & Inspection", "order": 8},
            {"id": "full_order_confirmation_45", "name": "Full Order Confirmation — 45% Payment Collection", "order": 9},
            {"id": "piv_site_readiness", "name": "PIV / Site Readiness Check", "order": 10},
            {"id": "ready_for_dispatch", "name": "Ready For Dispatch", "order": 11}
        ]
    },
    {
        "id": "delivery",
        "name": "Delivery",
        "subStages": [
            {"id": "dispatch_scheduled", "name": "Dispatch Scheduled", "order": 1},
            {"id": "installation_team_scheduled", "name": "Installation Team Scheduled", "order": 2},
            {"id": "materials_dispatched", "name": "Materials Dispatched", "order": 3},
            {"id": "delivery_confirmed", "name": "Delivery Confirmed at Site", "order": 4}
        ]
    },
    {
        "id": "installation",
        "name": "Installation",
        "subStages": [
            {"id": "installation_start", "name": "Installation Started", "order": 1},
            {"id": "installation_progress", "name": "Installation In Progress", "order": 2},
            {"id": "snag_list", "name": "Snag List Prepared", "order": 3},
            {"id": "snag_rectification", "name": "Snag Rectification", "order": 4},
            {"id": "installation_complete", "name": "Installation Completed", "order": 5}
        ]
    },
    {
        "id": "handover",
        "name": "Handover",
        "subStages": [
            {"id": "final_inspection", "name": "Final Inspection", "order": 1},
            {"id": "cleaning", "name": "Cleaning", "order": 2},
            {"id": "handover_docs", "name": "Handover Documents Prepared", "order": 3},
            {"id": "project_handover", "name": "Project Handover Complete", "order": 4},
            {"id": "csat", "name": "CSAT (Customer Satisfaction)", "order": 5},
            {"id": "review_video_photos", "name": "Review Video / Photos", "order": 6},
            {"id": "issue_warranty_book", "name": "Issue Warranty Book", "order": 7},
            {"id": "closed", "name": "Closed", "order": 8}
        ]
    }
]

def get_all_substages():
    """Get flat list of all sub-stages in order"""
    all_substages = []
    for group in MILESTONE_GROUPS:
        for sub in group["subStages"]:
            all_substages.append({
                **sub,
                "group_id": group["id"],
                "group_name": group["name"]
            })
    return all_substages


# Mapping from milestone group ID to required permission
MILESTONE_GROUP_PERMISSIONS = {
    "design_finalization": "milestones.update.design",
    "production": "milestones.update.production",
    "delivery": "milestones.update.delivery",
    "installation": "milestones.update.installation",
    "handover": "milestones.update.handover"
}


def get_milestone_permission_for_substage(substage_id: str) -> str:
    """Get the required permission for updating a specific substage"""
    for group in MILESTONE_GROUPS:
        for sub in group["subStages"]:
            if sub["id"] == substage_id:
                return MILESTONE_GROUP_PERMISSIONS.get(group["id"], "")
    return ""


def check_milestone_permission(user_doc: dict, substage_id: str) -> tuple[bool, str]:
    """
    Check if user has explicit permission to update a milestone.
    Returns (has_permission, error_message)
    """
    required_permission = get_milestone_permission_for_substage(substage_id)
    if not required_permission:
        return False, "Invalid substage"
    
    # Check explicit permission - NO role fallback
    if has_permission(user_doc, required_permission):
        return True, ""
    
    # Get friendly group name for error message
    for group in MILESTONE_GROUPS:
        for sub in group["subStages"]:
            if sub["id"] == substage_id:
                return False, f"You don't have permission to update {group['name']} milestones. Required permission: {required_permission}"
    
    return False, f"Permission denied. Required: {required_permission}"

def can_complete_substage(substage_id: str, completed_substages: list):
    """Check if a sub-stage can be completed (previous must be done)"""
    all_substages = get_all_substages()
    substage_ids = [s["id"] for s in all_substages]
    
    if substage_id not in substage_ids:
        return False, "Invalid sub-stage ID"
    
    if substage_id in completed_substages:
        return False, "Sub-stage already completed"
    
    target_index = substage_ids.index(substage_id)
    
    # First sub-stage can always be completed
    if target_index == 0:
        return True, None
    
    # Check if previous sub-stage is completed
    prev_substage_id = substage_ids[target_index - 1]
    if prev_substage_id not in completed_substages:
        prev_substage = all_substages[target_index - 1]
        return False, f"Must complete '{prev_substage['name']}' first"
    
    return True, None

def get_current_milestone_group(completed_substages: list):
    """Get the current active milestone group"""
    for group in MILESTONE_GROUPS:
        all_complete = all(s["id"] in completed_substages for s in group["subStages"])
        if not all_complete:
            return group
    return MILESTONE_GROUPS[-1]

@api_router.post("/projects/{project_id}/substage/complete")
async def complete_substage(project_id: str, request: Request):
    """Complete a sub-stage - forward-only progression"""
    user = await get_current_user(request)
    body = await request.json()
    
    substage_id = body.get("substage_id")
    
    if not substage_id:
        raise HTTPException(status_code=400, detail="substage_id is required")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if project is on Hold - block progression
    if project.get("hold_status") == "Hold":
        raise HTTPException(status_code=400, detail="Cannot update milestones while project is on Hold. Please reactivate the project first.")
    
    if project.get("hold_status") == "Deactivated":
        raise HTTPException(status_code=400, detail="Cannot update milestones on a Deactivated project.")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # PERMISSION CHECK: Explicit permission required - NO role-based fallback
    has_perm, perm_error = check_milestone_permission(user_doc, substage_id)
    if not has_perm:
        raise HTTPException(status_code=403, detail=perm_error)
    
    completed_substages = project.get("completed_substages", [])
    
    # Validate forward-only progression
    can_complete, error_msg = can_complete_substage(substage_id, completed_substages)
    if not can_complete:
        raise HTTPException(status_code=400, detail=error_msg)
    
    now = datetime.now(timezone.utc)
    pid = project.get("pid", "N/A")
    
    # Get sub-stage info
    all_substages = get_all_substages()
    substage_info = next((s for s in all_substages if s["id"] == substage_id), None)
    if not substage_info:
        raise HTTPException(status_code=400, detail="Invalid sub-stage")
    
    # Add to completed list
    completed_substages.append(substage_id)
    
    # Check if parent group is now complete
    parent_group = next((g for g in MILESTONE_GROUPS if g["id"] == substage_info["group_id"]), None)
    group_complete = False
    new_stage = project.get("stage", "Design Finalization")
    
    if parent_group:
        group_complete = all(s["id"] in completed_substages for s in parent_group["subStages"])
        if group_complete:
            new_stage = parent_group["name"]
    
    # Create activity log entry
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"✅ Completed: {substage_info['name']} ({substage_info['group_name']})",
        "is_system": True,
        "created_at": now.isoformat(),
        "metadata": {
            "type": "substage_complete",
            "pid": pid,
            "substage_id": substage_id,
            "substage_name": substage_info["name"],
            "group_id": substage_info["group_id"],
            "group_name": substage_info["group_name"]
        }
    }
    
    # If group complete, add group completion comment
    group_comment = None
    if group_complete:
        group_comment = {
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"🎉 Milestone Complete: {parent_group['name']} - All sub-stages completed",
            "is_system": True,
            "created_at": now.isoformat(),
            "metadata": {
                "type": "milestone_complete",
                "pid": pid,
                "group_id": parent_group["id"],
                "group_name": parent_group["name"]
            }
        }
    
    # Update project
    update_ops = {
        "$set": {
            "completed_substages": completed_substages,
            "stage": new_stage,
            "updated_at": now.isoformat()
        },
        "$push": {"comments": system_comment}
    }
    
    await db.projects.update_one({"project_id": project_id}, update_ops)
    
    # Add group completion comment separately if needed
    if group_comment:
        await db.projects.update_one(
            {"project_id": project_id},
            {"$push": {"comments": group_comment}}
        )
    
    # Auto-create warranty when "closed" substage is completed (Handover milestone complete)
    if substage_id == "closed" and group_complete:
        try:
            await create_warranty_for_project(project_id, user.user_id, user.name)
        except Exception as e:
            logger.error(f"Failed to create warranty for project {project_id}: {e}")
    
    return {
        "success": True,
        "substage_id": substage_id,
        "substage_name": substage_info["name"],
        "group_name": substage_info["group_name"],
        "group_complete": group_complete,
        "completed_substages": completed_substages,
        "current_stage": new_stage,
        "comment": system_comment
    }

@api_router.get("/projects/{project_id}/substages")
async def get_project_substages(project_id: str, request: Request):
    """Get project sub-stage progress"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get user's effective permissions for milestone access control
    user_doc = await db.users.find_one({"user_id": user.user_id})
    user_permissions = get_user_permissions(user_doc) if user_doc else []
    
    # Calculate which milestone groups the user can update
    user_milestone_permissions = {}
    for group_id, perm in MILESTONE_GROUP_PERMISSIONS.items():
        user_milestone_permissions[group_id] = has_permission(user_doc, perm) if user_doc else False
    
    completed_substages = project.get("completed_substages", [])
    current_group = get_current_milestone_group(completed_substages)
    
    # Calculate progress for each group
    group_progress = []
    for group in MILESTONE_GROUPS:
        completed = sum(1 for s in group["subStages"] if s["id"] in completed_substages)
        total = len(group["subStages"])
        group_progress.append({
            "id": group["id"],
            "name": group["name"],
            "completed": completed,
            "total": total,
            "percentage": round((completed / total) * 100) if total > 0 else 0,
            "is_complete": completed == total
        })
    
    return {
        "completed_substages": completed_substages,
        "current_group": current_group["id"] if current_group else None,
        "current_group_name": current_group["name"] if current_group else None,
        "group_progress": group_progress,
        "milestone_groups": MILESTONE_GROUPS,
        "percentage_substages": project.get("percentage_substages", {}),
        # Permission info for frontend
        "milestone_permissions": MILESTONE_GROUP_PERMISSIONS,
        "user_milestone_permissions": user_milestone_permissions
    }

@api_router.post("/projects/{project_id}/substage/percentage")
async def update_percentage_substage(project_id: str, request: Request):
    """Update a percentage-based sub-stage (Non-Modular Dependency Works)"""
    user = await get_current_user(request)
    body = await request.json()
    
    substage_id = body.get("substage_id")
    percentage = body.get("percentage", 0)
    comment = body.get("comment", "")
    
    if not substage_id:
        raise HTTPException(status_code=400, detail="substage_id is required")
    
    if not isinstance(percentage, (int, float)) or percentage < 0 or percentage > 100:
        raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if project is on Hold - block progression
    if project.get("hold_status") == "Hold":
        raise HTTPException(status_code=400, detail="Cannot update milestones while project is on Hold. Please reactivate the project first.")
    
    if project.get("hold_status") == "Deactivated":
        raise HTTPException(status_code=400, detail="Cannot update milestones on a Deactivated project.")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # PERMISSION CHECK: Explicit permission required - NO role-based fallback
    has_perm, perm_error = check_milestone_permission(user_doc, substage_id)
    if not has_perm:
        raise HTTPException(status_code=403, detail=perm_error)
    
    completed_substages = project.get("completed_substages", [])
    percentage_substages = project.get("percentage_substages", {})
    
    # Validate that this is a percentage-type sub-stage and can be updated
    all_substages = get_all_substages()
    substage_info = next((s for s in all_substages if s["id"] == substage_id), None)
    
    if not substage_info:
        raise HTTPException(status_code=400, detail="Invalid sub-stage")
    
    # Check if the sub-stage is already fully completed
    if substage_id in completed_substages:
        raise HTTPException(status_code=400, detail="Sub-stage already completed. Cannot update.")
    
    # Forward-only check: previous sub-stages must be completed
    substage_ids = [s["id"] for s in all_substages]
    target_index = substage_ids.index(substage_id)
    
    if target_index > 0:
        prev_substage_id = substage_ids[target_index - 1]
        if prev_substage_id not in completed_substages:
            prev_substage = all_substages[target_index - 1]
            raise HTTPException(
                status_code=400, 
                detail=f"Must complete '{prev_substage['name']}' first"
            )
    
    now = datetime.now(timezone.utc)
    pid = project.get("pid", "N/A")
    old_percentage = percentage_substages.get(substage_id, 0)
    
    # Validate forward-only for percentage (cannot decrease)
    if percentage < old_percentage:
        if user.role != "Admin":
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot decrease progress from {old_percentage}% to {percentage}%. Progress is forward-only."
            )
    
    # Update percentage
    percentage_substages[substage_id] = percentage
    
    # Create activity log
    comment_text = f"📊 {substage_info['name']} progress updated: {old_percentage}% → {percentage}%"
    if comment:
        comment_text += f" — {comment}"
    
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": comment_text,
        "is_system": True,
        "created_at": now.isoformat(),
        "metadata": {
            "type": "percentage_update",
            "pid": pid,
            "substage_id": substage_id,
            "substage_name": substage_info["name"],
            "group_id": substage_info["group_id"],
            "group_name": substage_info["group_name"],
            "old_percentage": old_percentage,
            "new_percentage": percentage
        }
    }
    
    # Check if 100% - auto-complete the sub-stage
    auto_completed = False
    group_complete = False
    
    if percentage >= 100:
        completed_substages.append(substage_id)
        auto_completed = True
        
        # Add completion comment
        completion_comment = {
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"✅ {substage_info['name']} auto-completed at 100%",
            "is_system": True,
            "created_at": now.isoformat(),
            "metadata": {
                "type": "substage_complete",
                "pid": pid,
                "substage_id": substage_id,
                "auto_completed": True
            }
        }
        
        # Check if parent group is now complete
        parent_group = next((g for g in MILESTONE_GROUPS if g["id"] == substage_info["group_id"]), None)
        if parent_group:
            group_complete = all(s["id"] in completed_substages for s in parent_group["subStages"])
        
        # Update with both comments
        await db.projects.update_one(
            {"project_id": project_id},
            {
                "$set": {
                    "percentage_substages": percentage_substages,
                    "completed_substages": completed_substages,
                    "updated_at": now.isoformat()
                },
                "$push": {"comments": {"$each": [system_comment, completion_comment]}}
            }
        )
        
        # Add group completion comment if needed
        if group_complete:
            group_comment = {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": f"🎉 Milestone Complete: {parent_group['name']} - All sub-stages completed",
                "is_system": True,
                "created_at": now.isoformat(),
                "metadata": {
                    "type": "milestone_complete",
                    "pid": pid,
                    "group_id": parent_group["id"],
                    "group_name": parent_group["name"]
                }
            }
            await db.projects.update_one(
                {"project_id": project_id},
                {"$push": {"comments": group_comment}}
            )
    else:
        # Just update percentage
        await db.projects.update_one(
            {"project_id": project_id},
            {
                "$set": {
                    "percentage_substages": percentage_substages,
                    "updated_at": now.isoformat()
                },
                "$push": {"comments": system_comment}
            }
        )
    
    return {
        "success": True,
        "substage_id": substage_id,
        "substage_name": substage_info["name"],
        "percentage": percentage,
        "auto_completed": auto_completed,
        "group_complete": group_complete,
        "completed_substages": completed_substages,
        "percentage_substages": percentage_substages
    }

# ============ HOLD/ACTIVATE/DEACTIVATE SYSTEM FOR PROJECTS ============

@api_router.put("/projects/{project_id}/hold-status")
async def update_project_hold_status(project_id: str, status_update: HoldStatusUpdate, request: Request):
    """Update project hold status (Hold/Activate/Deactivate)"""
    user = await get_current_user(request)
    
    # Permission check
    action = status_update.action
    allowed_actions = ["Hold", "Activate", "Deactivate"]
    
    if action not in allowed_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {allowed_actions}")
    
    # Role-based permissions:
    # - Admin, Manager can Hold/Activate/Deactivate
    # - Designer can only Hold
    if user.role not in ["Admin", "Manager", "DesignManager", "ProductionManager", "Designer"]:
        raise HTTPException(status_code=403, detail="You don't have permission to change project status")
    
    if user.role == "Designer" and action != "Hold":
        raise HTTPException(status_code=403, detail="Designers can only place projects on Hold")
    
    # Validate reason
    reason = status_update.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required for this action")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    current_hold_status = project.get("hold_status", "Active")
    
    # Validate state transitions
    if action == "Hold" and current_hold_status == "Hold":
        raise HTTPException(status_code=400, detail="Project is already on Hold")
    
    if action == "Activate":
        if current_hold_status == "Active":
            raise HTTPException(status_code=400, detail="Project is already Active")
    
    if action == "Deactivate" and current_hold_status == "Deactivated":
        raise HTTPException(status_code=400, detail="Project is already Deactivated")
    
    now = datetime.now(timezone.utc)
    
    # Determine new status
    new_status = action if action in ["Hold", "Deactivated"] else "Active"
    if action == "Deactivate":
        new_status = "Deactivated"
    
    # Create history entry
    history_entry = {
        "id": f"hold_{uuid.uuid4().hex[:8]}",
        "action": action,
        "previous_status": current_hold_status,
        "new_status": new_status,
        "reason": reason,
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat()
    }
    
    # Create activity log comment
    pid_str = f" (PID: {project.get('pid')})" if project.get('pid') else ""
    action_messages = {
        "Hold": f"Project placed on HOLD{pid_str} by {user.name} – Reason: {reason}",
        "Activate": f"Project Activated again{pid_str} by {user.name} – Reason: {reason}",
        "Deactivate": f"Project Deactivated{pid_str} by {user.name} – Reason: {reason}"
    }
    
    comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": action_messages[action],
        "is_system": True,
        "type": "hold_status_change",
        "created_at": now.isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "hold_status": new_status,
                "updated_at": now.isoformat()
            },
            "$push": {
                "hold_history": history_entry,
                "comments": comment
            }
        }
    )
    
    return {
        "message": f"Project {action.lower()}d successfully",
        "project_id": project_id,
        "hold_status": new_status,
        "history_entry": history_entry
    }

# ============ FILES ENDPOINTS ============

@api_router.get("/projects/{project_id}/files")
async def get_project_files(project_id: str, request: Request):
    """Get all files for a project"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return project.get("files", [])

@api_router.post("/projects/{project_id}/files")
async def upload_file(project_id: str, file_data: FileUpload, request: Request):
    """Upload a file to a project"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    new_file = {
        "id": f"file_{uuid.uuid4().hex[:8]}",
        "file_name": file_data.file_name,
        "file_url": file_data.file_url,
        "file_type": file_data.file_type,
        "uploaded_by": user.user_id,
        "uploaded_by_name": user.name,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$push": {"files": new_file},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return new_file

@api_router.delete("/projects/{project_id}/files/{file_id}")
async def delete_file(project_id: str, file_id: str, request: Request):
    """Delete a file (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.projects.update_one(
        {"project_id": project_id},
        {
            "$pull": {"files": {"id": file_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {"message": "File deleted successfully"}

# ============ NOTES ENDPOINTS ============

@api_router.get("/projects/{project_id}/notes")
async def get_project_notes(project_id: str, request: Request):
    """Get all notes for a project"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return project.get("notes", [])

@api_router.post("/projects/{project_id}/notes")
async def create_note(project_id: str, note_data: NoteCreate, request: Request):
    """Create a new note"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc).isoformat()
    new_note = {
        "id": f"note_{uuid.uuid4().hex[:8]}",
        "title": note_data.title,
        "content": note_data.content,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now,
        "updated_at": now
    }
    
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$push": {"notes": new_note},
            "$set": {"updated_at": now}
        }
    )
    
    return new_note

@api_router.put("/projects/{project_id}/notes/{note_id}")
async def update_note(project_id: str, note_id: str, note_data: NoteUpdate, request: Request):
    """Update a note (creator or Admin only)"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find the note
    notes = project.get("notes", [])
    note_index = None
    for i, note in enumerate(notes):
        if note["id"] == note_id:
            note_index = i
            break
    
    if note_index is None:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note = notes[note_index]
    
    # Check permission - only creator or Admin can edit
    if note["created_by"] != user.user_id and user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only creator or Admin can edit this note")
    
    # Update fields
    now = datetime.now(timezone.utc).isoformat()
    if note_data.title is not None:
        notes[note_index]["title"] = note_data.title
    if note_data.content is not None:
        notes[note_index]["content"] = note_data.content
    notes[note_index]["updated_at"] = now
    
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {"notes": notes, "updated_at": now}
        }
    )
    
    return notes[note_index]

# ============ COLLABORATORS ENDPOINTS ============

@api_router.get("/projects/{project_id}/collaborators")
async def get_project_collaborators(project_id: str, request: Request):
    """Get all collaborators for a project with user details"""
    user = await get_current_user(request)
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get collaborator details
    collaborator_ids = project.get("collaborators", [])
    collaborators = []
    
    for uid in collaborator_ids:
        user_doc = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1, "email": 1})
        if user_doc:
            collaborators.append(user_doc)
    
    return collaborators

@api_router.post("/projects/{project_id}/collaborators")
async def add_collaborator(project_id: str, collab_data: CollaboratorAdd, request: Request):
    """Add a collaborator (Admin or Manager roles)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user exists
    target_user = await db.users.find_one({"user_id": collab_data.user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a collaborator
    if collab_data.user_id in project.get("collaborators", []):
        raise HTTPException(status_code=400, detail="User is already a collaborator")
    
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$push": {"collaborators": collab_data.user_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "message": "Collaborator added successfully",
        "user_id": collab_data.user_id,
        "name": target_user.get("name")
    }

@api_router.delete("/projects/{project_id}/collaborators/{user_id}")
async def remove_collaborator(project_id: str, user_id: str, request: Request):
    """Remove a collaborator (Admin or Manager)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    result = await db.projects.update_one(
        {"project_id": project_id},
        {
            "$pull": {"collaborators": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    
    return {"message": "Collaborator removed successfully"}

# ============ LEADS ENDPOINTS ============

def generate_lead_timeline(stage: str, created_date: str):
    """Generate lead timeline based on current stage with TAT-based expected dates"""
    base_date = datetime.fromisoformat(created_date.replace("Z", "+00:00"))
    if base_date.tzinfo is None:
        base_date = base_date.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    stage_index = LEAD_STAGES.index(stage) if stage in LEAD_STAGES else 0
    
    timeline = []
    cumulative_days = 0
    
    for idx, milestone in enumerate(LEAD_MILESTONES):
        milestone_title = milestone["title"]
        milestone_stage = milestone["stage_ref"]
        milestone_stage_index = LEAD_STAGES.index(milestone_stage) if milestone_stage in LEAD_STAGES else 0
        
        # Calculate expected date using TAT rules
        tat_days = LEAD_TAT.get(milestone_title)
        if tat_days is not None:
            cumulative_days += tat_days
        else:
            cumulative_days += 2  # Default fallback
        
        expected_date = base_date + timedelta(days=cumulative_days)
        
        # Determine status and completedDate
        if milestone_stage_index < stage_index:
            status = "completed"
            completed_date = expected_date.isoformat()  # Use expected as completed for past milestones
        elif milestone_stage_index == stage_index:
            if idx == 0 or milestone_title == "Lead Created":
                status = "completed"
                completed_date = base_date.isoformat()
            else:
                # Check if delayed
                if expected_date < now:
                    status = "delayed"
                else:
                    status = "pending"
                completed_date = None
        else:
            # Future milestone - check if delayed
            if expected_date < now:
                status = "delayed"
            else:
                status = "pending"
            completed_date = None
        
        timeline.append({
            "id": f"tl_{uuid.uuid4().hex[:6]}",
            "title": milestone_title,
            "expectedDate": expected_date.isoformat(),
            "completedDate": completed_date,
            "status": status,
            "stage_ref": milestone_stage
        })
    
    return timeline


def generate_project_timeline(stage: str, created_date: str):
    """Generate project timeline based on current stage with TAT-based expected dates"""
    base_date = datetime.fromisoformat(created_date.replace("Z", "+00:00"))
    if base_date.tzinfo is None:
        base_date = base_date.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    stage_index = STAGE_ORDER.index(stage) if stage in STAGE_ORDER else 0
    
    timeline = []
    cumulative_days = 0
    
    for stage_idx, stage_name in enumerate(STAGE_ORDER):
        # Find milestone group for this stage
        milestone_group = None
        for group in MILESTONE_GROUPS:
            if group["name"] == stage_name:
                milestone_group = group
                break
        
        if not milestone_group:
            continue
            
        milestones = [substage["name"] for substage in milestone_group.get("subStages", [])]
        
        for milestone_idx, milestone_title in enumerate(milestones):
            # Calculate expected date using TAT rules
            tat_days = PROJECT_TAT.get(milestone_title, 3)  # Default 3 days if not specified
            cumulative_days += tat_days
            
            expected_date = base_date + timedelta(days=cumulative_days)
            
            # Determine status and completedDate
            if stage_idx < stage_index:
                # Past stage - all completed
                status = "completed"
                completed_date = expected_date.isoformat()
            elif stage_idx == stage_index:
                # Current stage
                if milestone_idx == 0:
                    status = "completed"
                    completed_date = now.isoformat()
                else:
                    if expected_date < now:
                        status = "delayed"
                    else:
                        status = "pending"
                    completed_date = None
            else:
                # Future stage
                if expected_date < now:
                    status = "delayed"
                else:
                    status = "pending"
                completed_date = None
            
            timeline.append({
                "id": f"tl_{uuid.uuid4().hex[:6]}",
                "title": milestone_title,
                "expectedDate": expected_date.isoformat(),
                "completedDate": completed_date,
                "status": status,
                "stage_ref": stage_name
            })
    
    return timeline


def update_timeline_on_stage_change(timeline: list, old_stage: str, new_stage: str, stage_order: list):
    """Update timeline milestones when stage changes"""
    now = datetime.now(timezone.utc)
    new_stage_index = stage_order.index(new_stage) if new_stage in stage_order else 0
    
    for item in timeline:
        item_stage = item.get("stage_ref", "")
        if item_stage not in stage_order:
            continue
            
        item_stage_index = stage_order.index(item_stage)
        
        if item_stage_index < new_stage_index:
            # Past stage - mark as completed
            item["status"] = "completed"
            if not item.get("completedDate"):
                item["completedDate"] = now.isoformat()
        elif item_stage_index == new_stage_index:
            # Current stage - first milestone completed, others check for delay
            expected_date_str = item.get("expectedDate", item.get("date", ""))
            if expected_date_str:
                try:
                    expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                    if expected.tzinfo is None:
                        expected = expected.replace(tzinfo=timezone.utc)
                    
                    if expected < now and item["status"] != "completed":
                        item["status"] = "delayed"
                    elif item["status"] not in ["completed", "delayed"]:
                        item["status"] = "pending"
                except:
                    if item["status"] != "completed":
                        item["status"] = "pending"
            else:
                if item["status"] != "completed":
                    item["status"] = "pending"
        else:
            # Future stage - check for delay
            expected_date_str = item.get("expectedDate", item.get("date", ""))
            if expected_date_str:
                try:
                    expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                    if expected.tzinfo is None:
                        expected = expected.replace(tzinfo=timezone.utc)
                    
                    if expected < now:
                        item["status"] = "delayed"
                    else:
                        item["status"] = "pending"
                except:
                    item["status"] = "pending"
            else:
                item["status"] = "pending"
            item["completedDate"] = None
    
    return timeline

@api_router.get("/leads")
async def list_leads(
    request: Request, 
    status: Optional[str] = None, 
    search: Optional[str] = None,
    time_filter: Optional[str] = None,  # this_month, last_month, this_quarter, custom, all
    start_date: Optional[str] = None,   # For custom date range (ISO format)
    end_date: Optional[str] = None      # For custom date range (ISO format)
):
    """List leads based on permission - shows only actual leads (not pre-sales)"""
    user = await get_current_user(request)
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check
    has_view_all = has_permission(user_doc, "leads.view_all")
    has_view = has_permission(user_doc, "leads.view")
    
    if not has_view_all and not has_view:
        raise HTTPException(status_code=403, detail="Access denied - no leads permission")
    
    # Base filter: only show leads (not presales), not converted
    lead_type_filter = {
        "$or": [
            {"lead_type": "lead"},
            {"lead_type": {"$exists": False}, "stage": {"$nin": ["New", "Contacted", "Waiting", "Qualified", "Dropped"]}}
        ]
    }
    
    # Build query based on permission level
    if has_view_all:
        # User can see all leads
        query = {
            "is_converted": False,
            **lead_type_filter
        }
    else:
        # User has leads.view - can only see assigned/collaborated leads
        query = {
            "is_converted": False,
            "$and": [
                lead_type_filter,
                {
                    "$or": [
                        {"assigned_to": user.user_id},
                        {"designer_id": user.user_id},
                        {"collaborators": {"$elemMatch": {"user_id": user.user_id}}}
                    ]
                }
            ]
        }
    
    # Status filter
    if status and status != "all":
        query["status"] = status
    
    # Time-based filter
    if time_filter and time_filter != "all":
        now = datetime.now(timezone.utc)
        date_filter = None
        
        if time_filter == "this_month":
            first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            date_filter = {"$gte": first_of_month.isoformat()}
        elif time_filter == "last_month":
            first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month = first_of_this_month - timedelta(days=1)
            first_of_last_month = last_month.replace(day=1)
            date_filter = {"$gte": first_of_last_month.isoformat(), "$lt": first_of_this_month.isoformat()}
        elif time_filter == "this_quarter":
            quarter = (now.month - 1) // 3
            first_month_of_quarter = quarter * 3 + 1
            first_of_quarter = now.replace(month=first_month_of_quarter, day=1, hour=0, minute=0, second=0, microsecond=0)
            date_filter = {"$gte": first_of_quarter.isoformat()}
        elif time_filter == "custom" and start_date:
            date_filter = {"$gte": start_date}
            if end_date:
                date_filter["$lte"] = end_date
        
        if date_filter:
            query["created_at"] = date_filter
    
    leads = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        leads = [
            l for l in leads 
            if search_lower in l.get("customer_name", "").lower() 
            or search_lower in l.get("customer_phone", "").replace(" ", "")
        ]
    
    # Get assigned user details
    result = []
    for lead in leads:
        lead_data = {**lead}
        
        # Get assigned pre-sales user details
        if lead.get("assigned_to"):
            assigned_user = await db.users.find_one(
                {"user_id": lead["assigned_to"]}, 
                {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
            )
            lead_data["assigned_to_details"] = assigned_user
        
        # Get designer details
        if lead.get("designer_id"):
            designer = await db.users.find_one(
                {"user_id": lead["designer_id"]}, 
                {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
            )
            lead_data["designer_details"] = designer
        
        # Convert datetime to string
        if isinstance(lead_data.get("updated_at"), datetime):
            lead_data["updated_at"] = lead_data["updated_at"].isoformat()
        if isinstance(lead_data.get("created_at"), datetime):
            lead_data["created_at"] = lead_data["created_at"].isoformat()
        
        result.append(lead_data)
    
    # Sort by updated_at descending
    result.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    
    return result

@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, request: Request):
    """Get single lead by ID"""
    user = await get_current_user(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check
    has_view_all = has_permission(user_doc, "leads.view_all")
    has_view = has_permission(user_doc, "leads.view")
    
    if not has_view_all and not has_view:
        raise HTTPException(status_code=403, detail="Access denied - no leads permission")
    
    # If user has leads.view but NOT leads.view_all, check if assigned/collaborated
    if has_view and not has_view_all:
        is_assigned = lead.get("assigned_to") == user.user_id
        is_designer = lead.get("designer_id") == user.user_id
        collaborator_ids = [c.get("user_id") for c in lead.get("collaborators", []) if isinstance(c, dict)]
        is_collaborator = user.user_id in collaborator_ids
        
        if not (is_assigned or is_designer or is_collaborator):
            raise HTTPException(status_code=403, detail="Access denied - not assigned to this lead")
    
    # Get assigned user details
    if lead.get("assigned_to"):
        assigned_user = await db.users.find_one(
            {"user_id": lead["assigned_to"]}, 
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        )
        lead["assigned_to_details"] = assigned_user
    
    # Get designer details
    if lead.get("designer_id"):
        designer = await db.users.find_one(
            {"user_id": lead["designer_id"]}, 
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        )
        lead["designer_details"] = designer
    
    # Convert datetime to string
    if isinstance(lead.get("updated_at"), datetime):
        lead["updated_at"] = lead["updated_at"].isoformat()
    if isinstance(lead.get("created_at"), datetime):
        lead["created_at"] = lead["created_at"].isoformat()
    
    return lead

@api_router.post("/leads")
async def create_lead(lead_data: LeadCreate, request: Request):
    """Create a new lead directly (for walk-ins, referrals, legacy data)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    lead_id = f"lead_{uuid.uuid4().hex[:8]}"
    
    # Generate PID for direct leads
    pid = await generate_pid()
    
    new_lead = {
        "lead_id": lead_id,
        "lead_type": "lead",  # Direct lead creation
        "pid": pid,  # Assign PID immediately for direct leads
        # Customer Details (persistent across all stages)
        "customer_name": lead_data.customer_name,
        "customer_phone": lead_data.customer_phone,
        "customer_email": lead_data.customer_email,
        "customer_address": lead_data.customer_address,
        "customer_requirements": lead_data.customer_requirements,
        "source": lead_data.source,
        "budget": lead_data.budget,
        # Lead Status
        "status": lead_data.status or "In Progress",
        "stage": "BC Call Done",
        "assigned_to": user.user_id if user.role == "PreSales" else lead_data.assigned_to,
        "designer_id": None,
        "is_converted": False,
        "project_id": None,
        "timeline": generate_lead_timeline("BC Call Done", now.isoformat()),
        "comments": [{
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"Lead created directly by {user.name}. PID: {pid}",
            "is_system": True,
            "created_at": now.isoformat()
        }],
        "collaborators": [],
        "files": [],
        "created_by": user.user_id,
        "updated_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.leads.insert_one(new_lead)
    
    # Remove _id before returning
    new_lead.pop("_id", None)
    
    return new_lead

@api_router.post("/leads/{lead_id}/comments")
async def add_lead_comment(lead_id: str, comment: CommentCreate, request: Request):
    """Add a comment to a lead"""
    user = await get_current_user(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check for commenting (requires leads.update)
    has_update = has_permission(user_doc, "leads.update")
    has_view_all = has_permission(user_doc, "leads.view_all")
    
    if not has_update:
        raise HTTPException(status_code=403, detail="Access denied - no leads.update permission")
    
    # If user doesn't have view_all, check if they're assigned/collaborating
    if not has_view_all:
        is_assigned = lead.get("assigned_to") == user.user_id or lead.get("designer_id") == user.user_id
        collaborator_ids = [c.get("user_id") for c in lead.get("collaborators", []) if isinstance(c, dict)]
        is_collaborator = user.user_id in collaborator_ids
        
        if not is_assigned and not is_collaborator:
            raise HTTPException(status_code=403, detail="Access denied - not assigned to this lead")
    
    new_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": comment.message,
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$push": {"comments": new_comment},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return new_comment

@api_router.put("/leads/{lead_id}/customer-details")
async def update_lead_customer_details(lead_id: str, request: Request):
    """
    Update customer details on a lead.
    Requires leads.update permission and must be assigned/collaborating on the lead
    """
    user = await get_current_user(request)
    body = await request.json()
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check (requires leads.update)
    has_update = has_permission(user_doc, "leads.update")
    has_view_all = has_permission(user_doc, "leads.view_all")
    
    if not has_update:
        raise HTTPException(status_code=403, detail="Access denied - no leads.update permission")
    
    # If user doesn't have view_all, check if they're assigned/collaborating
    if not has_view_all:
        is_assigned = lead.get("assigned_to") == user.user_id or lead.get("designer_id") == user.user_id
        collaborator_ids = [c.get("user_id") for c in lead.get("collaborators", []) if isinstance(c, dict)]
        is_collaborator = user.user_id in collaborator_ids
        
        if not is_assigned and not is_collaborator:
            raise HTTPException(status_code=403, detail="Access denied - not assigned to this lead")
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    allowed_fields = ["customer_name", "customer_phone", "customer_email", 
                      "customer_address", "customer_requirements", "source", "budget"]
    
    for field in allowed_fields:
        if field in body:
            update_dict[field] = body[field]
    
    if len(update_dict) > 1:  # More than just updated_at
        await db.leads.update_one(
            {"lead_id": lead_id},
            {"$set": update_dict}
        )
        
        # Add system comment
        system_comment = {
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"Customer details updated by {user.name}",
            "is_system": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.leads.update_one(
            {"lead_id": lead_id},
            {"$push": {"comments": system_comment}}
        )
    
    # Return updated lead
    updated_lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    return updated_lead

@api_router.put("/leads/{lead_id}/stage")
async def update_lead_stage(lead_id: str, stage_update: LeadStageUpdate, request: Request):
    """Update lead stage - forward-only progression (except Admin)"""
    user = await get_current_user(request)
    
    if stage_update.stage not in LEAD_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {LEAD_STAGES}")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check (requires leads.update)
    has_update = has_permission(user_doc, "leads.update")
    has_view_all = has_permission(user_doc, "leads.view_all")
    
    if not has_update:
        raise HTTPException(status_code=403, detail="Access denied - no leads.update permission")
    
    # If user doesn't have view_all, check if they're assigned/collaborating
    if not has_view_all:
        is_assigned = lead.get("assigned_to") == user.user_id or lead.get("designer_id") == user.user_id
        collaborator_ids = [c.get("user_id") for c in lead.get("collaborators", []) if isinstance(c, dict)]
        is_collaborator = user.user_id in collaborator_ids
        
        if not is_assigned and not is_collaborator:
            raise HTTPException(status_code=403, detail="Access denied - not assigned to this lead")
    
    old_stage = lead.get("stage", "BC Call Done")
    new_stage = stage_update.stage
    
    if old_stage == new_stage:
        return {"message": "Stage unchanged", "stage": new_stage}
    
    # FORWARD-ONLY VALIDATION (except Admin)
    old_index = LEAD_STAGES.index(old_stage) if old_stage in LEAD_STAGES else 0
    new_index = LEAD_STAGES.index(new_stage)
    
    if new_index < old_index:
        # Backward movement requested
        if user.role != "Admin":
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot move backward from '{old_stage}' to '{new_stage}'. Stage progression is forward-only. Only Admin can rollback stages."
            )
        # Admin can rollback - add special comment
        rollback_note = f" (Admin rollback from '{old_stage}')"
    else:
        rollback_note = ""
    
    now = datetime.now(timezone.utc)
    
    # Create system comment
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Stage updated from \"{old_stage}\" to \"{new_stage}\"{rollback_note}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    # Update timeline with TAT-aware logic
    timeline = lead.get("timeline", [])
    new_stage_index = LEAD_STAGES.index(new_stage)
    
    for item in timeline:
        item_stage = item.get("stage_ref", "")
        if item_stage in LEAD_STAGES:
            item_index = LEAD_STAGES.index(item_stage)
            if item_index < new_stage_index:
                # Past stages - mark as completed
                item["status"] = "completed"
                if not item.get("completedDate"):
                    item["completedDate"] = now.isoformat()
            elif item_index == new_stage_index:
                # Current stage - mark first as completed, check others for delay
                item["status"] = "completed"
                if not item.get("completedDate"):
                    item["completedDate"] = now.isoformat()
            else:
                # Future stages - check if delayed
                expected_date_str = item.get("expectedDate", item.get("date", ""))
                if expected_date_str:
                    try:
                        expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                        if expected.tzinfo is None:
                            expected = expected.replace(tzinfo=timezone.utc)
                        if expected < now:
                            item["status"] = "delayed"
                        else:
                            item["status"] = "pending"
                    except:
                        item["status"] = "pending"
                else:
                    item["status"] = "pending"
                item["completedDate"] = None
    
    # Update status based on stage
    new_status = lead.get("status", "New")
    if new_stage == "Booking Completed":
        new_status = "Qualified"
    elif new_stage in ["BC Call Done", "BOQ Shared"]:
        new_status = "Contacted"
    elif new_stage in ["Site Meeting", "Revised BOQ Shared", "Waiting for Booking"]:
        new_status = "Waiting"
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "stage": new_stage,
                "status": new_status,
                "timeline": timeline,
                "updated_at": now.isoformat()
            },
            "$push": {"comments": system_comment}
        }
    )
    
    # Send notifications to relevant users
    try:
        relevant_users = await get_relevant_users_for_lead(lead)
        # Remove the user who made the change
        relevant_users = [uid for uid in relevant_users if uid != user.user_id]
        
        await notify_users(
            relevant_users,
            "Lead Stage Updated",
            f"{user.name} moved lead '{lead.get('customer_name', 'Unknown')}' to stage '{new_stage}'",
            "stage-change",
            f"/leads/{lead_id}"
        )
    except Exception as e:
        print(f"Error sending notifications: {e}")
    
    return {
        "message": "Stage updated successfully",
        "stage": new_stage,
        "status": new_status,
        "system_comment": system_comment
    }

@api_router.put("/leads/{lead_id}/assign-designer")
async def assign_designer(lead_id: str, assign_data: LeadAssignDesigner, request: Request):
    """Assign a designer to a lead - requires leads.update permission"""
    user = await get_current_user(request)
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check (requires leads.update)
    has_update = has_permission(user_doc, "leads.update")
    if not has_update:
        raise HTTPException(status_code=403, detail="Access denied - no leads.update permission")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Verify designer exists
    designer = await db.users.find_one(
        {"user_id": assign_data.designer_id, "role": "Designer"},
        {"_id": 0, "name": 1}
    )
    
    if not designer:
        raise HTTPException(status_code=404, detail="Designer not found")
    
    # Create system comment
    now = datetime.now(timezone.utc)
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Lead assigned to {designer['name']} on {now.strftime('%d/%m/%Y at %H:%M')}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "designer_id": assign_data.designer_id,
                "updated_at": now.isoformat()
            },
            "$push": {"comments": system_comment}
        }
    )
    
    return {
        "message": "Designer assigned successfully",
        "designer_id": assign_data.designer_id,
        "designer_name": designer["name"]
    }

# ============ LEAD COLLABORATOR ENDPOINTS ============

@api_router.get("/leads/{lead_id}/collaborators")
async def get_lead_collaborators(lead_id: str, request: Request):
    """Get collaborators for a lead"""
    user = await get_current_user(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    collaborators = lead.get("collaborators", [])
    
    # Enrich with user details
    enriched = []
    for collab in collaborators:
        user_doc = await db.users.find_one({"user_id": collab.get("user_id")}, {"_id": 0})
        if user_doc:
            enriched.append({
                **collab,
                "name": user_doc.get("name", "Unknown"),
                "email": user_doc.get("email", ""),
                "picture": user_doc.get("picture")
            })
        else:
            enriched.append(collab)
    
    return {"collaborators": enriched}

@api_router.post("/leads/{lead_id}/collaborators")
async def add_lead_collaborator(lead_id: str, request: Request):
    """Add collaborator to a lead - requires leads.update permission"""
    user = await get_current_user(request)
    body = await request.json()
    
    collaborator_user_id = body.get("user_id")
    reason = body.get("reason", "Added by user")
    
    if not collaborator_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check (requires leads.update)
    has_update = has_permission(user_doc, "leads.update")
    has_view_all = has_permission(user_doc, "leads.view_all")
    
    if not has_update:
        raise HTTPException(status_code=403, detail="Access denied - no leads.update permission")
    
    # If user doesn't have view_all, check if they're assigned/collaborating
    if not has_view_all:
        is_assigned = lead.get("assigned_to") == user.user_id or lead.get("designer_id") == user.user_id
        collaborator_ids = [c.get("user_id") for c in lead.get("collaborators", []) if isinstance(c, dict)]
        is_collaborator = user.user_id in collaborator_ids
        
        if not is_assigned and not is_collaborator:
            raise HTTPException(status_code=403, detail="Access denied - not assigned to this lead")
    
    # Verify collaborator exists
    collab_user = await db.users.find_one({"user_id": collaborator_user_id}, {"_id": 0})
    if not collab_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a collaborator
    existing_collaborators = lead.get("collaborators", [])
    if any(c.get("user_id") == collaborator_user_id for c in existing_collaborators):
        raise HTTPException(status_code=400, detail="User is already a collaborator")
    
    now = datetime.now(timezone.utc)
    
    new_collaborator = {
        "user_id": collaborator_user_id,
        "role": collab_user.get("role", "Unknown"),
        "added_at": now.isoformat(),
        "added_by": user.user_id,
        "reason": reason,
        "can_edit": True  # Permission-based, not role-based
    }
    
    # System comment
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Added {collab_user.get('name', 'Unknown')} as collaborator",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$push": {
                "collaborators": new_collaborator,
                "comments": system_comment
            },
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {
        "success": True,
        "collaborator": {
            **new_collaborator,
            "name": collab_user.get("name"),
            "email": collab_user.get("email"),
            "picture": collab_user.get("picture")
        }
    }

@api_router.delete("/leads/{lead_id}/collaborators/{collaborator_user_id}")
async def remove_lead_collaborator(lead_id: str, collaborator_user_id: str, request: Request):
    """Remove collaborator from a lead - requires leads.update permission"""
    user = await get_current_user(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission-based access check (requires leads.update)
    has_update = has_permission(user_doc, "leads.update")
    has_view_all = has_permission(user_doc, "leads.view_all")
    
    if not has_update:
        raise HTTPException(status_code=403, detail="Access denied - no leads.update permission")
    
    # If user doesn't have view_all, check if they're assigned/collaborating
    if not has_view_all:
        is_assigned = lead.get("assigned_to") == user.user_id or lead.get("designer_id") == user.user_id
        collaborator_ids = [c.get("user_id") for c in lead.get("collaborators", []) if isinstance(c, dict)]
        is_collaborator = user.user_id in collaborator_ids
        
        if not is_assigned and not is_collaborator:
            raise HTTPException(status_code=403, detail="Access denied - not assigned to this lead")
    
    # Find collaborator to remove
    collaborators = lead.get("collaborators", [])
    collab_to_remove = next((c for c in collaborators if c.get("user_id") == collaborator_user_id), None)
    
    if not collab_to_remove:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    
    now = datetime.now(timezone.utc)
    
    # Get name for comment
    collab_user = await db.users.find_one({"user_id": collaborator_user_id}, {"_id": 0})
    collab_name = collab_user.get("name", "Unknown") if collab_user else "Unknown"
    
    # System comment
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Removed {collab_name} from collaborators",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$pull": {"collaborators": {"user_id": collaborator_user_id}},
            "$push": {"comments": system_comment},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {"success": True, "message": f"Removed {collab_name} from collaborators"}

@api_router.post("/leads/{lead_id}/convert")
async def convert_to_project(lead_id: str, request: Request):
    """Convert a lead to a project - carries forward PID and all history"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead.get("is_converted"):
        raise HTTPException(status_code=400, detail="Lead already converted")
    
    if lead.get("stage") != "Booking Completed":
        raise HTTPException(status_code=400, detail="Lead must be at 'Booking Completed' stage to convert")
    
    now = datetime.now(timezone.utc)
    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    
    # Get the PID from the lead (should already exist from Pre-Sales conversion)
    pid = lead.get("pid")
    if not pid:
        # Generate PID if somehow missing (backward compatibility)
        pid = await generate_pid()
    
    # Generate project timeline with TAT-aware expected dates
    project_timeline = generate_project_timeline("Design Finalization", now.isoformat())
    
    # Carry forward ALL comments from lead (complete activity history)
    project_comments = lead.get("comments", []).copy()
    project_comments.append({
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Project created from lead on {now.strftime('%d/%m/%Y')} by {user.name}. PID: {pid}",
        "is_system": True,
        "created_at": now.isoformat()
    })
    
    # Carry forward files from lead
    project_files = lead.get("files", []).copy()
    
    # Carry forward collaborators from lead
    lead_collaborators = lead.get("collaborators", [])
    project_collaborator_ids = [c.get("user_id") for c in lead_collaborators if c.get("user_id")]
    
    # Add designer if exists and not already in collaborators
    if lead.get("designer_id") and lead["designer_id"] not in project_collaborator_ids:
        project_collaborator_ids.append(lead["designer_id"])
    
    # Create project with ALL customer details and history carried forward
    new_project = {
        "project_id": project_id,
        "pid": pid,  # PID stays same throughout lifecycle
        "project_name": f"{lead['customer_name']} - Interior Project",
        # Customer Details (carried forward from lead - persistent)
        "client_name": lead["customer_name"],
        "client_phone": lead["customer_phone"],
        "client_email": lead.get("customer_email"),
        "client_address": lead.get("customer_address"),
        "client_requirements": lead.get("customer_requirements"),
        "lead_source": lead.get("source"),
        "budget": lead.get("budget"),
        # Project Details
        "stage": "Design Finalization",
        "collaborators": project_collaborator_ids,
        "collaborator_details": lead_collaborators,  # Full collaborator info
        "summary": f"Converted from lead {lead_id}",
        "lead_id": lead_id,  # Reference to original lead
        "timeline": project_timeline,
        "lead_timeline": lead.get("timeline", []),  # Preserve lead timeline
        "comments": project_comments,  # Full activity history
        "files": project_files,  # Files from lead
        "notes": [],
        "project_value": lead.get("budget") or 0,
        "payment_schedule": [
            {
                "stage": "Design Booking",
                "type": "fixed",
                "fixedAmount": 25000,
                "percentage": 10
            },
            {
                "stage": "Production Start",
                "type": "percentage",
                "percentage": 50
            },
            {
                "stage": "Before Installation",
                "type": "remaining"
            }
        ],
        "custom_payment_schedule_enabled": False,
        "custom_payment_schedule": [],
        "payments": [],
        "updated_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.projects.insert_one(new_project)
    
    # Mark lead as converted
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "is_converted": True,
                "project_id": project_id,
                "updated_at": now.isoformat()
            },
            "$push": {"comments": {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": user.user_id,
                "user_name": user.name,
                "role": user.role,
                "message": f"Converted to project {project_id}. PID: {pid}",
                "is_system": True,
                "created_at": now.isoformat()
            }}
        }
    )
    
    return {
        "message": "Lead converted to project successfully",
        "project_id": project_id,
        "pid": pid,
        "lead_id": lead_id
    }

# ============ HOLD/ACTIVATE/DEACTIVATE SYSTEM FOR LEADS ============

@api_router.put("/leads/{lead_id}/hold-status")
async def update_lead_hold_status(lead_id: str, status_update: HoldStatusUpdate, request: Request):
    """Update lead hold status (Hold/Activate/Deactivate)"""
    user = await get_current_user(request)
    
    # Permission check
    action = status_update.action
    allowed_actions = ["Hold", "Activate", "Deactivate"]
    
    if action not in allowed_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {allowed_actions}")
    
    # Role-based permissions:
    # - Admin, Manager can Hold/Activate/Deactivate
    # - Designer can only Hold
    if user.role not in ["Admin", "Manager", "SalesManager", "Designer"]:
        raise HTTPException(status_code=403, detail="You don't have permission to change lead status")
    
    if user.role == "Designer" and action != "Hold":
        raise HTTPException(status_code=403, detail="Designers can only place leads on Hold")
    
    # Validate reason
    reason = status_update.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required for this action")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    current_hold_status = lead.get("hold_status", "Active")
    
    # Validate state transitions
    if action == "Hold" and current_hold_status == "Hold":
        raise HTTPException(status_code=400, detail="Lead is already on Hold")
    
    if action == "Activate":
        if current_hold_status == "Active":
            raise HTTPException(status_code=400, detail="Lead is already Active")
    
    if action == "Deactivate" and current_hold_status == "Deactivated":
        raise HTTPException(status_code=400, detail="Lead is already Deactivated")
    
    now = datetime.now(timezone.utc)
    
    # Determine new status
    new_status = action if action in ["Hold", "Deactivated"] else "Active"
    if action == "Deactivate":
        new_status = "Deactivated"
    
    # Create history entry
    history_entry = {
        "id": f"hold_{uuid.uuid4().hex[:8]}",
        "action": action,
        "previous_status": current_hold_status,
        "new_status": new_status,
        "reason": reason,
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat()
    }
    
    # Create activity log comment
    pid_str = f" (PID: {lead.get('pid')})" if lead.get('pid') else ""
    action_messages = {
        "Hold": f"Lead placed on HOLD{pid_str} by {user.name} – Reason: {reason}",
        "Activate": f"Lead Activated again{pid_str} by {user.name} – Reason: {reason}",
        "Deactivate": f"Lead Deactivated{pid_str} by {user.name} – Reason: {reason}"
    }
    
    comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": action_messages[action],
        "is_system": True,
        "type": "hold_status_change",
        "created_at": now.isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "hold_status": new_status,
                "updated_at": now.isoformat()
            },
            "$push": {
                "hold_history": history_entry,
                "comments": comment
            }
        }
    )
    
    return {
        "message": f"Lead {action.lower()}d successfully",
        "lead_id": lead_id,
        "hold_status": new_status,
        "history_entry": history_entry
    }

@api_router.post("/leads/seed")
async def seed_leads(request: Request):
    """Seed sample leads for testing"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Get users
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "role": 1}).to_list(100)
    presales_users = [u["user_id"] for u in users if u.get("role") == "PreSales"]
    designer_users = [u["user_id"] for u in users if u.get("role") == "Designer"]
    all_user_ids = [u["user_id"] for u in users]
    
    # Use first user as default assigned
    default_assigned = presales_users[0] if presales_users else (all_user_ids[0] if all_user_ids else None)
    default_designer = designer_users[0] if designer_users else None
    
    now = datetime.now(timezone.utc)
    
    sample_leads = [
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Vikram Singh",
            "customer_phone": "9876512345",
            "source": "Meta",
            "status": "New",
            "stage": "BC Call Done",
            "assigned_to": default_assigned,
            "designer_id": None,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("BC Call Done", (now - timedelta(days=2)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created from Meta campaign",
                "is_system": True,
                "created_at": (now - timedelta(days=2)).isoformat()
            }],
            "updated_at": now.isoformat(),
            "created_at": (now - timedelta(days=2)).isoformat()
        },
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Neha Gupta",
            "customer_phone": "9123498765",
            "source": "Walk-in",
            "status": "Contacted",
            "stage": "BOQ Shared",
            "assigned_to": default_assigned,
            "designer_id": None,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("BOQ Shared", (now - timedelta(days=5)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created",
                "is_system": True,
                "created_at": (now - timedelta(days=5)).isoformat()
            }, {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": default_assigned or "system",
                "user_name": "Pre-Sales Team",
                "role": "PreSales",
                "message": "Customer interested in 2BHK complete interior. Budget: 15-20L",
                "is_system": False,
                "created_at": (now - timedelta(days=4)).isoformat()
            }],
            "updated_at": (now - timedelta(hours=6)).isoformat(),
            "created_at": (now - timedelta(days=5)).isoformat()
        },
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Rajesh Mehta",
            "customer_phone": "9555123456",
            "source": "Referral",
            "status": "Waiting",
            "stage": "Site Meeting",
            "assigned_to": default_assigned,
            "designer_id": default_designer,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("Site Meeting", (now - timedelta(days=10)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created from referral",
                "is_system": True,
                "created_at": (now - timedelta(days=10)).isoformat()
            }, {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": default_assigned or "system",
                "user_name": "Pre-Sales Team",
                "role": "PreSales",
                "message": "Site visit scheduled for villa in Whitefield",
                "is_system": False,
                "created_at": (now - timedelta(days=7)).isoformat()
            }],
            "updated_at": (now - timedelta(days=1)).isoformat(),
            "created_at": (now - timedelta(days=10)).isoformat()
        },
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Anita Sharma",
            "customer_phone": "9888777666",
            "source": "Meta",
            "status": "Waiting",
            "stage": "Revised BOQ Shared",
            "assigned_to": default_assigned,
            "designer_id": default_designer,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("Revised BOQ Shared", (now - timedelta(days=15)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created",
                "is_system": True,
                "created_at": (now - timedelta(days=15)).isoformat()
            }],
            "updated_at": (now - timedelta(hours=12)).isoformat(),
            "created_at": (now - timedelta(days=15)).isoformat()
        },
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Kiran Reddy",
            "customer_phone": "9444333222",
            "source": "Walk-in",
            "status": "Waiting",
            "stage": "Waiting for Booking",
            "assigned_to": default_assigned,
            "designer_id": default_designer,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("Waiting for Booking", (now - timedelta(days=20)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created",
                "is_system": True,
                "created_at": (now - timedelta(days=20)).isoformat()
            }, {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": default_assigned or "system",
                "user_name": "Pre-Sales Team",
                "role": "PreSales",
                "message": "Client reviewing final quote. Expected booking this week.",
                "is_system": False,
                "created_at": (now - timedelta(days=2)).isoformat()
            }],
            "updated_at": (now - timedelta(hours=3)).isoformat(),
            "created_at": (now - timedelta(days=20)).isoformat()
        },
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Suresh Kumar",
            "customer_phone": "9222111000",
            "source": "Referral",
            "status": "Qualified",
            "stage": "Booking Completed",
            "assigned_to": default_assigned,
            "designer_id": default_designer,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("Booking Completed", (now - timedelta(days=25)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created",
                "is_system": True,
                "created_at": (now - timedelta(days=25)).isoformat()
            }, {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": default_assigned or "system",
                "user_name": "Pre-Sales Team",
                "role": "PreSales",
                "message": "Booking amount received. Ready to convert to project.",
                "is_system": False,
                "created_at": (now - timedelta(days=1)).isoformat()
            }],
            "updated_at": (now - timedelta(hours=1)).isoformat(),
            "created_at": (now - timedelta(days=25)).isoformat()
        },
        {
            "lead_id": f"lead_{uuid.uuid4().hex[:8]}",
            "customer_name": "Meera Joshi",
            "customer_phone": "9333222111",
            "source": "Others",
            "status": "Dropped",
            "stage": "BC Call Done",
            "assigned_to": default_assigned,
            "designer_id": None,
            "is_converted": False,
            "project_id": None,
            "timeline": generate_lead_timeline("BC Call Done", (now - timedelta(days=30)).isoformat()),
            "comments": [{
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Lead created",
                "is_system": True,
                "created_at": (now - timedelta(days=30)).isoformat()
            }, {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": default_assigned or "system",
                "user_name": "Pre-Sales Team",
                "role": "PreSales",
                "message": "Customer decided to postpone renovation. Marked as dropped.",
                "is_system": False,
                "created_at": (now - timedelta(days=28)).isoformat()
            }],
            "updated_at": (now - timedelta(days=28)).isoformat(),
            "created_at": (now - timedelta(days=30)).isoformat()
        }
    ]
    
    # Clear existing leads and insert new ones
    await db.leads.delete_many({})
    await db.leads.insert_many(sample_leads)
    
    return {"message": f"Seeded {len(sample_leads)} sample leads", "count": len(sample_leads)}

@api_router.post("/projects/seed")
async def seed_projects(request: Request):
    """Seed sample projects for testing (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Get all users to use as collaborators
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "role": 1}).to_list(100)
    user_ids = [u["user_id"] for u in users]
    users_map = {u["user_id"]: u for u in users}
    
    def generate_comments(collaborator_ids, created_date):
        """Generate sample comments"""
        base_date = datetime.fromisoformat(created_date.replace("Z", "+00:00"))
        if base_date.tzinfo is None:
            base_date = base_date.replace(tzinfo=timezone.utc)
        
        comments = [
            {
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": "system",
                "user_name": "System",
                "role": "System",
                "message": "Project created",
                "is_system": True,
                "created_at": base_date.isoformat()
            }
        ]
        
        # Add sample comments from collaborators
        sample_messages = [
            "Initial site visit completed. Client has clear requirements for minimalist design.",
            "Mood board prepared and shared with client for feedback.",
            "Client approved the color palette. Moving forward with 3D renders.",
            "Vendor quotes received for custom furniture.",
            "Final design presentation scheduled for next week."
        ]
        
        for i, msg in enumerate(sample_messages[:min(3, len(collaborator_ids))]):
            collab_id = collaborator_ids[i % len(collaborator_ids)]
            collab_info = users_map.get(collab_id, {"name": "Unknown", "role": "Designer"})
            comments.append({
                "id": f"comment_{uuid.uuid4().hex[:8]}",
                "user_id": collab_id,
                "user_name": collab_info.get("name", "Unknown"),
                "role": collab_info.get("role", "Designer"),
                "message": msg,
                "is_system": False,
                "created_at": (base_date + timedelta(days=i+1, hours=i*2)).isoformat()
            })
        
        return comments
    
    # Sample projects data with timeline and comments
    now = datetime.now(timezone.utc)
    
    # Default payment schedule for all projects - Arki Dots 3-stage model
    default_schedule = [
        {
            "stage": "Design Booking",
            "type": "fixed",
            "fixedAmount": 25000,
            "percentage": 10
        },
        {
            "stage": "Production Start",
            "type": "percentage",
            "percentage": 50
        },
        {
            "stage": "Before Installation",
            "type": "remaining"
        }
    ]
    
    # Sample payment generator for new 3-stage model
    def generate_payments(project_value, stages_completed, created_date, user_id):
        payments = []
        base_date = datetime.fromisoformat(created_date.replace("Z", "+00:00"))
        if base_date.tzinfo is None:
            base_date = base_date.replace(tzinfo=timezone.utc)
        
        # Stage 1: Design Booking - Fixed ₹25,000
        # Stage 2: Production Start - 50%
        # Stage 3: Before Installation - Remaining
        stage_amounts = [
            ("Design Booking", 25000),
            ("Production Start", project_value * 0.50),
            ("Before Installation", project_value - 25000 - (project_value * 0.50))
        ]
        modes = ["Bank", "UPI", "Cash"]
        
        for i, (stage, amount) in enumerate(stage_amounts):
            if i < stages_completed and amount > 0:
                payments.append({
                    "id": f"payment_{uuid.uuid4().hex[:8]}",
                    "date": (base_date + timedelta(days=i*20)).strftime("%Y-%m-%d"),
                    "amount": amount,
                    "mode": modes[i % len(modes)],
                    "reference": f"TXN{uuid.uuid4().hex[:6].upper()}",
                    "added_by": user_id,
                    "created_at": (base_date + timedelta(days=i*20)).isoformat()
                })
        return payments
    
    sample_projects = [
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Modern Minimalist Apartment",
            "client_name": "Rahul Sharma",
            "client_phone": "9876543210",
            "stage": "Design Finalization",
            "collaborators": user_ids[:2] if len(user_ids) >= 2 else user_ids,
            "summary": "Complete interior design for a 3BHK apartment with minimalist aesthetics",
            "timeline": generate_project_timeline("Design Finalization", (now - timedelta(days=5)).isoformat()),
            "comments": generate_comments(user_ids[:2] if len(user_ids) >= 2 else user_ids, (now - timedelta(days=5)).isoformat()),
            "project_value": 850000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(850000, 1, (now - timedelta(days=5)).isoformat(), user.user_id),
            "updated_at": now.isoformat(),
            "created_at": (now - timedelta(days=5)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Luxury Villa Interiors",
            "client_name": "Priya Patel",
            "client_phone": "9123456789",
            "stage": "Production Preparation",
            "collaborators": user_ids[:3] if len(user_ids) >= 3 else user_ids,
            "summary": "High-end villa interior design with custom furniture and lighting",
            "timeline": generate_project_timeline("Production Preparation", (now - timedelta(days=15)).isoformat()),
            "comments": generate_comments(user_ids[:3] if len(user_ids) >= 3 else user_ids, (now - timedelta(days=15)).isoformat()),
            "project_value": 2500000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(2500000, 2, (now - timedelta(days=15)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(hours=6)).isoformat(),
            "created_at": (now - timedelta(days=15)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Corporate Office Makeover",
            "client_name": "TechStart Inc.",
            "client_phone": "9988776655",
            "stage": "Production",
            "collaborators": user_ids[:2] if len(user_ids) >= 2 else user_ids,
            "summary": "Modern workspace design for 50+ employees with collaborative zones",
            "timeline": generate_project_timeline("Production", (now - timedelta(days=30)).isoformat()),
            "comments": generate_comments(user_ids[:2] if len(user_ids) >= 2 else user_ids, (now - timedelta(days=30)).isoformat()),
            "project_value": 1800000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(1800000, 3, (now - timedelta(days=30)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(days=1)).isoformat(),
            "created_at": (now - timedelta(days=30)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Boutique Hotel Lobby",
            "client_name": "Sunrise Hotels",
            "client_phone": "9011223344",
            "stage": "Handover",
            "collaborators": user_ids[:1] if len(user_ids) >= 1 else user_ids,
            "summary": "Elegant lobby design with Indian contemporary theme",
            "timeline": generate_project_timeline("Handover", (now - timedelta(days=60)).isoformat()),
            "comments": generate_comments(user_ids[:1] if len(user_ids) >= 1 else user_ids, (now - timedelta(days=60)).isoformat()),
            "project_value": 3200000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(3200000, 3, (now - timedelta(days=60)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(days=2)).isoformat(),
            "created_at": (now - timedelta(days=60)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Penthouse Renovation",
            "client_name": "Amit Khanna",
            "client_phone": "9555444333",
            "stage": "Production Preparation",
            "collaborators": user_ids,
            "summary": "Luxury penthouse complete interior renovation with terrace garden",
            "timeline": generate_project_timeline("Production Preparation", (now - timedelta(days=10)).isoformat()),
            "comments": generate_comments(user_ids, (now - timedelta(days=10)).isoformat()),
            "project_value": 4500000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(4500000, 2, (now - timedelta(days=10)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(hours=12)).isoformat(),
            "created_at": (now - timedelta(days=10)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Restaurant Interior Design",
            "client_name": "Spice Garden",
            "client_phone": "9666777888",
            "stage": "Design Finalization",
            "collaborators": user_ids[:1] if len(user_ids) >= 1 else user_ids,
            "summary": "Fine dining restaurant with fusion Indian-European theme",
            "timeline": generate_project_timeline("Design Finalization", (now - timedelta(days=3)).isoformat()),
            "comments": generate_comments(user_ids[:1] if len(user_ids) >= 1 else user_ids, (now - timedelta(days=3)).isoformat()),
            "project_value": 1200000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(1200000, 1, (now - timedelta(days=3)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(days=3)).isoformat(),
            "created_at": (now - timedelta(days=3)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Smart Home Integration",
            "client_name": "Deepak Verma",
            "client_phone": "9222111000",
            "stage": "Installation",
            "collaborators": user_ids[:2] if len(user_ids) >= 2 else user_ids,
            "summary": "4BHK smart home with automated lighting and climate control",
            "timeline": generate_project_timeline("Installation", (now - timedelta(days=20)).isoformat()),
            "comments": generate_comments(user_ids[:2] if len(user_ids) >= 2 else user_ids, (now - timedelta(days=20)).isoformat()),
            "project_value": 1500000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(1500000, 3, (now - timedelta(days=20)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(hours=3)).isoformat(),
            "created_at": (now - timedelta(days=20)).isoformat()
        },
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Kids Play Area Design",
            "client_name": "Little Stars School",
            "client_phone": "9333222111",
            "stage": "Delivery",
            "collaborators": user_ids,
            "summary": "Colorful and safe play area design for preschool children",
            "timeline": generate_project_timeline("Delivery", (now - timedelta(days=45)).isoformat()),
            "comments": generate_comments(user_ids, (now - timedelta(days=45)).isoformat()),
            "project_value": 650000,
            "payment_schedule": default_schedule,
            "custom_payment_schedule_enabled": False,
            "custom_payment_schedule": [],
            "payments": generate_payments(650000, 3, (now - timedelta(days=45)).isoformat(), user.user_id),
            "updated_at": (now - timedelta(days=7)).isoformat(),
            "created_at": (now - timedelta(days=45)).isoformat()
        }
    ]
    
    # Clear existing projects and insert new ones
    await db.projects.delete_many({})
    await db.projects.insert_many(sample_projects)
    
    return {"message": f"Seeded {len(sample_projects)} sample projects", "count": len(sample_projects)}

# ============ PROJECT FINANCIALS ============

# Default payment schedule - Arki Dots business rules
# Stage 1: Design Booking - Fixed ₹25,000 (can be changed to percentage)
# Stage 2: Production Start - 50% of project value
# Stage 3: Before Installation - Remaining amount
DEFAULT_PAYMENT_SCHEDULE = [
    {
        "stage": "Design Booking",
        "type": "fixed",  # fixed, percentage, or remaining
        "fixedAmount": 25000,
        "percentage": 10  # Used if type is changed to percentage
    },
    {
        "stage": "Production Start",
        "type": "percentage",
        "percentage": 50
    },
    {
        "stage": "Before Installation",
        "type": "remaining"
    }
]

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

PAYMENT_MODES = ["Cash", "Bank", "UPI", "Other"]
PAYMENT_SCHEDULE_TYPES = ["fixed", "percentage", "remaining"]

def calculate_schedule_amounts(payment_schedule, project_value):
    """Calculate amounts for each payment schedule stage"""
    milestone_amounts = []
    total_fixed_and_percentage = 0
    remaining_index = -1
    
    for i, schedule in enumerate(payment_schedule):
        stage_type = schedule.get("type", "percentage")
        stage = schedule.get("stage", f"Stage {i+1}")
        
        if stage_type == "fixed":
            amount = schedule.get("fixedAmount", 0)
            total_fixed_and_percentage += amount
            milestone_amounts.append({
                "stage": stage,
                "type": "fixed",
                "fixedAmount": schedule.get("fixedAmount", 0),
                "percentage": schedule.get("percentage", 0),
                "amount": amount
            })
        elif stage_type == "percentage":
            percentage = schedule.get("percentage", 0)
            amount = (project_value * percentage) / 100
            total_fixed_and_percentage += amount
            milestone_amounts.append({
                "stage": stage,
                "type": "percentage",
                "percentage": percentage,
                "amount": amount
            })
        elif stage_type == "remaining":
            remaining_index = i
            milestone_amounts.append({
                "stage": stage,
                "type": "remaining",
                "amount": 0  # Will be calculated after
            })
    
    # Calculate remaining amount
    if remaining_index >= 0:
        remaining_amount = max(0, project_value - total_fixed_and_percentage)
        milestone_amounts[remaining_index]["amount"] = remaining_amount
    
    return milestone_amounts

def validate_payment_schedule(schedule):
    """Validate payment schedule"""
    errors = []
    remaining_count = 0
    total_percentage = 0
    
    for i, item in enumerate(schedule):
        stage_type = item.get("type", "percentage")
        
        if stage_type not in PAYMENT_SCHEDULE_TYPES:
            errors.append(f"Stage {i+1}: Invalid type '{stage_type}'")
        
        if stage_type == "remaining":
            remaining_count += 1
        
        if stage_type == "percentage":
            percentage = item.get("percentage", 0)
            if percentage < 0 or percentage > 100:
                errors.append(f"Stage {i+1}: Percentage must be between 0 and 100")
            total_percentage += percentage
        
        if stage_type == "fixed":
            fixed_amount = item.get("fixedAmount", 0)
            if fixed_amount < 0:
                errors.append(f"Stage {i+1}: Fixed amount cannot be negative")
        
        if not item.get("stage"):
            errors.append(f"Stage {i+1}: Stage name is required")
    
    if remaining_count > 1:
        errors.append("Only one 'remaining' stage is allowed")
    
    if total_percentage > 100:
        errors.append(f"Total percentage ({total_percentage}%) cannot exceed 100%")
    
    return errors

@api_router.get("/projects/{project_id}/financials")
async def get_project_financials(project_id: str, request: Request):
    """Get project financial details"""
    user = await get_current_user(request)
    
    # PreSales cannot access financials
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Designer can only view projects they're part of
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Initialize financial fields if not present
    project_value = project.get("project_value", 0)
    custom_enabled = project.get("custom_payment_schedule_enabled", False)
    custom_schedule = project.get("custom_payment_schedule", [])
    default_schedule = project.get("payment_schedule", DEFAULT_PAYMENT_SCHEDULE)
    payments = project.get("payments", [])
    
    # Use custom schedule if enabled and has items, otherwise use default
    active_schedule = custom_schedule if (custom_enabled and custom_schedule) else default_schedule
    
    # Calculate totals
    total_collected = sum(p.get("amount", 0) for p in payments)
    balance_pending = project_value - total_collected
    
    # Get user details for payments
    user_ids = list(set([p.get("added_by") for p in payments if p.get("added_by")]))
    users_map = {}
    if user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(100)
        users_map = {u["user_id"]: u.get("name", "Unknown") for u in users_list}
    
    # Enrich payments with user names
    enriched_payments = []
    for payment in payments:
        enriched = {**payment}
        if payment.get("added_by"):
            enriched["added_by_name"] = users_map.get(payment["added_by"], "Unknown")
        enriched_payments.append(enriched)
    
    # Sort payments by date (newest first)
    enriched_payments.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    # Calculate milestone amounts using the active schedule
    milestone_amounts = calculate_schedule_amounts(active_schedule, project_value)
    
    return {
        "project_id": project_id,
        "project_name": project.get("project_name"),
        "project_value": project_value,
        "custom_payment_schedule_enabled": custom_enabled,
        "custom_payment_schedule": custom_schedule,
        "default_payment_schedule": default_schedule,
        "payment_schedule": milestone_amounts,  # Calculated amounts for display
        "payments": enriched_payments,
        "total_collected": total_collected,
        "balance_pending": balance_pending,
        "can_edit": user.role in ["Admin", "Manager"],
        "can_delete_payments": user.role == "Admin"
    }

@api_router.put("/projects/{project_id}/financials")
async def update_project_financials(project_id: str, data: ProjectFinancialsUpdate, request: Request):
    """Update project financial details (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.project_value is not None:
        if data.project_value < 0:
            raise HTTPException(status_code=400, detail="Project value cannot be negative")
        update_dict["project_value"] = data.project_value
    
    # Handle default payment schedule update (for changing Design Booking type)
    if data.payment_schedule is not None:
        errors = validate_payment_schedule(data.payment_schedule)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        update_dict["payment_schedule"] = data.payment_schedule
    
    # Handle custom payment schedule toggle
    if data.custom_payment_schedule_enabled is not None:
        update_dict["custom_payment_schedule_enabled"] = data.custom_payment_schedule_enabled
    
    # Handle custom payment schedule update
    if data.custom_payment_schedule is not None:
        if data.custom_payment_schedule:  # If not empty, validate
            errors = validate_payment_schedule(data.custom_payment_schedule)
            if errors:
                raise HTTPException(status_code=400, detail="; ".join(errors))
        update_dict["custom_payment_schedule"] = data.custom_payment_schedule
    
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": update_dict}
    )
    
    return {"message": "Project financials updated successfully"}

@api_router.post("/projects/{project_id}/payments")
async def add_project_payment(project_id: str, payment: PaymentCreate, request: Request):
    """Add a payment entry to a project (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")
    
    if payment.mode not in PAYMENT_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid payment mode. Must be one of: {PAYMENT_MODES}")
    
    now = datetime.now(timezone.utc)
    payment_id = f"payment_{uuid.uuid4().hex[:8]}"
    
    new_payment = {
        "id": payment_id,
        "date": payment.date or now.strftime("%Y-%m-%d"),
        "amount": payment.amount,
        "mode": payment.mode,
        "reference": payment.reference or "",
        "added_by": user.user_id,
        "created_at": now.isoformat()
    }
    
    # Initialize payments array if not exists and add new payment
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$push": {"payments": new_payment},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    # Create notification for project collaborators
    collaborators = project.get("collaborators", [])
    for collab_id in collaborators:
        if collab_id != user.user_id:
            await create_notification(
                collab_id,
                "Payment Added",
                f"₹{payment.amount:,.0f} payment recorded for project '{project.get('project_name')}'",
                "payment",
                f"/projects/{project_id}"
            )
    
    return {"message": "Payment added successfully", "payment_id": payment_id}

@api_router.delete("/projects/{project_id}/payments/{payment_id}")
async def delete_project_payment(project_id: str, payment_id: str, request: Request):
    """Delete a payment entry (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if payment exists
    payments = project.get("payments", [])
    payment_exists = any(p.get("id") == payment_id for p in payments)
    if not payment_exists:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Remove payment
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$pull": {"payments": {"id": payment_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Payment deleted successfully"}

# ============ DASHBOARD ENDPOINTS ============

@api_router.get("/dashboard")
async def get_dashboard(request: Request):
    """Get dashboard data based on user role"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    dashboard_data = {
        "user_role": user.role,
        "user_name": user.name,
        "user_id": user.user_id
    }
    
    # Common queries
    all_leads = await db.leads.find({"is_converted": False}, {"_id": 0}).to_list(10000)
    all_projects = await db.projects.find({}, {"_id": 0}).to_list(10000)
    all_users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    # Helper to get delayed milestones
    def get_delayed_milestones(items, is_lead=False):
        delayed = []
        for item in items:
            item_id = item.get("lead_id" if is_lead else "project_id")
            item_name = item.get("customer_name" if is_lead else "project_name")
            timeline = item.get("timeline", [])
            for milestone in timeline:
                if milestone.get("status") == "delayed":
                    expected_date_str = milestone.get("expectedDate", "")
                    days_delayed = 0
                    if expected_date_str:
                        try:
                            expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                            if expected.tzinfo is None:
                                expected = expected.replace(tzinfo=timezone.utc)
                            days_delayed = (now - expected).days
                        except:
                            pass
                    
                    # Get designer name for projects
                    designer_name = None
                    if not is_lead:
                        collabs = item.get("collaborators", [])
                        for collab_id in collabs:
                            for u in all_users:
                                if u.get("user_id") == collab_id and u.get("role") == "Designer":
                                    designer_name = u.get("name")
                                    break
                            if designer_name:
                                break
                    
                    delayed.append({
                        "id": item_id,
                        "name": item_name,
                        "milestone": milestone.get("title"),
                        "expectedDate": expected_date_str,
                        "daysDelayed": days_delayed,
                        "stage": milestone.get("stage_ref") or item.get("stage"),
                        "designer": designer_name
                    })
        return delayed
    
    # Helper to get upcoming milestones (next 7 days)
    def get_upcoming_milestones(items, is_lead=False, filter_user_id=None):
        upcoming = []
        for item in items:
            # Filter by user if needed
            if filter_user_id:
                if not is_lead and filter_user_id not in item.get("collaborators", []):
                    continue
                if is_lead and item.get("designer_id") != filter_user_id:
                    continue
            
            item_id = item.get("lead_id" if is_lead else "project_id")
            item_name = item.get("customer_name" if is_lead else "project_name")
            timeline = item.get("timeline", [])
            
            # Get designer name for projects
            designer_name = None
            if not is_lead:
                collabs = item.get("collaborators", [])
                for collab_id in collabs:
                    for u in all_users:
                        if u.get("user_id") == collab_id and u.get("role") == "Designer":
                            designer_name = u.get("name")
                            break
                    if designer_name:
                        break
            
            for milestone in timeline:
                if milestone.get("status") in ["pending", "delayed"]:
                    expected_date_str = milestone.get("expectedDate", "")
                    if expected_date_str:
                        try:
                            expected = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                            if expected.tzinfo is None:
                                expected = expected.replace(tzinfo=timezone.utc)
                            # Next 7 days
                            if today_start <= expected <= (now + timedelta(days=7)):
                                upcoming.append({
                                    "id": item_id,
                                    "name": item_name,
                                    "milestone": milestone.get("title"),
                                    "expectedDate": expected_date_str,
                                    "status": milestone.get("status"),
                                    "stage": milestone.get("stage_ref") or item.get("stage"),
                                    "designer": designer_name
                                })
                        except:
                            pass
        # Sort by expected date
        upcoming.sort(key=lambda x: x.get("expectedDate", ""))
        return upcoming[:20]  # Limit to 20
    
    # Helper to count stage distribution
    def get_stage_distribution(items, stage_field="stage"):
        distribution = {}
        for item in items:
            stage = item.get(stage_field, "Unknown")
            distribution[stage] = distribution.get(stage, 0) + 1
        return distribution
    
    # ============ ADMIN DASHBOARD ============
    if user.role == "Admin":
        # Lead metrics
        total_leads = len(all_leads)
        qualified_leads = len([l for l in all_leads if l.get("status") == "Qualified"])
        converted_leads_count = await db.leads.count_documents({"is_converted": True})
        booking_conversion_rate = round((converted_leads_count / max(total_leads + converted_leads_count, 1)) * 100, 1)
        
        # Calculate average lead cycle (lead creation to booking)
        converted_leads = await db.leads.find({"is_converted": True}, {"_id": 0, "created_at": 1, "updated_at": 1}).to_list(1000)
        avg_cycle_days = 0
        if converted_leads:
            total_days = 0
            count = 0
            for lead in converted_leads:
                created = lead.get("created_at", "")
                updated = lead.get("updated_at", "")
                if created and updated:
                    try:
                        created_dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                        updated_dt = datetime.fromisoformat(str(updated).replace("Z", "+00:00"))
                        total_days += (updated_dt - created_dt).days
                        count += 1
                    except:
                        pass
            if count > 0:
                avg_cycle_days = round(total_days / count, 1)
        
        # Project metrics
        total_projects = len(all_projects)
        project_stage_distribution = get_stage_distribution(all_projects, "stage")
        
        # Delayed milestones
        delayed_project_milestones = get_delayed_milestones(all_projects, is_lead=False)
        delayed_lead_milestones = get_delayed_milestones(all_leads, is_lead=True)
        
        # Active designers
        active_designers = len([u for u in all_users if u.get("role") == "Designer"])
        
        # Designer performance
        designer_performance = []
        for u in all_users:
            if u.get("role") == "Designer":
                user_id = u.get("user_id")
                user_projects = [p for p in all_projects if user_id in p.get("collaborators", [])]
                active_count = len(user_projects)
                on_time = 0
                delayed = 0
                for p in user_projects:
                    for m in p.get("timeline", []):
                        if m.get("status") == "completed":
                            on_time += 1
                        elif m.get("status") == "delayed":
                            delayed += 1
                designer_performance.append({
                    "user_id": user_id,
                    "name": u.get("name"),
                    "activeProjects": active_count,
                    "onTimeMilestones": on_time,
                    "delayedMilestones": delayed,
                    "conversionRate": "85%"  # Dummy for now
                })
        
        # PreSales performance
        presales_performance = []
        for u in all_users:
            if u.get("role") == "PreSales":
                user_id = u.get("user_id")
                user_leads = [l for l in all_leads if l.get("assigned_to") == user_id]
                converted = await db.leads.count_documents({"assigned_to": user_id, "is_converted": True})
                presales_performance.append({
                    "user_id": user_id,
                    "name": u.get("name"),
                    "totalLeads": len(user_leads) + converted,
                    "activeLeads": len(user_leads),
                    "converted": converted
                })
        
        dashboard_data.update({
            "kpis": {
                "totalLeads": total_leads,
                "qualifiedLeads": qualified_leads,
                "totalProjects": total_projects,
                "bookingConversionRate": booking_conversion_rate,
                "activeDesigners": active_designers,
                "avgTurnaroundDays": avg_cycle_days,
                "delayedMilestonesCount": len(delayed_project_milestones) + len(delayed_lead_milestones)
            },
            "projectStageDistribution": project_stage_distribution,
            "leadStageDistribution": get_stage_distribution(all_leads, "stage"),
            "delayedMilestones": delayed_project_milestones[:15],
            "upcomingMilestones": get_upcoming_milestones(all_projects, is_lead=False),
            "designerPerformance": designer_performance,
            "presalesPerformance": presales_performance
        })
    
    # ============ MANAGER DASHBOARD ============
    elif user.role == "Manager":
        # Lead metrics
        total_leads = len(all_leads)
        lead_stage_distribution = get_stage_distribution(all_leads, "stage")
        
        # Project metrics
        total_projects = len(all_projects)
        project_stage_distribution = get_stage_distribution(all_projects, "stage")
        
        # Delayed milestones
        delayed_project_milestones = get_delayed_milestones(all_projects, is_lead=False)
        
        # Designer performance
        designer_performance = []
        for u in all_users:
            if u.get("role") == "Designer":
                user_id = u.get("user_id")
                user_projects = [p for p in all_projects if user_id in p.get("collaborators", [])]
                active_count = len(user_projects)
                on_time = 0
                delayed = 0
                for p in user_projects:
                    for m in p.get("timeline", []):
                        if m.get("status") == "completed":
                            on_time += 1
                        elif m.get("status") == "delayed":
                            delayed += 1
                designer_performance.append({
                    "user_id": user_id,
                    "name": u.get("name"),
                    "activeProjects": active_count,
                    "onTimeMilestones": on_time,
                    "delayedMilestones": delayed,
                    "conversionRate": "85%"  # Dummy for now
                })
        
        dashboard_data.update({
            "kpis": {
                "totalLeads": total_leads,
                "totalProjects": total_projects,
                "delayedMilestonesCount": len(delayed_project_milestones)
            },
            "projectStageDistribution": project_stage_distribution,
            "leadStageDistribution": lead_stage_distribution,
            "delayedMilestones": delayed_project_milestones[:15],
            "upcomingMilestones": get_upcoming_milestones(all_projects, is_lead=False),
            "designerPerformance": designer_performance
        })
    
    # ============ PRE-SALES DASHBOARD ============
    elif user.role == "PreSales":
        # My leads only
        my_leads = [l for l in all_leads if l.get("assigned_to") == user.user_id]
        
        # Stage counts
        bc_call_done = len([l for l in my_leads if l.get("stage") == "BC Call Done"])
        boq_shared = len([l for l in my_leads if l.get("stage") == "BOQ Shared"])
        waiting_booking = len([l for l in my_leads if l.get("stage") == "Waiting for Booking"])
        
        # Follow-ups due today (leads with milestones expected today)
        followups_today = 0
        for lead in my_leads:
            for m in lead.get("timeline", []):
                if m.get("status") in ["pending", "delayed"]:
                    expected = m.get("expectedDate", "")
                    if expected:
                        try:
                            exp_dt = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                            if exp_dt.date() == now.date():
                                followups_today += 1
                                break
                        except:
                            pass
        
        # Lost/dropped leads in past 7 days
        lost_leads = await db.leads.count_documents({
            "assigned_to": user.user_id,
            "status": "Dropped",
            "updated_at": {"$gte": seven_days_ago.isoformat()}
        })
        
        dashboard_data.update({
            "kpis": {
                "myLeads": len(my_leads),
                "bcCallDone": bc_call_done,
                "boqShared": boq_shared,
                "waitingForBooking": waiting_booking,
                "followupsDueToday": followups_today,
                "lostLeads7Days": lost_leads
            },
            "leadStageDistribution": get_stage_distribution(my_leads, "stage")
        })
    
    # ============ DESIGNER DASHBOARD ============
    elif user.role == "Designer":
        # My projects only
        my_projects = [p for p in all_projects if user.user_id in p.get("collaborators", [])]
        
        # Stage distribution for my projects
        project_stage_distribution = get_stage_distribution(my_projects, "stage")
        
        # Delayed projects
        delayed_milestones = get_delayed_milestones(my_projects, is_lead=False)
        
        # Milestones due today
        milestones_today = 0
        for proj in my_projects:
            for m in proj.get("timeline", []):
                if m.get("status") in ["pending", "delayed"]:
                    expected = m.get("expectedDate", "")
                    if expected:
                        try:
                            exp_dt = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                            if exp_dt.date() == now.date():
                                milestones_today += 1
                        except:
                            pass
        
        # Projects delayed (having at least one delayed milestone)
        projects_delayed = len(set([m["id"] for m in delayed_milestones]))
        
        dashboard_data.update({
            "kpis": {
                "myProjects": len(my_projects),
                "projectsDelayed": projects_delayed,
                "milestonesToday": milestones_today
            },
            "projectStageDistribution": project_stage_distribution,
            "delayedMilestones": delayed_milestones[:10],
            "upcomingMilestones": get_upcoming_milestones(my_projects, is_lead=False)
        })
    
    return dashboard_data


# ============ SETTINGS MODELS ============

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

# ============ SETTINGS ENDPOINTS ============

# Default TAT configurations
DEFAULT_LEAD_TAT = {
    "bc_call_done": 1,
    "boq_shared": 3,
    "site_meeting": 2,
    "revised_boq_shared": 2
}

DEFAULT_PROJECT_TAT = {
    "design_finalization": {
        "site_measurement": 1,
        "site_validation": 2,
        "design_meeting": 3,
        "design_meeting_2": 2,
        "final_proposal": 3,
        "sign_off": 2,
        "kickoff_meeting": 2
    },
    "production_preparation": {
        "factory_slot": 3,
        "jit_plan": 3,
        "nm_dependencies": 3,
        "raw_material": 3
    },
    "production": {
        "production_start": 4,
        "full_confirmation": 4,
        "piv": 4
    },
    "delivery": {
        "modular_delivery": 5
    },
    "installation": {
        "modular_installation": 3,
        "nm_handover_work": 3
    },
    "handover": {
        "handover_with_snag": 2,
        "cleaning": 2,
        "handover_without_snag": 2
    }
}

DEFAULT_STAGES = [
    {"name": "Design Finalization", "order": 0, "enabled": True},
    {"name": "Production Preparation", "order": 1, "enabled": True},
    {"name": "Production", "order": 2, "enabled": True},
    {"name": "Delivery", "order": 3, "enabled": True},
    {"name": "Installation", "order": 4, "enabled": True},
    {"name": "Handover", "order": 5, "enabled": True}
]

DEFAULT_LEAD_STAGES = [
    {"name": "BC Call Done", "order": 0, "enabled": True},
    {"name": "BOQ Shared", "order": 1, "enabled": True},
    {"name": "Site Meeting", "order": 2, "enabled": True},
    {"name": "Revised BOQ Shared", "order": 3, "enabled": True},
    {"name": "Waiting for Booking", "order": 4, "enabled": True},
    {"name": "Booking Completed", "order": 5, "enabled": True}
]

async def log_system_action(action: str, user: User, metadata: dict = None):
    """Log a system action"""
    log_entry = {
        "id": f"log_{uuid.uuid4().hex[:8]}",
        "action": action,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_role": user.role,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {}
    }
    await db.system_logs.insert_one(log_entry)
    return log_entry

async def get_settings(key: str, default_value: dict):
    """Get settings from database or return default"""
    settings = await db.settings.find_one({"key": key}, {"_id": 0})
    if settings:
        return settings.get("value", default_value)
    return default_value

async def save_settings(key: str, value: dict, user: User):
    """Save settings to database"""
    await db.settings.update_one(
        {"key": key},
        {"$set": {"key": key, "value": value, "updated_by": user.user_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

# Company Settings
@api_router.get("/settings/company")
async def get_company_settings(request: Request):
    """Get company settings"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    default = {
        "name": "Arkiflo",
        "address": "",
        "phone": "",
        "gst": "",
        "website": "",
        "support_email": ""
    }
    return await get_settings("company", default)

@api_router.put("/settings/company")
async def update_company_settings(settings: CompanySettings, request: Request):
    """Update company settings (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    value = settings.model_dump(exclude_none=True)
    await save_settings("company", value, user)
    await log_system_action("company_settings_updated", user, {"changes": value})
    
    return {"message": "Company settings updated", "settings": value}

# Branding Settings
@api_router.get("/settings/branding")
async def get_branding_settings(request: Request):
    """Get branding settings"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    default = {
        "logo_url": "",
        "primary_color": "#2563EB",
        "secondary_color": "#64748B",
        "theme": "light",
        "favicon_url": "",
        "sidebar_default_collapsed": False
    }
    return await get_settings("branding", default)

@api_router.put("/settings/branding")
async def update_branding_settings(settings: BrandingSettings, request: Request):
    """Update branding settings (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    value = settings.model_dump(exclude_none=True)
    await save_settings("branding", value, user)
    await log_system_action("branding_settings_updated", user, {"changes": value})
    
    return {"message": "Branding settings updated", "settings": value}

# TAT Settings
@api_router.get("/settings/tat/lead")
async def get_lead_tat_settings(request: Request):
    """Get lead TAT settings"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return await get_settings("lead_tat", DEFAULT_LEAD_TAT)

@api_router.put("/settings/tat/lead")
async def update_lead_tat_settings(settings: LeadTATSettings, request: Request):
    """Update lead TAT settings (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    value = settings.model_dump(exclude_none=True)
    await save_settings("lead_tat", value, user)
    await log_system_action("lead_tat_updated", user, {"changes": value})
    
    return {"message": "Lead TAT settings updated", "settings": value}

@api_router.get("/settings/tat/project")
async def get_project_tat_settings(request: Request):
    """Get project TAT settings"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return await get_settings("project_tat", DEFAULT_PROJECT_TAT)

@api_router.put("/settings/tat/project")
async def update_project_tat_settings(settings: ProjectTATSettings, request: Request):
    """Update project TAT settings (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Merge with defaults to ensure all fields exist
    current = await get_settings("project_tat", DEFAULT_PROJECT_TAT)
    updates = settings.model_dump(exclude_none=True)
    
    for key, val in updates.items():
        if val is not None:
            current[key] = val
    
    await save_settings("project_tat", current, user)
    await log_system_action("project_tat_updated", user, {"changes": updates})
    
    return {"message": "Project TAT settings updated", "settings": current}

# Stage Settings
@api_router.get("/settings/stages")
async def get_stages_settings(request: Request):
    """Get project stages configuration"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return await get_settings("project_stages", DEFAULT_STAGES)

@api_router.put("/settings/stages")
async def update_stages_settings(stages: List[dict], request: Request):
    """Update project stages configuration (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await save_settings("project_stages", stages, user)
    await log_system_action("stages_updated", user, {"stages": stages})
    
    return {"message": "Stages updated", "stages": stages}

@api_router.get("/settings/stages/lead")
async def get_lead_stages_settings(request: Request):
    """Get lead stages configuration"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return await get_settings("lead_stages", DEFAULT_LEAD_STAGES)

@api_router.put("/settings/stages/lead")
async def update_lead_stages_settings(stages: List[dict], request: Request):
    """Update lead stages configuration (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await save_settings("lead_stages", stages, user)
    await log_system_action("lead_stages_updated", user, {"stages": stages})
    
    return {"message": "Lead stages updated", "stages": stages}

# Milestones Settings
@api_router.get("/settings/milestones")
async def get_milestones_settings(request: Request):
    """Get milestones configuration for all stages"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    default_milestones = {
        "Design Finalization": [
            {"name": "Site Measurement", "enabled": True, "order": 0},
            {"name": "Site Validation", "enabled": True, "order": 1},
            {"name": "Design Meeting", "enabled": True, "order": 2},
            {"name": "Design Meeting – 2", "enabled": True, "order": 3},
            {"name": "Final Design Proposal & Material Selection", "enabled": True, "order": 4},
            {"name": "Sign-off KWS Units & Payment", "enabled": True, "order": 5},
            {"name": "Kickoff Meeting", "enabled": True, "order": 6}
        ],
        "Production Preparation": [
            {"name": "Factory Slot Allocation", "enabled": True, "order": 0},
            {"name": "JIT Project Delivery Plan", "enabled": True, "order": 1},
            {"name": "Non-Modular Dependencies", "enabled": True, "order": 2},
            {"name": "Raw Material Procurement", "enabled": True, "order": 3}
        ],
        "Production": [
            {"name": "Production Kick-start", "enabled": True, "order": 0},
            {"name": "Full Order Confirmation", "enabled": True, "order": 1},
            {"name": "PIV / Site Readiness", "enabled": True, "order": 2}
        ],
        "Delivery": [
            {"name": "Modular Order Delivery at Site", "enabled": True, "order": 0}
        ],
        "Installation": [
            {"name": "Modular Installation", "enabled": True, "order": 0},
            {"name": "Non-Modular Dependency Work for Handover", "enabled": True, "order": 1}
        ],
        "Handover": [
            {"name": "Handover with Snag", "enabled": True, "order": 0},
            {"name": "Cleaning", "enabled": True, "order": 1},
            {"name": "Handover Without Snag", "enabled": True, "order": 2}
        ]
    }
    return await get_settings("milestones", default_milestones)

@api_router.put("/settings/milestones")
async def update_milestones_settings(milestones: dict, request: Request):
    """Update milestones configuration (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await save_settings("milestones", milestones, user)
    await log_system_action("milestones_updated", user, {"stages_count": len(milestones)})
    
    return {"message": "Milestones updated", "milestones": milestones}

# System Logs
@api_router.get("/settings/logs")
async def get_system_logs(request: Request, limit: int = 100, offset: int = 0):
    """Get system logs (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = await db.system_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.system_logs.count_documents({})
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# Get all settings at once (for frontend initialization)
@api_router.get("/settings/all")
async def get_all_settings(request: Request):
    """Get all settings at once"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    company = await get_settings("company", {"name": "Arkiflo", "address": "", "phone": "", "gst": "", "website": "", "support_email": ""})
    branding = await get_settings("branding", {"logo_url": "", "primary_color": "#2563EB", "secondary_color": "#64748B", "theme": "light", "favicon_url": "", "sidebar_default_collapsed": False})
    lead_tat = await get_settings("lead_tat", DEFAULT_LEAD_TAT)
    project_tat = await get_settings("project_tat", DEFAULT_PROJECT_TAT)
    
    return {
        "company": company,
        "branding": branding,
        "lead_tat": lead_tat,
        "project_tat": project_tat,
        "can_edit": user.role == "Admin"
    }


# ============ NOTIFICATIONS MODELS & ENDPOINTS ============

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str  # "stage-change" | "task" | "milestone" | "comment" | "system"
    link_url: Optional[str] = None

class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None

# Notification Types
NOTIFICATION_TYPES = ["stage-change", "task", "milestone", "comment", "system"]

async def create_notification(user_id: str, title: str, message: str, notif_type: str, link_url: str = None):
    """Create a notification for a user"""
    notification = {
        "id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "link_url": link_url,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification

async def notify_users(user_ids: list, title: str, message: str, notif_type: str, link_url: str = None):
    """Send notification to multiple users"""
    for user_id in user_ids:
        if user_id:
            await create_notification(user_id, title, message, notif_type, link_url)

async def get_relevant_users_for_project(project: dict):
    """Get admins, managers, and project collaborators"""
    user_ids = set()
    
    # Add collaborators
    for collab_id in project.get("collaborators", []):
        user_ids.add(collab_id)
    
    # Add all admins and managers
    admins_managers = await db.users.find(
        {"role": {"$in": ["Admin", "Manager"]}, "status": "Active"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    for user in admins_managers:
        user_ids.add(user["user_id"])
    
    return list(user_ids)

async def get_relevant_users_for_lead(lead: dict):
    """Get admins, managers, presales assigned, and designer"""
    user_ids = set()
    
    # Add assigned presales
    if lead.get("assigned_to"):
        user_ids.add(lead["assigned_to"])
    
    # Add designer if assigned
    if lead.get("designer_id"):
        user_ids.add(lead["designer_id"])
    
    # Add all admins and managers
    admins_managers = await db.users.find(
        {"role": {"$in": ["Admin", "Manager"]}, "status": "Active"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    for user in admins_managers:
        user_ids.add(user["user_id"])
    
    return list(user_ids)

# Get notifications for current user
@api_router.get("/notifications")
async def get_notifications(
    request: Request,
    type: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get notifications for the current user"""
    user = await get_current_user(request)
    
    query = {"user_id": user.user_id}
    
    if type and type != "all":
        query["type"] = type
    
    if is_read is not None:
        query["is_read"] = is_read
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.notifications.count_documents(query)
    unread_count = await db.notifications.count_documents({"user_id": user.user_id, "is_read": False})
    
    return {
        "notifications": notifications,
        "total": total,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset
    }

# Get unread count only (for header badge)
@api_router.get("/notifications/unread-count")
async def get_unread_count(request: Request):
    """Get unread notification count for the current user"""
    user = await get_current_user(request)
    count = await db.notifications.count_documents({"user_id": user.user_id, "is_read": False})
    return {"unread_count": count}

# Mark notification as read
@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    user = await get_current_user(request)
    
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user.user_id},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

# Mark all as read
@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read for the current user"""
    user = await get_current_user(request)
    
    result = await db.notifications.update_many(
        {"user_id": user.user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}

# Delete notification
@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    user = await get_current_user(request)
    
    result = await db.notifications.delete_one(
        {"id": notification_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}

# Clear all notifications
@api_router.delete("/notifications/clear-all")
async def clear_all_notifications(request: Request):
    """Clear all notifications for the current user"""
    user = await get_current_user(request)
    
    result = await db.notifications.delete_many({"user_id": user.user_id})
    
    return {"message": f"Deleted {result.deleted_count} notifications"}


# ============ EMAIL TEMPLATES ============

DEFAULT_EMAIL_TEMPLATES = [
    {
        "id": "template_stage_change",
        "name": "Stage Change Email",
        "subject": "Stage Updated: {{projectName}}",
        "body": "<p>Hello {{userName}},</p><p>The stage for <strong>{{projectName}}</strong> has been updated to <strong>{{stage}}</strong>.</p><p>Click below to view details.</p><p>Best regards,<br>Arkiflo Team</p>",
        "variables": ["projectName", "userName", "stage"],
        "updated_at": None
    },
    {
        "id": "template_task_assignment",
        "name": "Task Assignment Email",
        "subject": "New Task Assigned: {{taskTitle}}",
        "body": "<p>Hello {{assignedTo}},</p><p>A new task has been assigned to you:</p><p><strong>{{taskTitle}}</strong></p><p>Please review and complete it before the due date.</p><p>Best regards,<br>Arkiflo Team</p>",
        "variables": ["taskTitle", "assignedTo", "projectName"],
        "updated_at": None
    },
    {
        "id": "template_task_overdue",
        "name": "Task Overdue Email",
        "subject": "Task Overdue: {{taskTitle}}",
        "body": "<p>Hello {{assignedTo}},</p><p>Your task <strong>{{taskTitle}}</strong> is now overdue.</p><p>Please complete it as soon as possible.</p><p>Best regards,<br>Arkiflo Team</p>",
        "variables": ["taskTitle", "assignedTo"],
        "updated_at": None
    },
    {
        "id": "template_milestone_delay",
        "name": "Milestone Delay Email",
        "subject": "Milestone Delayed: {{milestone}} - {{projectName}}",
        "body": "<p>Hello {{userName}},</p><p>The milestone <strong>{{milestone}}</strong> in project <strong>{{projectName}}</strong> is now delayed.</p><p>Please take necessary action.</p><p>Best regards,<br>Arkiflo Team</p>",
        "variables": ["milestone", "projectName", "userName"],
        "updated_at": None
    },
    {
        "id": "template_user_invite",
        "name": "User Invite Email",
        "subject": "You're invited to join Arkiflo",
        "body": "<p>Hello {{userName}},</p><p>You have been invited to join <strong>Arkiflo</strong> as a <strong>{{role}}</strong>.</p><p>Click the button below to sign in with your Google account.</p><p>Best regards,<br>Arkiflo Team</p>",
        "variables": ["userName", "role", "email"],
        "updated_at": None
    }
]

class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None

@api_router.get("/settings/email-templates")
async def get_email_templates(request: Request):
    """Get all email templates (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get from database or return defaults
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(100)
    
    if not templates:
        # Initialize with defaults
        for template in DEFAULT_EMAIL_TEMPLATES:
            await db.email_templates.insert_one(template.copy())
        templates = DEFAULT_EMAIL_TEMPLATES.copy()
    
    return templates

@api_router.get("/settings/email-templates/{template_id}")
async def get_email_template(template_id: str, request: Request):
    """Get a single email template (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    template = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    
    if not template:
        # Check if it's a default template
        for default in DEFAULT_EMAIL_TEMPLATES:
            if default["id"] == template_id:
                return default
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template

@api_router.put("/settings/email-templates/{template_id}")
async def update_email_template(template_id: str, update: EmailTemplateUpdate, request: Request):
    """Update an email template (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update.subject is not None:
        update_dict["subject"] = update.subject
    
    if update.body is not None:
        update_dict["body"] = update.body
    
    # Try to update existing
    result = await db.email_templates.update_one(
        {"id": template_id},
        {"$set": update_dict}
    )
    
    # If not found, create from default
    if result.matched_count == 0:
        for default in DEFAULT_EMAIL_TEMPLATES:
            if default["id"] == template_id:
                new_template = default.copy()
                new_template.update(update_dict)
                await db.email_templates.insert_one(new_template)
                await log_system_action("email_template_updated", user, {"template_id": template_id})
                return {"message": "Template updated", "template": new_template}
        
        raise HTTPException(status_code=404, detail="Template not found")
    
    await log_system_action("email_template_updated", user, {"template_id": template_id})
    
    # Return updated template
    updated = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    return {"message": "Template updated", "template": updated}

@api_router.post("/settings/email-templates/{template_id}/reset")
async def reset_email_template(template_id: str, request: Request):
    """Reset an email template to default (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find default template
    default = None
    for d in DEFAULT_EMAIL_TEMPLATES:
        if d["id"] == template_id:
            default = d.copy()
            break
    
    if not default:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Reset to default
    default["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.email_templates.update_one(
        {"id": template_id},
        {"$set": default},
        upsert=True
    )
    
    await log_system_action("email_template_reset", user, {"template_id": template_id})
    
    return {"message": "Template reset to default", "template": default}


# ============ TASK MODELS ============

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

TASK_PRIORITIES = ["Low", "Medium", "High"]
TASK_STATUSES = ["Pending", "In Progress", "Completed"]

# ============ TASK ENDPOINTS ============

@api_router.get("/tasks")
async def list_tasks(
    request: Request,
    project_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    standalone: Optional[bool] = None
):
    """List tasks with filters - role-based access"""
    user = await get_current_user(request)
    
    query = {}
    
    # Role-based filtering
    if user.role == "Designer":
        # Designers see only tasks assigned to them
        query["assigned_to"] = user.user_id
    elif user.role == "PreSales":
        # PreSales see only tasks assigned to them
        query["assigned_to"] = user.user_id
    
    # Apply filters
    if project_id:
        query["project_id"] = project_id
    
    if assigned_to and user.role in ["Admin", "Manager"]:
        query["assigned_to"] = assigned_to
    
    if status and status != "all":
        query["status"] = status
    
    if priority and priority != "all":
        query["priority"] = priority
    
    if standalone is not None:
        if standalone:
            query["project_id"] = None
        else:
            query["project_id"] = {"$ne": None}
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    
    # Get assignee details
    user_ids = list(set([t.get("assigned_to") for t in tasks if t.get("assigned_to")]))
    user_ids.extend([t.get("assigned_by") for t in tasks if t.get("assigned_by")])
    user_ids = list(set(user_ids))
    
    users_map = {}
    if user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        ).to_list(1000)
        users_map = {u["user_id"]: u for u in users_list}
    
    # Get project details for project-linked tasks
    project_ids = list(set([t.get("project_id") for t in tasks if t.get("project_id")]))
    projects_map = {}
    if project_ids:
        projects_list = await db.projects.find(
            {"project_id": {"$in": project_ids}},
            {"_id": 0, "project_id": 1, "project_name": 1, "client_name": 1}
        ).to_list(1000)
        projects_map = {p["project_id"]: p for p in projects_list}
    
    # Enrich tasks with user and project details
    result = []
    for task in tasks:
        enriched = {**task}
        
        if task.get("assigned_to") and task["assigned_to"] in users_map:
            enriched["assigned_to_user"] = users_map[task["assigned_to"]]
        
        if task.get("assigned_by") and task["assigned_by"] in users_map:
            enriched["assigned_by_user"] = users_map[task["assigned_by"]]
        
        if task.get("project_id") and task["project_id"] in projects_map:
            enriched["project"] = projects_map[task["project_id"]]
        
        result.append(enriched)
    
    # Sort by due_date ascending
    result.sort(key=lambda x: x.get("due_date", ""))
    
    return result

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    """Get single task by ID"""
    user = await get_current_user(request)
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Role-based access check
    if user.role in ["Designer", "PreSales"] and task.get("assigned_to") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get assignee details
    if task.get("assigned_to"):
        assignee = await db.users.find_one(
            {"user_id": task["assigned_to"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        )
        if assignee:
            task["assigned_to_user"] = assignee
    
    if task.get("assigned_by"):
        assigner = await db.users.find_one(
            {"user_id": task["assigned_by"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        )
        if assigner:
            task["assigned_by_user"] = assigner
    
    # Get project details
    if task.get("project_id"):
        project = await db.projects.find_one(
            {"project_id": task["project_id"]},
            {"_id": 0, "project_id": 1, "project_name": 1, "client_name": 1}
        )
        if project:
            task["project"] = project
    
    return task

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, request: Request):
    """Create a new task"""
    user = await get_current_user(request)
    
    # Only Admin, Manager can create tasks for others
    # Designers/PreSales can only create tasks for themselves
    if user.role in ["Designer", "PreSales"] and task_data.assigned_to != user.user_id:
        raise HTTPException(status_code=403, detail="You can only create tasks for yourself")
    
    # Validate priority
    if task_data.priority not in TASK_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {TASK_PRIORITIES}")
    
    # Validate project if provided
    if task_data.project_id:
        project = await db.projects.find_one({"project_id": task_data.project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate assignee
    assignee = await db.users.find_one({"user_id": task_data.assigned_to}, {"_id": 0})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assigned user not found")
    
    now = datetime.now(timezone.utc)
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    
    new_task = {
        "id": task_id,
        "title": task_data.title,
        "description": task_data.description or "",
        "project_id": task_data.project_id,
        "assigned_to": task_data.assigned_to,
        "assigned_by": user.user_id,
        "priority": task_data.priority,
        "status": "Pending",
        "due_date": task_data.due_date,
        "auto_generated": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.tasks.insert_one(new_task)
    
    # Remove MongoDB _id from response
    new_task.pop("_id", None)
    
    # Create notification for assignee if different from creator
    if task_data.assigned_to != user.user_id:
        project_name = ""
        if task_data.project_id:
            project = await db.projects.find_one({"project_id": task_data.project_id}, {"_id": 0, "project_name": 1})
            project_name = f" for project '{project.get('project_name', '')}'" if project else ""
        
        await create_notification(
            task_data.assigned_to,
            "New Task Assigned",
            f"{user.name} assigned you a task: '{task_data.title}'{project_name}",
            "task",
            "/calendar"
        )
    
    return {"message": "Task created successfully", "task": new_task}

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_data: TaskUpdate, request: Request):
    """Update a task"""
    user = await get_current_user(request)
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Role-based access check
    # Designers/PreSales can only update their own tasks
    if user.role in ["Designer", "PreSales"]:
        if task.get("assigned_to") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        # They can only update status
        if task_data.assigned_to or task_data.assigned_to == "":
            raise HTTPException(status_code=403, detail="Cannot change assignee")
    
    # Validate priority if provided
    if task_data.priority and task_data.priority not in TASK_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {TASK_PRIORITIES}")
    
    # Validate status if provided
    if task_data.status and task_data.status not in TASK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {TASK_STATUSES}")
    
    # Validate project if provided
    if task_data.project_id:
        project = await db.projects.find_one({"project_id": task_data.project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate assignee if provided
    if task_data.assigned_to:
        assignee = await db.users.find_one({"user_id": task_data.assigned_to}, {"_id": 0})
        if not assignee:
            raise HTTPException(status_code=404, detail="Assigned user not found")
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if task_data.title is not None:
        update_dict["title"] = task_data.title
    if task_data.description is not None:
        update_dict["description"] = task_data.description
    if task_data.project_id is not None:
        update_dict["project_id"] = task_data.project_id if task_data.project_id else None
    if task_data.assigned_to is not None:
        update_dict["assigned_to"] = task_data.assigned_to
    if task_data.priority is not None:
        update_dict["priority"] = task_data.priority
    if task_data.status is not None:
        update_dict["status"] = task_data.status
    if task_data.due_date is not None:
        update_dict["due_date"] = task_data.due_date
    
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": update_dict}
    )
    
    # Notify if assignee changed
    if task_data.assigned_to and task_data.assigned_to != task.get("assigned_to"):
        await create_notification(
            task_data.assigned_to,
            "Task Reassigned to You",
            f"{user.name} assigned you a task: '{task.get('title')}'",
            "task",
            "/calendar"
        )
    
    # Get updated task
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return {"message": "Task updated successfully", "task": updated_task}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    """Delete a task"""
    user = await get_current_user(request)
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Role-based access check
    if user.role in ["Designer", "PreSales"]:
        if task.get("assigned_to") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    await db.tasks.delete_one({"id": task_id})
    
    return {"message": "Task deleted successfully"}

# ============ CALENDAR ENDPOINTS ============

@api_router.get("/calendar-events")
async def get_calendar_events(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    designer_id: Optional[str] = None,
    project_id: Optional[str] = None,
    event_type: Optional[str] = None,  # "milestone", "task", "meeting", "all"
    status: Optional[str] = None
):
    """Get calendar events (milestones + tasks) with role-based filtering"""
    user = await get_current_user(request)
    
    events = []
    now = datetime.now(timezone.utc)
    
    # Parse date range
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    
    # Get all users for name lookups
    all_users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "role": 1, "picture": 1}).to_list(1000)
    users_map = {u["user_id"]: u for u in all_users}
    
    # ============ FETCH MILESTONES ============
    if event_type in [None, "all", "milestone"]:
        # Build project query based on role
        project_query = {}
        
        if user.role == "Designer":
            project_query["collaborators"] = user.user_id
        elif user.role == "PreSales":
            # PreSales don't see project milestones
            project_query = None
        
        # Apply filters
        if project_id and project_query is not None:
            project_query["project_id"] = project_id
        
        if designer_id and user.role in ["Admin", "Manager"] and project_query is not None:
            project_query["collaborators"] = designer_id
        
        if project_query is not None:
            projects = await db.projects.find(project_query, {"_id": 0}).to_list(1000)
            
            for project in projects:
                # Get designer name
                designer_name = None
                for collab_id in project.get("collaborators", []):
                    if collab_id in users_map and users_map[collab_id].get("role") == "Designer":
                        designer_name = users_map[collab_id].get("name")
                        break
                
                for milestone in project.get("timeline", []):
                    milestone_date_str = milestone.get("expectedDate") or milestone.get("completedDate") or milestone.get("date")
                    if not milestone_date_str:
                        continue
                    
                    try:
                        milestone_date = datetime.fromisoformat(milestone_date_str.replace("Z", "+00:00"))
                        if milestone_date.tzinfo is None:
                            milestone_date = milestone_date.replace(tzinfo=timezone.utc)
                    except Exception:
                        continue
                    
                    # Date range filter
                    if start_dt and milestone_date < start_dt:
                        continue
                    if end_dt and milestone_date > end_dt:
                        continue
                    
                    # Status filter
                    milestone_status = milestone.get("status", "pending")
                    if status and status != "all" and milestone_status != status:
                        continue
                    
                    # Determine color based on status
                    if milestone_status == "completed":
                        color = "#22C55E"  # Green
                    elif milestone_status == "delayed":
                        color = "#EF4444"  # Red
                    else:
                        color = "#2563EB"  # Blue (upcoming)
                    
                    events.append({
                        "id": f"milestone_{project['project_id']}_{milestone.get('id', '')}",
                        "title": milestone.get("title", "Milestone"),
                        "start": milestone_date_str,
                        "end": milestone_date_str,
                        "type": "milestone",
                        "status": milestone_status,
                        "color": color,
                        "project_id": project["project_id"],
                        "project_name": project.get("project_name"),
                        "client_name": project.get("client_name"),
                        "stage": milestone.get("stage_ref") or project.get("stage"),
                        "designer": designer_name,
                        "expected_date": milestone.get("expectedDate"),
                        "completed_date": milestone.get("completedDate")
                    })
    
    # ============ FETCH TASKS ============
    if event_type in [None, "all", "task"]:
        task_query = {}
        
        # Role-based filtering for tasks
        if user.role == "Designer":
            task_query["assigned_to"] = user.user_id
        elif user.role == "PreSales":
            task_query["assigned_to"] = user.user_id
        
        # Apply filters
        if project_id:
            task_query["project_id"] = project_id
        
        if designer_id and user.role in ["Admin", "Manager"]:
            task_query["assigned_to"] = designer_id
        
        tasks = await db.tasks.find(task_query, {"_id": 0}).to_list(1000)
        
        # Get project names for project-linked tasks
        project_ids = list(set([t.get("project_id") for t in tasks if t.get("project_id")]))
        projects_map = {}
        if project_ids:
            projects_list = await db.projects.find(
                {"project_id": {"$in": project_ids}},
                {"_id": 0, "project_id": 1, "project_name": 1, "client_name": 1}
            ).to_list(1000)
            projects_map = {p["project_id"]: p for p in projects_list}
        
        for task in tasks:
            task_date_str = task.get("due_date")
            if not task_date_str:
                continue
            
            try:
                task_date = datetime.fromisoformat(task_date_str.replace("Z", "+00:00"))
                if task_date.tzinfo is None:
                    task_date = task_date.replace(tzinfo=timezone.utc)
            except Exception:
                continue
            
            # Date range filter
            if start_dt and task_date < start_dt:
                continue
            if end_dt and task_date > end_dt:
                continue
            
            # Determine task status for filtering and color
            task_status = task.get("status", "Pending")
            
            # Check if overdue
            is_overdue = False
            if task_status != "Completed" and task_date < now:
                is_overdue = True
            
            # Status filter
            if status and status != "all":
                if status == "overdue" and not is_overdue:
                    continue
                elif status != "overdue" and task_status.lower() != status.lower():
                    continue
            
            # Determine color based on status
            if task_status == "Completed":
                color = "#22C55E"  # Green
            elif is_overdue:
                color = "#EF4444"  # Red (overdue)
            elif task_status == "In Progress":
                color = "#F97316"  # Orange
            else:
                color = "#EAB308"  # Yellow (pending)
            
            # Get assignee name
            assignee_name = None
            if task.get("assigned_to") and task["assigned_to"] in users_map:
                assignee_name = users_map[task["assigned_to"]].get("name")
            
            # Get project details
            project_name = None
            client_name = None
            if task.get("project_id") and task["project_id"] in projects_map:
                project_name = projects_map[task["project_id"]].get("project_name")
                client_name = projects_map[task["project_id"]].get("client_name")
            
            events.append({
                "id": task["id"],
                "title": task.get("title", "Task"),
                "start": task_date_str,
                "end": task_date_str,
                "type": "task",
                "status": "overdue" if is_overdue else task_status.lower(),
                "color": color,
                "project_id": task.get("project_id"),
                "project_name": project_name,
                "client_name": client_name,
                "priority": task.get("priority"),
                "description": task.get("description"),
                "assigned_to": task.get("assigned_to"),
                "assignee_name": assignee_name,
                "is_overdue": is_overdue
            })
    
    # ============ FETCH MEETINGS ============
    if event_type in [None, "all", "meeting"]:
        meeting_query = {}
        
        # Role-based filtering for meetings
        if user.role == "Designer":
            meeting_query["scheduled_for"] = user.user_id
        elif user.role == "PreSales":
            meeting_query["$or"] = [
                {"scheduled_by": user.user_id},
                {"scheduled_for": user.user_id}
            ]
        
        # Apply filters
        if project_id:
            meeting_query["project_id"] = project_id
        
        if designer_id and user.role in ["Admin", "Manager"]:
            meeting_query["scheduled_for"] = designer_id
        
        meetings = await db.meetings.find(meeting_query, {"_id": 0}).to_list(1000)
        
        for meeting in meetings:
            meeting_date_str = meeting.get("date")
            if not meeting_date_str:
                continue
            
            try:
                meeting_date = datetime.fromisoformat(meeting_date_str.replace("Z", "+00:00"))
                if meeting_date.tzinfo is None:
                    meeting_date = meeting_date.replace(tzinfo=timezone.utc)
            except Exception:
                continue
            
            # Date range filter
            if start_dt and meeting_date < start_dt:
                continue
            if end_dt and meeting_date > end_dt:
                continue
            
            meeting_status = meeting.get("status", "Scheduled")
            
            # Status filter
            if status and status != "all" and meeting_status.lower() != status.lower():
                continue
            
            # Determine color based on status
            if meeting_status == "Completed":
                color = "#22C55E"  # Green
            elif meeting_status == "Missed":
                color = "#EF4444"  # Red
            elif meeting_status == "Cancelled":
                color = "#6B7280"  # Gray
            else:
                color = "#9333EA"  # Purple (Scheduled)
            
            # Get names
            scheduled_for_name = None
            scheduled_by_name = None
            if meeting.get("scheduled_for") and meeting["scheduled_for"] in users_map:
                scheduled_for_name = users_map[meeting["scheduled_for"]].get("name")
            if meeting.get("scheduled_by") and meeting["scheduled_by"] in users_map:
                scheduled_by_name = users_map[meeting["scheduled_by"]].get("name")
            
            # Get project/lead names
            project_name = None
            lead_name = None
            if meeting.get("project_id"):
                proj = await db.projects.find_one({"project_id": meeting["project_id"]}, {"_id": 0, "project_name": 1})
                if proj:
                    project_name = proj.get("project_name")
            if meeting.get("lead_id"):
                lead = await db.leads.find_one({"lead_id": meeting["lead_id"]}, {"_id": 0, "customer_name": 1})
                if lead:
                    lead_name = lead.get("customer_name")
            
            events.append({
                "id": meeting["id"],
                "title": meeting.get("title", "Meeting"),
                "start": meeting_date_str,
                "end": meeting_date_str,
                "type": "meeting",
                "status": meeting_status.lower(),
                "color": color,
                "project_id": meeting.get("project_id"),
                "project_name": project_name,
                "lead_id": meeting.get("lead_id"),
                "lead_name": lead_name,
                "description": meeting.get("description"),
                "location": meeting.get("location"),
                "start_time": meeting.get("start_time"),
                "end_time": meeting.get("end_time"),
                "scheduled_for": meeting.get("scheduled_for"),
                "scheduled_for_name": scheduled_for_name,
                "scheduled_by": meeting.get("scheduled_by"),
                "scheduled_by_name": scheduled_by_name
            })
    
    # Sort by date
    events.sort(key=lambda x: x.get("start", ""))
    
    return {
        "events": events,
        "total": len(events)
    }


# ============ MEETING MODELS ============

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

MEETING_STATUSES = ["Scheduled", "Completed", "Missed", "Cancelled"]

# ============ MEETING ENDPOINTS ============

@api_router.get("/meetings")
async def list_meetings(
    request: Request,
    project_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    scheduled_for: Optional[str] = None,
    status: Optional[str] = None,
    filter_type: Optional[str] = None  # "today", "this_week", "this_month", "upcoming", "missed", "old", "all"
):
    """List meetings with filters - role-based access"""
    user = await get_current_user(request)
    
    query = {}
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)
    month_end = today_start + timedelta(days=30)
    
    # Role-based filtering
    if user.role == "Designer":
        query["scheduled_for"] = user.user_id
    elif user.role == "PreSales":
        query["$or"] = [
            {"scheduled_by": user.user_id},
            {"scheduled_for": user.user_id},
            {"lead_id": {"$ne": None}}  # PreSales can see lead meetings
        ]
    
    # Apply filters
    if project_id:
        query["project_id"] = project_id
    
    if lead_id:
        query["lead_id"] = lead_id
    
    if scheduled_for and user.role in ["Admin", "Manager"]:
        query["scheduled_for"] = scheduled_for
    
    if status and status != "all":
        query["status"] = status
    
    # Date-based filters - use proper datetime comparison
    if filter_type == "today":
        # Meetings scheduled for today
        query["date"] = {
            "$gte": today_start.strftime("%Y-%m-%d"),
            "$lt": today_end.strftime("%Y-%m-%d")
        }
    elif filter_type == "this_week":
        # Meetings scheduled for this week (from today)
        query["date"] = {
            "$gte": today_start.strftime("%Y-%m-%d"),
            "$lt": week_end.strftime("%Y-%m-%d")
        }
    elif filter_type == "this_month":
        # Meetings scheduled for this month
        query["date"] = {
            "$gte": today_start.strftime("%Y-%m-%d"),
            "$lt": month_end.strftime("%Y-%m-%d")
        }
    elif filter_type == "upcoming":
        # Future meetings from today onwards
        query["date"] = {"$gte": today_start.strftime("%Y-%m-%d")}
        if "status" not in query:
            query["status"] = "Scheduled"
    elif filter_type == "missed":
        query["status"] = "Missed"
    elif filter_type == "old":
        # Past meetings (before today)
        query["date"] = {"$lt": today_start.strftime("%Y-%m-%d")}
    # "all" filter - no date restriction
    
    meetings = await db.meetings.find(query, {"_id": 0}).to_list(1000)
    
    # Get user details
    user_ids = set()
    for m in meetings:
        if m.get("scheduled_for"):
            user_ids.add(m["scheduled_for"])
        if m.get("scheduled_by"):
            user_ids.add(m["scheduled_by"])
    
    users_map = {}
    if user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": list(user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        ).to_list(1000)
        users_map = {u["user_id"]: u for u in users_list}
    
    # Get project/lead names
    project_ids = list(set([m.get("project_id") for m in meetings if m.get("project_id")]))
    lead_ids = list(set([m.get("lead_id") for m in meetings if m.get("lead_id")]))
    
    projects_map = {}
    leads_map = {}
    
    if project_ids:
        projects_list = await db.projects.find(
            {"project_id": {"$in": project_ids}},
            {"_id": 0, "project_id": 1, "project_name": 1, "client_name": 1}
        ).to_list(1000)
        projects_map = {p["project_id"]: p for p in projects_list}
    
    if lead_ids:
        leads_list = await db.leads.find(
            {"lead_id": {"$in": lead_ids}},
            {"_id": 0, "lead_id": 1, "customer_name": 1, "customer_phone": 1}
        ).to_list(1000)
        leads_map = {l["lead_id"]: l for l in leads_list}
    
    # Enrich meetings
    result = []
    for meeting in meetings:
        enriched = {**meeting}
        
        if meeting.get("scheduled_for") and meeting["scheduled_for"] in users_map:
            enriched["scheduled_for_user"] = users_map[meeting["scheduled_for"]]
        
        if meeting.get("scheduled_by") and meeting["scheduled_by"] in users_map:
            enriched["scheduled_by_user"] = users_map[meeting["scheduled_by"]]
        
        if meeting.get("project_id") and meeting["project_id"] in projects_map:
            enriched["project"] = projects_map[meeting["project_id"]]
        
        if meeting.get("lead_id") and meeting["lead_id"] in leads_map:
            enriched["lead"] = leads_map[meeting["lead_id"]]
        
        result.append(enriched)
    
    # Sort by date descending
    result.sort(key=lambda x: (x.get("date", ""), x.get("start_time", "")), reverse=True)
    
    return result

@api_router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, request: Request):
    """Get single meeting by ID"""
    user = await get_current_user(request)
    
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Role-based access check
    if user.role == "Designer" and meeting.get("scheduled_for") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if user.role == "PreSales":
        is_scheduler = meeting.get("scheduled_by") == user.user_id
        is_attendee = meeting.get("scheduled_for") == user.user_id
        has_lead = meeting.get("lead_id") is not None
        if not (is_scheduler or is_attendee or has_lead):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get user details
    if meeting.get("scheduled_for"):
        user_doc = await db.users.find_one(
            {"user_id": meeting["scheduled_for"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        )
        if user_doc:
            meeting["scheduled_for_user"] = user_doc
    
    if meeting.get("scheduled_by"):
        user_doc = await db.users.find_one(
            {"user_id": meeting["scheduled_by"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        )
        if user_doc:
            meeting["scheduled_by_user"] = user_doc
    
    # Get project/lead details
    if meeting.get("project_id"):
        project = await db.projects.find_one(
            {"project_id": meeting["project_id"]},
            {"_id": 0, "project_id": 1, "project_name": 1, "client_name": 1}
        )
        if project:
            meeting["project"] = project
    
    if meeting.get("lead_id"):
        lead = await db.leads.find_one(
            {"lead_id": meeting["lead_id"]},
            {"_id": 0, "lead_id": 1, "customer_name": 1, "customer_phone": 1}
        )
        if lead:
            meeting["lead"] = lead
    
    return meeting

@api_router.post("/meetings")
async def create_meeting(meeting_data: MeetingCreate, request: Request):
    """Create a new meeting"""
    user = await get_current_user(request)
    
    # Role-based permissions
    if user.role == "Designer":
        # Designers can only schedule meetings for projects they're assigned to
        if meeting_data.project_id:
            project = await db.projects.find_one({"project_id": meeting_data.project_id}, {"_id": 0})
            if not project or user.user_id not in project.get("collaborators", []):
                raise HTTPException(status_code=403, detail="You can only schedule meetings for your projects")
        # Cannot schedule for others
        if meeting_data.scheduled_for != user.user_id:
            raise HTTPException(status_code=403, detail="You can only schedule meetings for yourself")
    
    if user.role == "PreSales":
        # PreSales can only schedule lead meetings
        if meeting_data.project_id:
            raise HTTPException(status_code=403, detail="PreSales cannot schedule project meetings")
        if not meeting_data.lead_id:
            raise HTTPException(status_code=403, detail="PreSales must link meetings to a lead")
    
    # Validate project if provided
    if meeting_data.project_id:
        project = await db.projects.find_one({"project_id": meeting_data.project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate lead if provided
    if meeting_data.lead_id:
        lead = await db.leads.find_one({"lead_id": meeting_data.lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
    
    # Validate scheduled_for user
    scheduled_user = await db.users.find_one({"user_id": meeting_data.scheduled_for}, {"_id": 0})
    if not scheduled_user:
        raise HTTPException(status_code=404, detail="Scheduled user not found")
    
    now = datetime.now(timezone.utc)
    meeting_id = f"meeting_{uuid.uuid4().hex[:8]}"
    
    new_meeting = {
        "id": meeting_id,
        "title": meeting_data.title,
        "description": meeting_data.description or "",
        "project_id": meeting_data.project_id,
        "lead_id": meeting_data.lead_id,
        "scheduled_by": user.user_id,
        "scheduled_for": meeting_data.scheduled_for,
        "date": meeting_data.date,
        "start_time": meeting_data.start_time,
        "end_time": meeting_data.end_time,
        "location": meeting_data.location or "",
        "status": "Scheduled",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.meetings.insert_one(new_meeting)
    
    # Remove MongoDB _id from response
    new_meeting.pop("_id", None)
    
    # Create notification for scheduled user if different from creator
    if meeting_data.scheduled_for != user.user_id:
        meeting_context = ""
        if meeting_data.project_id:
            project = await db.projects.find_one({"project_id": meeting_data.project_id}, {"_id": 0, "project_name": 1})
            meeting_context = f" for project '{project.get('project_name', '')}'" if project else ""
        elif meeting_data.lead_id:
            lead = await db.leads.find_one({"lead_id": meeting_data.lead_id}, {"_id": 0, "customer_name": 1})
            meeting_context = f" with lead '{lead.get('customer_name', '')}'" if lead else ""
        
        await create_notification(
            meeting_data.scheduled_for,
            "New Meeting Scheduled",
            f"{user.name} scheduled a meeting: '{meeting_data.title}'{meeting_context} on {meeting_data.date} at {meeting_data.start_time}",
            "meeting",
            "/meetings"
        )
    
    return {"message": "Meeting created successfully", "meeting": new_meeting}

@api_router.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, meeting_data: MeetingUpdate, request: Request):
    """Update a meeting"""
    user = await get_current_user(request)
    
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Role-based access check
    if user.role == "Designer":
        if meeting.get("scheduled_for") != user.user_id and meeting.get("scheduled_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    if user.role == "PreSales":
        if meeting.get("scheduled_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate status if provided
    if meeting_data.status and meeting_data.status not in MEETING_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {MEETING_STATUSES}")
    
    # Build update dict
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if meeting_data.title is not None:
        update_dict["title"] = meeting_data.title
    if meeting_data.description is not None:
        update_dict["description"] = meeting_data.description
    if meeting_data.project_id is not None:
        update_dict["project_id"] = meeting_data.project_id if meeting_data.project_id else None
    if meeting_data.lead_id is not None:
        update_dict["lead_id"] = meeting_data.lead_id if meeting_data.lead_id else None
    if meeting_data.scheduled_for is not None:
        update_dict["scheduled_for"] = meeting_data.scheduled_for
    if meeting_data.date is not None:
        update_dict["date"] = meeting_data.date
    if meeting_data.start_time is not None:
        update_dict["start_time"] = meeting_data.start_time
    if meeting_data.end_time is not None:
        update_dict["end_time"] = meeting_data.end_time
    if meeting_data.location is not None:
        update_dict["location"] = meeting_data.location
    if meeting_data.status is not None:
        update_dict["status"] = meeting_data.status
    
    await db.meetings.update_one(
        {"id": meeting_id},
        {"$set": update_dict}
    )
    
    # Notify if status changed
    if meeting_data.status and meeting_data.status != meeting.get("status"):
        notify_user = meeting.get("scheduled_for") if meeting.get("scheduled_for") != user.user_id else meeting.get("scheduled_by")
        if notify_user:
            await create_notification(
                notify_user,
                f"Meeting {meeting_data.status}",
                f"Meeting '{meeting.get('title')}' has been marked as {meeting_data.status}",
                "meeting",
                "/meetings"
            )
    
    # Get updated meeting
    updated_meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    return {"message": "Meeting updated successfully", "meeting": updated_meeting}

@api_router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, request: Request):
    """Delete a meeting"""
    user = await get_current_user(request)
    
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Role-based access check - only creator or Admin/Manager can delete
    if user.role not in ["Admin", "Manager"]:
        if meeting.get("scheduled_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Only the meeting creator can delete this meeting")
    
    await db.meetings.delete_one({"id": meeting_id})
    
    return {"message": "Meeting deleted successfully"}

@api_router.get("/projects/{project_id}/meetings")
async def get_project_meetings(project_id: str, request: Request):
    """Get meetings for a specific project"""
    user = await get_current_user(request)
    
    # Verify project exists and user has access
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check access for Designer role
    if user.role == "Designer" and user.user_id not in project.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if user.role == "PreSales":
        raise HTTPException(status_code=403, detail="Access denied")
    
    meetings = await db.meetings.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    # Get user details
    user_ids = set()
    for m in meetings:
        if m.get("scheduled_for"):
            user_ids.add(m["scheduled_for"])
        if m.get("scheduled_by"):
            user_ids.add(m["scheduled_by"])
    
    users_map = {}
    if user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": list(user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        ).to_list(1000)
        users_map = {u["user_id"]: u for u in users_list}
    
    result = []
    for meeting in meetings:
        enriched = {**meeting}
        if meeting.get("scheduled_for") and meeting["scheduled_for"] in users_map:
            enriched["scheduled_for_user"] = users_map[meeting["scheduled_for"]]
        if meeting.get("scheduled_by") and meeting["scheduled_by"] in users_map:
            enriched["scheduled_by_user"] = users_map[meeting["scheduled_by"]]
        result.append(enriched)
    
    # Sort by date
    result.sort(key=lambda x: (x.get("date", ""), x.get("start_time", "")), reverse=True)
    
    return result

@api_router.get("/leads/{lead_id}/meetings")
async def get_lead_meetings(lead_id: str, request: Request):
    """Get meetings for a specific lead"""
    user = await get_current_user(request)
    
    # Verify lead exists
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check access based on role
    if user.role == "Designer":
        if lead.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    meetings = await db.meetings.find({"lead_id": lead_id}, {"_id": 0}).to_list(1000)
    
    # Get user details
    user_ids = set()
    for m in meetings:
        if m.get("scheduled_for"):
            user_ids.add(m["scheduled_for"])
        if m.get("scheduled_by"):
            user_ids.add(m["scheduled_by"])
    
    users_map = {}
    if user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": list(user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        ).to_list(1000)
        users_map = {u["user_id"]: u for u in users_list}
    
    result = []
    for meeting in meetings:
        enriched = {**meeting}
        if meeting.get("scheduled_for") and meeting["scheduled_for"] in users_map:
            enriched["scheduled_for_user"] = users_map[meeting["scheduled_for"]]
        if meeting.get("scheduled_by") and meeting["scheduled_by"] in users_map:
            enriched["scheduled_by_user"] = users_map[meeting["scheduled_by"]]
        result.append(enriched)
    
    # Sort by date
    result.sort(key=lambda x: (x.get("date", ""), x.get("start_time", "")), reverse=True)
    
    return result

@api_router.post("/meetings/check-missed")
async def check_missed_meetings(request: Request):
    """Check and mark meetings as missed (called periodically or on page load)"""
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    
    # Find scheduled meetings that have passed their end time
    query = {"status": "Scheduled"}
    
    # Role-based filtering
    if user.role == "Designer":
        query["scheduled_for"] = user.user_id
    elif user.role == "PreSales":
        query["$or"] = [
            {"scheduled_by": user.user_id},
            {"scheduled_for": user.user_id}
        ]
    
    meetings = await db.meetings.find(query, {"_id": 0}).to_list(1000)
    
    missed_count = 0
    for meeting in meetings:
        try:
            meeting_date_str = meeting.get("date", "")
            end_time_str = meeting.get("end_time", "23:59")
            
            # Parse the meeting datetime
            meeting_datetime_str = f"{meeting_date_str}T{end_time_str}:00"
            meeting_end = datetime.fromisoformat(meeting_datetime_str)
            if meeting_end.tzinfo is None:
                meeting_end = meeting_end.replace(tzinfo=timezone.utc)
            
            # If meeting end time has passed, mark as missed
            if meeting_end < now:
                await db.meetings.update_one(
                    {"id": meeting["id"]},
                    {"$set": {"status": "Missed", "updated_at": now.isoformat()}}
                )
                missed_count += 1
                
                # Notify
                await create_notification(
                    meeting.get("scheduled_for"),
                    "Meeting Missed",
                    f"Meeting '{meeting.get('title')}' was marked as missed",
                    "meeting",
                    "/meetings"
                )
        except Exception:
            pass
    
    return {"message": f"Checked meetings, marked {missed_count} as missed", "missed_count": missed_count}


# ============ REPORTS & ANALYTICS ============

# Probability mapping for revenue forecasting
STAGE_PROBABILITY = {
    "Design Finalization": 0.40,
    "Production Preparation": 0.60,
    "Production": 0.80,
    "Delivery": 0.90,
    "Installation": 0.95,
    "Handover": 1.00
}

@api_router.get("/reports/revenue")
async def get_revenue_report(request: Request):
    """Revenue Forecast Report - Admin/Manager only"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (current_month_start + timedelta(days=32)).replace(day=1)
    
    # Get all projects
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    # Calculate metrics
    total_forecast = 0
    expected_this_month = 0
    pending_collections = []
    stage_wise_revenue = {}
    
    for project in projects:
        project_value = project.get("project_value", 0)
        stage = project.get("stage", "Design Finalization")
        probability = STAGE_PROBABILITY.get(stage, 0.40)
        
        # Total Revenue Forecast
        total_forecast += project_value * probability
        
        # Collected and pending
        payments = project.get("payments", [])
        collected = sum(p.get("amount", 0) for p in payments)
        pending = project_value - collected
        
        # Stage-wise revenue
        if stage not in stage_wise_revenue:
            stage_wise_revenue[stage] = {"count": 0, "value": 0, "weighted": 0}
        stage_wise_revenue[stage]["count"] += 1
        stage_wise_revenue[stage]["value"] += project_value
        stage_wise_revenue[stage]["weighted"] += project_value * probability
        
        # Expected this month - check payment schedule milestones
        payment_schedule = project.get("payment_schedule", [])
        custom_enabled = project.get("custom_payment_schedule_enabled", False)
        custom_schedule = project.get("custom_payment_schedule", [])
        active_schedule = custom_schedule if (custom_enabled and custom_schedule) else payment_schedule
        
        # Determine next payment stage based on collected amount
        cumulative = 0
        next_stage = None
        next_amount = 0
        
        for milestone in active_schedule:
            milestone_type = milestone.get("type", "percentage")
            if milestone_type == "fixed":
                milestone_amount = milestone.get("fixedAmount", 0)
            elif milestone_type == "percentage":
                milestone_amount = (project_value * milestone.get("percentage", 0)) / 100
            else:  # remaining
                milestone_amount = max(0, project_value - cumulative)
            
            cumulative += milestone_amount
            if collected < cumulative:
                next_stage = milestone.get("stage")
                next_amount = milestone_amount
                break
        
        # Expected date from timeline
        expected_date = None
        timeline = project.get("timeline", [])
        for item in timeline:
            if item.get("status") == "pending":
                expected_date = item.get("expectedDate")
                break
        
        # Determine status color
        status_color = "blue"  # upcoming
        if pending <= 0:
            status_color = "green"  # completed
        elif expected_date:
            try:
                exp_dt = datetime.fromisoformat(expected_date.replace("Z", "+00:00"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                if exp_dt < now:
                    status_color = "red"  # overdue
                elif exp_dt < now + timedelta(days=7):
                    status_color = "orange"  # due soon
                
                # Check if expected this month
                if current_month_start <= exp_dt < next_month:
                    expected_this_month += next_amount if next_amount else pending
            except Exception:
                pass
        
        if pending > 0:
            pending_collections.append({
                "project_id": project.get("project_id"),
                "project_name": project.get("project_name"),
                "client_name": project.get("client_name"),
                "project_value": project_value,
                "collected": collected,
                "pending": pending,
                "next_stage": next_stage,
                "next_amount": next_amount,
                "expected_date": expected_date,
                "status_color": status_color,
                "stage": stage
            })
    
    # Sort pending collections by status priority
    status_priority = {"red": 0, "orange": 1, "blue": 2, "green": 3}
    pending_collections.sort(key=lambda x: (status_priority.get(x["status_color"], 2), x.get("expected_date") or "9999"))
    
    # Stage-wise projection for payment milestones
    milestone_projection = {
        "Design Booking": 0,
        "Production Start": 0,
        "Before Installation": 0
    }
    
    for project in projects:
        project_value = project.get("project_value", 0)
        payments = project.get("payments", [])
        collected = sum(p.get("amount", 0) for p in payments)
        
        # Simple projection based on default schedule
        booking_amount = min(25000, project_value * 0.10)
        production_amount = project_value * 0.50
        installation_amount = project_value - booking_amount - production_amount
        
        if collected < booking_amount:
            milestone_projection["Design Booking"] += booking_amount - collected
            milestone_projection["Production Start"] += production_amount
            milestone_projection["Before Installation"] += installation_amount
        elif collected < booking_amount + production_amount:
            milestone_projection["Production Start"] += (booking_amount + production_amount) - collected
            milestone_projection["Before Installation"] += installation_amount
        elif collected < project_value:
            milestone_projection["Before Installation"] += project_value - collected
    
    return {
        "total_forecast": round(total_forecast, 2),
        "expected_this_month": round(expected_this_month, 2),
        "total_pending": sum(p["pending"] for p in pending_collections),
        "total_collected": sum(sum(p.get("amount", 0) for p in project.get("payments", [])) for project in projects),
        "pending_collections": pending_collections,
        "stage_wise_revenue": stage_wise_revenue,
        "milestone_projection": milestone_projection,
        "projects_count": len(projects)
    }

@api_router.get("/reports/projects")
async def get_projects_report(request: Request):
    """Project Health Report - Admin/Manager only"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Get all projects
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    # Get all users for designer names
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "role": 1}).to_list(1000)
    users_map = {u["user_id"]: u for u in users}
    
    # Metrics
    total_active = 0
    projects_by_stage = {}
    delayed_count = 0
    on_track_count = 0
    total_delay_days = 0
    delay_project_count = 0
    pending_payment_count = 0
    production_count = 0
    installation_count = 0
    
    project_details = []
    
    for project in projects:
        stage = project.get("stage", "Design Finalization")
        project_value = project.get("project_value", 0)
        payments = project.get("payments", [])
        collected = sum(p.get("amount", 0) for p in payments)
        timeline = project.get("timeline", [])
        collaborators = project.get("collaborators", [])
        
        # Count stages
        if stage not in projects_by_stage:
            projects_by_stage[stage] = 0
        projects_by_stage[stage] += 1
        
        # Active projects (not completed)
        if stage not in ["Handover", "Delivery"]:
            total_active += 1
        
        # Production vs Installation
        if stage in ["Production", "Production Preparation"]:
            production_count += 1
        elif stage == "Installation":
            installation_count += 1
        
        # Check delay status
        delay_status = "On Time"
        delay_days = 0
        expected_handover = None
        
        for item in timeline:
            expected_date_str = item.get("expectedDate")
            completed_date_str = item.get("completedDate")
            status = item.get("status", "pending")
            
            if item.get("title") == "Handover" or "handover" in item.get("title", "").lower():
                expected_handover = expected_date_str
            
            if status == "delayed" or (status == "pending" and expected_date_str):
                try:
                    expected_dt = datetime.fromisoformat(expected_date_str.replace("Z", "+00:00"))
                    if expected_dt.tzinfo is None:
                        expected_dt = expected_dt.replace(tzinfo=timezone.utc)
                    
                    if status == "delayed":
                        if completed_date_str:
                            completed_dt = datetime.fromisoformat(completed_date_str.replace("Z", "+00:00"))
                            if completed_dt.tzinfo is None:
                                completed_dt = completed_dt.replace(tzinfo=timezone.utc)
                            days = (completed_dt - expected_dt).days
                        else:
                            days = (now - expected_dt).days
                        
                        if days > delay_days:
                            delay_days = days
                            if days > 14:
                                delay_status = "Critical"
                            else:
                                delay_status = "Delayed"
                    elif expected_dt < now:
                        days = (now - expected_dt).days
                        if days > delay_days:
                            delay_days = days
                            if days > 14:
                                delay_status = "Critical"
                            else:
                                delay_status = "Delayed"
                except Exception:
                    pass
        
        if delay_status in ["Delayed", "Critical"]:
            delayed_count += 1
            total_delay_days += delay_days
            delay_project_count += 1
        else:
            on_track_count += 1
        
        # Payment status
        payment_status = "Pending"
        if project_value > 0:
            if collected >= project_value:
                payment_status = "Complete"
            elif collected > 0:
                payment_status = f"Partial ({int(collected/project_value*100)}%)"
            
            if collected < project_value:
                pending_payment_count += 1
        
        # Get designer name
        designer_name = None
        for collab_id in collaborators:
            if collab_id in users_map and users_map[collab_id].get("role") == "Designer":
                designer_name = users_map[collab_id].get("name")
                break
        
        project_details.append({
            "project_id": project.get("project_id"),
            "project_name": project.get("project_name"),
            "client_name": project.get("client_name"),
            "designer": designer_name,
            "stage": stage,
            "delay_status": delay_status,
            "delay_days": delay_days,
            "payment_status": payment_status,
            "project_value": project_value,
            "collected": collected,
            "expected_handover": expected_handover
        })
    
    # Sort by delay status priority
    delay_priority = {"Critical": 0, "Delayed": 1, "On Time": 2}
    project_details.sort(key=lambda x: (delay_priority.get(x["delay_status"], 2), -x.get("delay_days", 0)))
    
    avg_delay = round(total_delay_days / delay_project_count, 1) if delay_project_count > 0 else 0
    
    return {
        "total_projects": len(projects),
        "total_active": total_active,
        "projects_by_stage": projects_by_stage,
        "delayed_count": delayed_count,
        "on_track_count": on_track_count,
        "avg_delay_days": avg_delay,
        "pending_payment_count": pending_payment_count,
        "production_count": production_count,
        "installation_count": installation_count,
        "project_details": project_details
    }

@api_router.get("/reports/leads")
async def get_leads_report(request: Request):
    """Lead Conversion Report - Admin/Manager/PreSales"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all leads
    leads = await db.leads.find({}, {"_id": 0}).to_list(1000)
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "role": 1}).to_list(1000)
    users_map = {u["user_id"]: u for u in users}
    presales_users = [u for u in users if u.get("role") == "PreSales"]
    
    # Metrics
    total_leads = len(leads)
    qualified_count = 0
    converted_count = 0
    lost_count = 0
    total_cycle_days = 0
    cycle_count = 0
    
    source_performance = {}
    presales_performance = {}
    
    # Initialize presales performance
    for ps in presales_users:
        presales_performance[ps["user_id"]] = {
            "name": ps.get("name"),
            "assigned": 0,
            "qualified": 0,
            "converted": 0,
            "lost": 0,
            "response_times": []
        }
    
    for lead in leads:
        status = lead.get("status", "New")
        source = lead.get("source", "Unknown")
        presales_id = lead.get("presales_id")
        created_at = lead.get("created_at")
        converted_at = lead.get("converted_at")
        
        # Source performance
        if source not in source_performance:
            source_performance[source] = {"total": 0, "qualified": 0, "converted": 0, "lost": 0}
        source_performance[source]["total"] += 1
        
        # Status counts
        if status in ["Qualified", "Site Visit Scheduled", "Site Visit Done", "Converted"]:
            qualified_count += 1
            source_performance[source]["qualified"] += 1
        
        if status == "Converted":
            converted_count += 1
            source_performance[source]["converted"] += 1
            
            # Calculate cycle time
            if created_at and converted_at:
                try:
                    created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    converted_dt = datetime.fromisoformat(converted_at.replace("Z", "+00:00"))
                    if created_dt.tzinfo is None:
                        created_dt = created_dt.replace(tzinfo=timezone.utc)
                    if converted_dt.tzinfo is None:
                        converted_dt = converted_dt.replace(tzinfo=timezone.utc)
                    cycle_days = (converted_dt - created_dt).days
                    total_cycle_days += cycle_days
                    cycle_count += 1
                except Exception:
                    pass
        
        if status in ["Lost", "Not Interested"]:
            lost_count += 1
            source_performance[source]["lost"] += 1
        
        # PreSales performance
        if presales_id and presales_id in presales_performance:
            presales_performance[presales_id]["assigned"] += 1
            
            if status in ["Qualified", "Site Visit Scheduled", "Site Visit Done", "Converted"]:
                presales_performance[presales_id]["qualified"] += 1
            
            if status == "Converted":
                presales_performance[presales_id]["converted"] += 1
            
            if status in ["Lost", "Not Interested"]:
                presales_performance[presales_id]["lost"] += 1
    
    conversion_rate = round((converted_count / total_leads) * 100, 1) if total_leads > 0 else 0
    avg_cycle_time = round(total_cycle_days / cycle_count, 1) if cycle_count > 0 else 0
    
    # Convert presales performance to list
    presales_list = []
    for ps_id, data in presales_performance.items():
        ps_conversion = round((data["converted"] / data["assigned"]) * 100, 1) if data["assigned"] > 0 else 0
        presales_list.append({
            "user_id": ps_id,
            "name": data["name"],
            "assigned": data["assigned"],
            "qualified": data["qualified"],
            "converted": data["converted"],
            "lost": data["lost"],
            "conversion_rate": ps_conversion
        })
    
    # Sort by conversion rate
    presales_list.sort(key=lambda x: x["conversion_rate"], reverse=True)
    
    # If PreSales, filter to show only their data
    if user.role == "PreSales":
        presales_list = [p for p in presales_list if p["user_id"] == user.user_id]
    
    return {
        "total_leads": total_leads,
        "qualified_count": qualified_count,
        "converted_count": converted_count,
        "lost_count": lost_count,
        "conversion_rate": conversion_rate,
        "avg_cycle_time": avg_cycle_time,
        "source_performance": source_performance,
        "presales_performance": presales_list
    }

# ============ PRE-SALES LIST API (CRITICAL) ============

@api_router.get("/presales")
async def list_presales_leads(request: Request, status: Optional[str] = None):
    """
    List pre-sales leads ONLY (lead_type='presales').
    These are leads that have NOT been promoted to the sales pipeline yet.
    """
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Query ONLY presales leads (not converted to regular leads)
    query = {
        "lead_type": "presales",
        "is_converted": False
    }
    
    # PreSales role sees only their assigned leads
    if user.role == "PreSales":
        query["assigned_to"] = user.user_id
    
    # Status filter
    if status and status != "all":
        query["status"] = status
    
    # Fetch presales leads
    presales_leads = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    # Get assigned user details
    all_user_ids = set()
    for lead in presales_leads:
        if lead.get("assigned_to"):
            all_user_ids.add(lead["assigned_to"])
    
    users_map = {}
    if all_user_ids:
        users_list = await db.users.find(
            {"user_id": {"$in": list(all_user_ids)}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "role": 1}
        ).to_list(100)
        users_map = {u["user_id"]: u for u in users_list}
    
    # Build response with user details
    result = []
    for lead in presales_leads:
        # Convert datetime to string if needed
        updated_at = lead.get("updated_at", lead.get("created_at", ""))
        created_at = lead.get("created_at", "")
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        
        assigned_user = users_map.get(lead.get("assigned_to"))
        
        result.append({
            "lead_id": lead["lead_id"],
            "lead_type": lead.get("lead_type", "presales"),
            "customer_name": lead["customer_name"],
            "customer_phone": lead["customer_phone"],
            "customer_email": lead.get("customer_email"),
            "source": lead.get("source"),
            "budget": lead.get("budget"),
            "status": lead.get("status", "New"),
            "stage": lead.get("stage", "New"),
            "assigned_to": lead.get("assigned_to"),
            "assigned_to_details": assigned_user,
            "is_converted": lead.get("is_converted", False),
            "updated_at": updated_at,
            "created_at": created_at
        })
    
    # Sort by created_at descending (newest first)
    result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return result


# ============ PRE-SALES DETAIL APIS ============

@api_router.post("/presales/create")
async def create_presales_lead(request: Request):
    """Create a new pre-sales lead"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "SalesManager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    body = await request.json()
    
    # Validate required fields
    customer_name = body.get("customer_name", "").strip()
    customer_phone = body.get("customer_phone", "").strip()
    
    if not customer_name:
        raise HTTPException(status_code=400, detail="Customer name is required")
    if not customer_phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    now = datetime.now(timezone.utc)
    lead_id = f"lead_{uuid.uuid4().hex[:8]}"
    
    new_lead = {
        "lead_id": lead_id,
        "lead_type": "presales",  # Mark as pre-sales lead
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": body.get("customer_email", ""),
        "customer_address": body.get("customer_address", ""),
        "customer_requirements": body.get("customer_requirements", ""),
        "source": body.get("source", "Others"),
        "budget": body.get("budget"),
        "status": "New",  # Pre-sales always start as New
        "stage": "New",
        "assigned_to": user.user_id,  # Assigned to creator
        "created_by": user.user_id,
        "is_converted": False,
        "comments": [{
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"Lead created by {user.name}",
            "is_system": True,
            "created_at": now.isoformat()
        }],
        "files": [],
        "collaborators": [],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.leads.insert_one(new_lead)
    
    # Remove _id before returning
    new_lead.pop("_id", None)
    return new_lead

@api_router.get("/presales/{presales_id}")
async def get_presales_detail(presales_id: str, request: Request):
    """Get pre-sales lead detail"""
    user = await get_current_user(request)
    
    # Find in leads collection (pre-sales leads are stored in leads)
    presales_lead = await db.leads.find_one(
        {"lead_id": presales_id},
        {"_id": 0}
    )
    
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    # Permission check - PreSales can only see their own leads
    if user.role == "PreSales":
        if presales_lead.get("assigned_to") != user.user_id and presales_lead.get("created_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return presales_lead

@api_router.put("/presales/{presales_id}/status")
async def update_presales_status(presales_id: str, request: Request):
    """Update pre-sales lead status - forward-only progression"""
    user = await get_current_user(request)
    body = await request.json()
    new_status = body.get("status")
    
    # Define valid statuses and forward-only progression order
    PRESALES_STATUS_ORDER = ["New", "Contacted", "Waiting", "Qualified"]
    VALID_STATUSES = ["New", "Contacted", "Waiting", "Qualified", "Dropped"]
    
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    presales_lead = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    # Permission check
    if user.role == "PreSales":
        if presales_lead.get("assigned_to") != user.user_id and presales_lead.get("created_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    old_status = presales_lead.get("status")
    
    # Forward-only validation (except for "Dropped" which can be set from any status)
    if new_status != "Dropped" and old_status != "Dropped":
        old_index = PRESALES_STATUS_ORDER.index(old_status) if old_status in PRESALES_STATUS_ORDER else -1
        new_index = PRESALES_STATUS_ORDER.index(new_status) if new_status in PRESALES_STATUS_ORDER else -1
        
        if old_index >= 0 and new_index >= 0:
            if new_index < old_index:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Cannot move backward from '{old_status}' to '{new_status}'. Status progression is forward-only."
                )
            if new_index > old_index + 1:
                # Allow skipping stages only for Admin/SalesManager
                if user.role not in ["Admin", "SalesManager"]:
                    expected_next = PRESALES_STATUS_ORDER[old_index + 1]
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot skip stages. Next valid status is '{expected_next}'."
                    )
    
    # Cannot change status from Dropped back to progression (only Admin can)
    if old_status == "Dropped" and new_status in PRESALES_STATUS_ORDER:
        if user.role != "Admin":
            raise HTTPException(status_code=403, detail="Only Admin can reactivate dropped leads")
    
    now = datetime.now(timezone.utc)
    
    # Add system comment for status change
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Status changed: {old_status} → {new_status}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": presales_id},
        {
            "$set": {"status": new_status, "updated_at": now.isoformat()},
            "$push": {"comments": system_comment}
        }
    )
    
    return {"success": True, "status": new_status}

@api_router.put("/presales/{presales_id}/customer-details")
async def update_presales_customer_details(presales_id: str, request: Request):
    """Update pre-sales customer details"""
    user = await get_current_user(request)
    body = await request.json()
    
    presales_lead = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    # Permission check
    if user.role == "PreSales":
        if presales_lead.get("assigned_to") != user.user_id and presales_lead.get("created_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    update_dict = {"updated_at": now.isoformat()}
    
    allowed_fields = ["customer_name", "customer_phone", "customer_email", 
                      "customer_address", "customer_requirements", "source", "budget"]
    
    for field in allowed_fields:
        if field in body:
            update_dict[field] = body[field]
    
    await db.leads.update_one(
        {"lead_id": presales_id},
        {"$set": update_dict}
    )
    
    # Add system comment
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": "system",
        "user_name": "System",
        "role": "System",
        "message": f"Customer details updated by {user.name}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    await db.leads.update_one(
        {"lead_id": presales_id},
        {"$push": {"comments": system_comment}}
    )
    
    updated = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    return updated

@api_router.post("/presales/{presales_id}/comments")
async def add_presales_comment(presales_id: str, request: Request):
    """Add comment to pre-sales lead"""
    user = await get_current_user(request)
    body = await request.json()
    message = body.get("message")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    
    presales_lead = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    now = datetime.now(timezone.utc)
    new_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": message,
        "is_system": False,
        "created_at": now.isoformat()
    }
    
    await db.leads.update_one(
        {"lead_id": presales_id},
        {
            "$push": {"comments": new_comment},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return new_comment

@api_router.post("/presales/{presales_id}/files")
async def upload_presales_files(presales_id: str, request: Request):
    """Upload files to pre-sales lead"""
    user = await get_current_user(request)
    
    presales_lead = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    # Permission check
    if user.role == "PreSales":
        if presales_lead.get("assigned_to") != user.user_id and presales_lead.get("created_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # For now, create placeholder file entries
    # In production, integrate with file storage service
    form = await request.form()
    files = form.getlist("files")
    
    new_files = []
    for file in files:
        file_entry = {
            "id": f"file_{uuid.uuid4().hex[:8]}",
            "name": file.filename,
            "size": 0,  # Would get from actual file
            "type": file.content_type,
            "uploaded_by": user.user_id,
            "uploaded_by_name": user.name,
            "url": f"/files/{presales_id}/{file.filename}",  # Placeholder URL
            "created_at": now.isoformat()
        }
        new_files.append(file_entry)
    
    if new_files:
        await db.leads.update_one(
            {"lead_id": presales_id},
            {
                "$push": {"files": {"$each": new_files}},
                "$set": {"updated_at": now.isoformat()}
            }
        )
        
        # Add system comment
        system_comment = {
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": f"{user.name} uploaded {len(new_files)} file(s)",
            "is_system": True,
            "created_at": now.isoformat()
        }
        await db.leads.update_one(
            {"lead_id": presales_id},
            {"$push": {"comments": system_comment}}
        )
    
    return {"success": True, "files": new_files}

@api_router.delete("/presales/{presales_id}/files/{file_id}")
async def delete_presales_file(presales_id: str, file_id: str, request: Request):
    """Delete file from pre-sales lead"""
    user = await get_current_user(request)
    
    presales_lead = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    # Permission check
    if user.role == "PreSales":
        if presales_lead.get("assigned_to") != user.user_id and presales_lead.get("created_by") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ["Admin", "SalesManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    await db.leads.update_one(
        {"lead_id": presales_id},
        {
            "$pull": {"files": {"id": file_id}},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {"success": True}

@api_router.post("/presales/{presales_id}/convert-to-lead")
async def convert_presales_to_lead(presales_id: str, request: Request):
    """Convert qualified pre-sales lead to regular lead with PID generation"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "SalesManager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    presales_lead = await db.leads.find_one({"lead_id": presales_id}, {"_id": 0})
    if not presales_lead:
        raise HTTPException(status_code=404, detail="Pre-sales lead not found")
    
    if presales_lead.get("status") != "Qualified":
        raise HTTPException(status_code=400, detail="Only qualified leads can be converted")
    
    if presales_lead.get("is_converted"):
        raise HTTPException(status_code=400, detail="Already converted to lead")
    
    now = datetime.now(timezone.utc)
    
    # Generate PID - this is the permanent project identifier
    pid = await generate_pid()
    
    # Prepare collaborator entry for the PreSales user
    presales_collaborator = {
        "user_id": presales_lead.get("created_by") or presales_lead.get("assigned_to"),
        "role": "PreSales",
        "added_at": now.isoformat(),
        "added_by": "system",
        "reason": "Original Pre-Sales creator",
        "can_edit": False  # View-only collaborator
    }
    
    # System comment for conversion
    conversion_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Converted from Pre-Sales to Lead. PID assigned: {pid}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    # Get existing collaborators or initialize empty list
    existing_collaborators = presales_lead.get("collaborators", [])
    if not isinstance(existing_collaborators, list):
        existing_collaborators = []
    
    # Mark as converted, assign PID, change lead_type, and update stage to BC Call Done (first sales stage)
    await db.leads.update_one(
        {"lead_id": presales_id},
        {
            "$set": {
                "lead_type": "lead",  # Change from presales to lead
                "is_converted": False,  # Reset - it's now a proper lead, not converted to project yet
                "pid": pid,  # Assign PID at conversion
                "stage": "BC Call Done",  # Move to sales stages
                "status": "In Progress",  # Lead status
                "updated_at": now.isoformat(),
                "converted_from_presales": True,  # Mark that it came from presales
                "presales_converted_at": now.isoformat(),
                "collaborators": existing_collaborators + [presales_collaborator]
            },
            "$push": {
                "comments": conversion_comment
            }
        }
    )
    
    return {"success": True, "lead_id": presales_id, "pid": pid}

@api_router.get("/reports/designers")
async def get_designers_report(request: Request):
    """Designer Performance Report - Designer sees own, Admin/Manager sees all"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "Designer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Get all designers
    designers_query = {"role": "Designer"}
    if user.role == "Designer":
        designers_query["user_id"] = user.user_id
    
    designers = await db.users.find(designers_query, {"_id": 0}).to_list(100)
    
    # Get all projects
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    # Get all tasks
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(1000)
    
    # Get all meetings
    meetings = await db.meetings.find({}, {"_id": 0}).to_list(1000)
    
    designer_performance = []
    
    for designer in designers:
        designer_id = designer.get("user_id")
        designer_name = designer.get("name")
        
        # Filter projects for this designer
        designer_projects = [p for p in projects if designer_id in p.get("collaborators", [])]
        
        project_count = len(designer_projects)
        total_value = sum(p.get("project_value", 0) for p in designer_projects)
        
        # Milestone analysis
        on_time_milestones = 0
        delayed_milestones = 0
        total_delay_days = 0
        
        for project in designer_projects:
            timeline = project.get("timeline", [])
            for item in timeline:
                status = item.get("status", "pending")
                if status == "completed":
                    on_time_milestones += 1
                elif status == "delayed":
                    delayed_milestones += 1
                    expected = item.get("expectedDate")
                    completed = item.get("completedDate")
                    if expected and completed:
                        try:
                            exp_dt = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                            comp_dt = datetime.fromisoformat(completed.replace("Z", "+00:00"))
                            if exp_dt.tzinfo is None:
                                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                            if comp_dt.tzinfo is None:
                                comp_dt = comp_dt.replace(tzinfo=timezone.utc)
                            total_delay_days += max(0, (comp_dt - exp_dt).days)
                        except Exception:
                            pass
        
        # Tasks completed
        designer_tasks = [t for t in tasks if t.get("assigned_to") == designer_id]
        tasks_completed = len([t for t in designer_tasks if t.get("status") == "Completed"])
        tasks_total = len(designer_tasks)
        
        # Meetings completed
        designer_meetings = [m for m in meetings if m.get("scheduled_for") == designer_id]
        meetings_completed = len([m for m in designer_meetings if m.get("status") == "Completed"])
        meetings_total = len(designer_meetings)
        
        # Revenue contribution (collected payments from designer's projects)
        revenue_contribution = 0
        for project in designer_projects:
            payments = project.get("payments", [])
            revenue_contribution += sum(p.get("amount", 0) for p in payments)
        
        # Average delay per project
        avg_delay = round(total_delay_days / project_count, 1) if project_count > 0 else 0
        
        designer_performance.append({
            "user_id": designer_id,
            "name": designer_name,
            "picture": designer.get("picture"),
            "project_count": project_count,
            "total_value": total_value,
            "on_time_milestones": on_time_milestones,
            "delayed_milestones": delayed_milestones,
            "tasks_completed": tasks_completed,
            "tasks_total": tasks_total,
            "meetings_completed": meetings_completed,
            "meetings_total": meetings_total,
            "revenue_contribution": revenue_contribution,
            "avg_delay_days": avg_delay
        })
    
    # Sort by revenue contribution
    designer_performance.sort(key=lambda x: x["revenue_contribution"], reverse=True)
    
    # Summary metrics
    total_projects = sum(d["project_count"] for d in designer_performance)
    total_revenue = sum(d["revenue_contribution"] for d in designer_performance)
    total_on_time = sum(d["on_time_milestones"] for d in designer_performance)
    total_delayed = sum(d["delayed_milestones"] for d in designer_performance)
    
    return {
        "designers": designer_performance,
        "summary": {
            "total_designers": len(designer_performance),
            "total_projects": total_projects,
            "total_revenue": total_revenue,
            "total_on_time_milestones": total_on_time,
            "total_delayed_milestones": total_delayed,
            "on_time_percentage": round((total_on_time / (total_on_time + total_delayed)) * 100, 1) if (total_on_time + total_delayed) > 0 else 100
        }
    }

@api_router.get("/reports/delays")
async def get_delays_report(request: Request):
    """Delay Analytics Report - Admin/Manager only"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Get all projects
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    # Get all designers
    designers = await db.users.find({"role": "Designer"}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)
    designers_map = {d["user_id"]: d.get("name", "Unknown") for d in designers}
    
    # Metrics
    stage_delays = {}
    designer_delays = {}
    monthly_delays = {}
    delay_reasons = {}
    projects_with_delays = []
    
    for project in projects:
        timeline = project.get("timeline", [])
        collaborators = project.get("collaborators", [])
        comments = project.get("comments", [])
        
        # Get designer
        designer_id = None
        designer_name = None
        for collab_id in collaborators:
            if collab_id in designers_map:
                designer_id = collab_id
                designer_name = designers_map[collab_id]
                break
        
        project_delay_count = 0
        project_total_delay_days = 0
        
        for item in timeline:
            status = item.get("status", "pending")
            stage_ref = item.get("stage_ref") or item.get("title", "Unknown")
            
            if status == "delayed":
                project_delay_count += 1
                
                # Stage delays
                if stage_ref not in stage_delays:
                    stage_delays[stage_ref] = {"count": 0, "total_days": 0}
                stage_delays[stage_ref]["count"] += 1
                
                # Calculate delay days
                expected = item.get("expectedDate")
                completed = item.get("completedDate")
                delay_days = 0
                
                if expected:
                    try:
                        exp_dt = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                        if exp_dt.tzinfo is None:
                            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                        
                        if completed:
                            comp_dt = datetime.fromisoformat(completed.replace("Z", "+00:00"))
                            if comp_dt.tzinfo is None:
                                comp_dt = comp_dt.replace(tzinfo=timezone.utc)
                            delay_days = max(0, (comp_dt - exp_dt).days)
                        else:
                            delay_days = max(0, (now - exp_dt).days)
                        
                        stage_delays[stage_ref]["total_days"] += delay_days
                        project_total_delay_days += delay_days
                        
                        # Monthly tracking
                        month_key = exp_dt.strftime("%Y-%m")
                        if month_key not in monthly_delays:
                            monthly_delays[month_key] = {"count": 0, "total_days": 0}
                        monthly_delays[month_key]["count"] += 1
                        monthly_delays[month_key]["total_days"] += delay_days
                    except Exception:
                        pass
                
                # Designer delays
                if designer_id:
                    if designer_id not in designer_delays:
                        designer_delays[designer_id] = {"name": designer_name, "count": 0, "total_days": 0}
                    designer_delays[designer_id]["count"] += 1
                    designer_delays[designer_id]["total_days"] += delay_days
        
        # Look for delay reasons in comments
        for comment in comments:
            content = comment.get("content", "").lower()
            if "#delay" in content or "delay" in content:
                # Extract reason (simplified)
                reason = "Unspecified"
                if "material" in content:
                    reason = "Material Delay"
                elif "client" in content:
                    reason = "Client Decision"
                elif "vendor" in content:
                    reason = "Vendor Issue"
                elif "design" in content:
                    reason = "Design Changes"
                elif "approval" in content:
                    reason = "Approval Pending"
                
                if reason not in delay_reasons:
                    delay_reasons[reason] = 0
                delay_reasons[reason] += 1
        
        if project_delay_count > 0:
            projects_with_delays.append({
                "project_id": project.get("project_id"),
                "project_name": project.get("project_name"),
                "designer": designer_name,
                "delay_count": project_delay_count,
                "total_delay_days": project_total_delay_days,
                "avg_delay": round(project_total_delay_days / project_delay_count, 1) if project_delay_count > 0 else 0
            })
    
    # Calculate averages for stages
    stage_analysis = []
    for stage, data in stage_delays.items():
        avg_delay = round(data["total_days"] / data["count"], 1) if data["count"] > 0 else 0
        stage_analysis.append({
            "stage": stage,
            "delay_count": data["count"],
            "total_delay_days": data["total_days"],
            "avg_delay_days": avg_delay
        })
    
    stage_analysis.sort(key=lambda x: x["delay_count"], reverse=True)
    
    # Designer analysis
    designer_analysis = []
    total_delays_all = sum(d["count"] for d in designer_delays.values())
    
    for designer_id, data in designer_delays.items():
        delay_percentage = round((data["count"] / total_delays_all) * 100, 1) if total_delays_all > 0 else 0
        designer_analysis.append({
            "designer_id": designer_id,
            "name": data["name"],
            "delay_count": data["count"],
            "total_delay_days": data["total_days"],
            "delay_percentage": delay_percentage
        })
    
    designer_analysis.sort(key=lambda x: x["delay_count"], reverse=True)
    
    # Monthly trend
    monthly_trend = []
    for month, data in sorted(monthly_delays.items()):
        monthly_trend.append({
            "month": month,
            "delay_count": data["count"],
            "avg_delay_days": round(data["total_days"] / data["count"], 1) if data["count"] > 0 else 0
        })
    
    # Sort projects by delay
    projects_with_delays.sort(key=lambda x: x["total_delay_days"], reverse=True)
    
    return {
        "total_delays": sum(d["count"] for d in stage_delays.values()),
        "projects_with_delays": len(projects_with_delays),
        "stage_analysis": stage_analysis,
        "designer_analysis": designer_analysis,
        "monthly_trend": monthly_trend[-12:],  # Last 12 months
        "delay_reasons": delay_reasons,
        "top_delayed_projects": projects_with_delays[:10]
    }


# ============ DESIGN WORKFLOW SYSTEM - MODELS ============

class DesignProjectCreate(BaseModel):
    project_id: str  # Link to main project
    designer_id: str
    is_referral: bool = False
    referral_source: Optional[str] = None

class DesignStageUpdate(BaseModel):
    stage: str
    notes: Optional[str] = None

class DesignTaskUpdate(BaseModel):
    status: str  # Pending, In Progress, Completed
    notes: Optional[str] = None

class MeasurementRequest(BaseModel):
    project_id: str
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class DesignMeetingCreate(BaseModel):
    project_id: str
    meeting_type: str  # floor_plan, presentation, review, material, kickoff
    date: str
    start_time: str
    end_time: str
    notes: Optional[str] = None
    generate_meet_link: bool = True

class ValidationRequest(BaseModel):
    status: str  # approved, rejected, needs_revision
    notes: Optional[str] = None

# ============ DESIGN WORKFLOW HELPER FUNCTIONS ============

async def create_design_auto_tasks(design_project_id: str, stage: str, designer_id: str):
    """Auto-create tasks when design stage changes"""
    stage_config = DESIGN_STAGE_CONFIG.get(stage)
    if not stage_config:
        return []
    
    created_tasks = []
    auto_tasks = stage_config.get("auto_tasks", [])
    now = datetime.now(timezone.utc)
    
    cumulative_days = 0
    for task_title in auto_tasks:
        template = DESIGN_TASK_TEMPLATES.get(task_title, {})
        duration = template.get("duration_days", 1)
        cumulative_days += duration
        
        # Determine assignee based on template
        assigned_role = template.get("assigned_to_role", "Designer")
        assigned_to = designer_id
        
        if assigned_role == "DesignManager":
            # Find a design manager
            manager = await db.users.find_one(
                {"role": "DesignManager", "status": "Active"},
                {"_id": 0, "user_id": 1}
            )
            if manager:
                assigned_to = manager["user_id"]
        elif assigned_role == "ProductionManager":
            # Find production manager
            pm = await db.users.find_one(
                {"role": "ProductionManager", "status": "Active"},
                {"_id": 0, "user_id": 1}
            )
            if pm:
                assigned_to = pm["user_id"]
        
        task = {
            "id": f"dtask_{uuid.uuid4().hex[:8]}",
            "design_project_id": design_project_id,
            "title": task_title,
            "description": template.get("description", ""),
            "priority": template.get("priority", "Medium"),
            "status": "Pending",
            "stage": stage,
            "assigned_to": assigned_to,
            "due_date": (now + timedelta(days=cumulative_days)).isoformat(),
            "creates_meeting": template.get("creates_meeting", False),
            "auto_generated": True,
            "started_at": None,
            "completed_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.design_tasks.insert_one(task)
        created_tasks.append(task)
    
    return created_tasks

async def create_design_notification(user_ids: list, title: str, message: str, link_url: str = None, notif_type: str = "design"):
    """Create in-app notifications for design workflow"""
    now = datetime.now(timezone.utc).isoformat()
    
    for user_id in user_ids:
        notification = {
            "id": f"notif_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notif_type,
            "link_url": link_url,
            "is_read": False,
            "created_at": now
        }
        await db.notifications.insert_one(notification)

async def notify_design_managers(design_project_id: str, message: str, link_url: str = None):
    """Notify all design managers about a design project event"""
    managers = await db.users.find(
        {"role": "DesignManager", "status": "Active"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    user_ids = [m["user_id"] for m in managers]
    if user_ids:
        await create_design_notification(
            user_ids, 
            "Design Project Update", 
            message,
            link_url,
            "design"
        )

async def notify_production_managers(design_project_id: str, message: str, link_url: str = None):
    """Notify production managers about validation/handoff events"""
    managers = await db.users.find(
        {"role": "ProductionManager", "status": "Active"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    user_ids = [m["user_id"] for m in managers]
    if user_ids:
        await create_design_notification(
            user_ids,
            "Production Pipeline Update",
            message,
            link_url,
            "production"
        )

async def check_and_notify_delays(design_project_id: str):
    """Check for delayed tasks and notify managers"""
    now = datetime.now(timezone.utc)
    
    # Find overdue tasks
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        return
    
    overdue_tasks = await db.design_tasks.find({
        "design_project_id": design_project_id,
        "status": {"$ne": "Completed"},
        "due_date": {"$lt": now.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    if overdue_tasks:
        project = await db.projects.find_one(
            {"project_id": design_project.get("project_id")},
            {"_id": 0, "project_name": 1}
        )
        project_name = project.get("project_name", "Unknown") if project else "Unknown"
        
        await notify_design_managers(
            design_project_id,
            f"Project '{project_name}' has {len(overdue_tasks)} overdue task(s)",
            f"/design-board/{design_project_id}"
        )

def generate_meet_link():
    """Generate a placeholder Google Meet link"""
    meeting_id = uuid.uuid4().hex[:12]
    # Placeholder format - in future can integrate with real Google Meet API
    return f"https://meet.google.com/{meeting_id[:3]}-{meeting_id[3:7]}-{meeting_id[7:11]}"

# ============ DESIGN WORKFLOW ENDPOINTS ============

@api_router.post("/design-projects")
async def create_design_project(data: DesignProjectCreate, request: Request):
    """Initialize design workflow for a project after booking"""
    user = await get_current_user(request)
    
    # Check permissions
    if user.role not in ["Admin", "Manager", "DesignManager", "HybridDesigner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if project exists
    project = await db.projects.find_one(
        {"project_id": data.project_id},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if design project already exists
    existing = await db.design_projects.find_one(
        {"project_id": data.project_id},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Design workflow already initialized for this project")
    
    now = datetime.now(timezone.utc)
    
    # Create design project
    design_project = {
        "id": f"dp_{uuid.uuid4().hex[:8]}",
        "project_id": data.project_id,
        "designer_id": data.designer_id,
        "current_stage": DESIGN_WORKFLOW_STAGES[0],  # Start at "Measurement Required"
        "stage_history": [{
            "stage": DESIGN_WORKFLOW_STAGES[0],
            "entered_at": now.isoformat(),
            "completed_at": None,
            "notes": "Design workflow initialized"
        }],
        "is_referral": data.is_referral,
        "referral_source": data.referral_source,
        "status": "active",  # active, paused, completed
        "files": [],  # Design files per stage
        "meetings": [],  # Meeting history
        "created_by": user.user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.design_projects.insert_one(design_project)
    
    # Auto-create tasks for first stage
    await create_design_auto_tasks(
        design_project["id"],
        DESIGN_WORKFLOW_STAGES[0],
        data.designer_id
    )
    
    # Notify design manager
    await notify_design_managers(
        design_project["id"],
        f"New design project started: {project.get('project_name', 'Unknown')}",
        f"/design-board/{design_project['id']}"
    )
    
    # If referral, also notify for special handling
    if data.is_referral:
        await notify_design_managers(
            design_project["id"],
            f"Referral project requires attention: {project.get('project_name', 'Unknown')} from {data.referral_source}",
            f"/design-board/{design_project['id']}"
        )
    
    return {**design_project, "_id": None}

@api_router.get("/design-projects")
async def list_design_projects(
    request: Request,
    status: Optional[str] = None,
    designer_id: Optional[str] = None,
    is_referral: Optional[bool] = None
):
    """List design projects with role-based access"""
    user = await get_current_user(request)
    
    query = {}
    
    # Role-based filtering
    if user.role in ["Designer", "HybridDesigner"]:
        # See only their own projects
        query["designer_id"] = user.user_id
    elif user.role == "ProductionManager":
        # See only projects in validation/kickoff stage
        query["current_stage"] = "Validation & Kickoff"
    # Admin, Manager, DesignManager see all
    
    if status and status != "all":
        query["status"] = status
    
    if designer_id and user.role in ["Admin", "Manager", "DesignManager"]:
        query["designer_id"] = designer_id
    
    if is_referral is not None:
        query["is_referral"] = is_referral
    
    design_projects = await db.design_projects.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with project details
    for dp in design_projects:
        project = await db.projects.find_one(
            {"project_id": dp.get("project_id")},
            {"_id": 0, "project_name": 1, "client_name": 1, "client_phone": 1}
        )
        dp["project"] = project
        
        # Get designer details
        designer = await db.users.find_one(
            {"user_id": dp.get("designer_id")},
            {"_id": 0, "name": 1, "picture": 1}
        )
        dp["designer"] = designer
        
        # Get task counts
        total_tasks = await db.design_tasks.count_documents({"design_project_id": dp["id"]})
        completed_tasks = await db.design_tasks.count_documents({
            "design_project_id": dp["id"],
            "status": "Completed"
        })
        dp["tasks_total"] = total_tasks
        dp["tasks_completed"] = completed_tasks
        
        # Check for delays
        now = datetime.now(timezone.utc)
        overdue_tasks = await db.design_tasks.count_documents({
            "design_project_id": dp["id"],
            "status": {"$ne": "Completed"},
            "due_date": {"$lt": now.isoformat()}
        })
        dp["has_delays"] = overdue_tasks > 0
        dp["overdue_count"] = overdue_tasks
    
    return design_projects

@api_router.get("/design-projects/{design_project_id}")
async def get_design_project(design_project_id: str, request: Request):
    """Get design project details"""
    user = await get_current_user(request)
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    # Check access
    if user.role in ["Designer", "HybridDesigner"]:
        if design_project.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich with project details
    project = await db.projects.find_one(
        {"project_id": design_project.get("project_id")},
        {"_id": 0}
    )
    design_project["project"] = project
    
    # Get designer details  
    designer = await db.users.find_one(
        {"user_id": design_project.get("designer_id")},
        {"_id": 0, "name": 1, "picture": 1, "email": 1}
    )
    design_project["designer"] = designer
    
    # Get all tasks for this design project
    tasks = await db.design_tasks.find(
        {"design_project_id": design_project_id},
        {"_id": 0}
    ).to_list(100)
    design_project["tasks"] = tasks
    
    # Get meetings for this design project
    meetings = await db.design_meetings.find(
        {"design_project_id": design_project_id},
        {"_id": 0}
    ).to_list(100)
    design_project["meetings"] = meetings
    
    return design_project

@api_router.put("/design-projects/{design_project_id}/stage")
async def update_design_stage(
    design_project_id: str,
    stage_update: DesignStageUpdate,
    request: Request
):
    """Move design project to next stage - triggers auto-task creation"""
    user = await get_current_user(request)
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    # Check permissions
    if user.role in ["Designer", "HybridDesigner"]:
        if design_project.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ["Admin", "Manager", "DesignManager", "ProductionManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    new_stage = stage_update.stage
    if new_stage not in DESIGN_WORKFLOW_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {DESIGN_WORKFLOW_STAGES}")
    
    old_stage = design_project.get("current_stage")
    now = datetime.now(timezone.utc)
    
    # Update stage history
    stage_history = design_project.get("stage_history", [])
    
    # Mark previous stage as completed
    if stage_history:
        stage_history[-1]["completed_at"] = now.isoformat()
    
    # Add new stage entry
    stage_history.append({
        "stage": new_stage,
        "entered_at": now.isoformat(),
        "completed_at": None,
        "notes": stage_update.notes or f"Moved from {old_stage}"
    })
    
    # Update design project
    await db.design_projects.update_one(
        {"id": design_project_id},
        {"$set": {
            "current_stage": new_stage,
            "stage_history": stage_history,
            "updated_at": now.isoformat()
        }}
    )
    
    # Auto-create tasks for new stage
    await create_design_auto_tasks(
        design_project_id,
        new_stage,
        design_project.get("designer_id")
    )
    
    # Get project name for notifications
    project = await db.projects.find_one(
        {"project_id": design_project.get("project_id")},
        {"_id": 0, "project_name": 1}
    )
    project_name = project.get("project_name", "Unknown") if project else "Unknown"
    
    # Notify based on stage
    stage_config = DESIGN_STAGE_CONFIG.get(new_stage, {})
    notify_roles = stage_config.get("notify_roles", [])
    
    if "DesignManager" in notify_roles:
        await notify_design_managers(
            design_project_id,
            f"Project '{project_name}' moved to {new_stage}",
            f"/design-board/{design_project_id}"
        )
    
    if "ProductionManager" in notify_roles:
        await notify_production_managers(
            design_project_id,
            f"Project '{project_name}' ready for {new_stage}",
            f"/validation/{design_project_id}"
        )
    
    # Add system comment to main project
    comment = {
        "id": f"cm_{uuid.uuid4().hex[:8]}",
        "user_id": "system",
        "user_name": "System",
        "role": "System",
        "message": f"Design workflow moved from '{old_stage}' to '{new_stage}'" + (f" - {stage_update.notes}" if stage_update.notes else ""),
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": design_project.get("project_id")},
        {"$push": {"comments": comment}}
    )
    
    return {"message": "Stage updated", "new_stage": new_stage}

@api_router.get("/design-tasks")
async def list_design_tasks(
    request: Request,
    design_project_id: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None
):
    """List design tasks for Kanban board"""
    user = await get_current_user(request)
    
    query = {}
    
    # Role-based filtering
    if user.role in ["Designer", "HybridDesigner"]:
        query["assigned_to"] = user.user_id
    elif user.role == "ProductionManager":
        # See only validation-related tasks
        query["stage"] = "Validation & Kickoff"
    
    if design_project_id:
        query["design_project_id"] = design_project_id
    
    if status and status != "all":
        query["status"] = status
    
    if assigned_to and user.role in ["Admin", "Manager", "DesignManager"]:
        query["assigned_to"] = assigned_to
    
    tasks = await db.design_tasks.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with assignee details
    for task in tasks:
        assignee = await db.users.find_one(
            {"user_id": task.get("assigned_to")},
            {"_id": 0, "name": 1, "picture": 1}
        )
        task["assignee"] = assignee
        
        # Get design project details
        dp = await db.design_projects.find_one(
            {"id": task.get("design_project_id")},
            {"_id": 0, "project_id": 1}
        )
        if dp:
            project = await db.projects.find_one(
                {"project_id": dp.get("project_id")},
                {"_id": 0, "project_name": 1, "client_name": 1}
            )
            task["project"] = project
        
        # Check if overdue
        if task.get("due_date") and task.get("status") != "Completed":
            due = datetime.fromisoformat(task["due_date"].replace("Z", "+00:00"))
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            task["is_overdue"] = due < datetime.now(timezone.utc)
        else:
            task["is_overdue"] = False
    
    return tasks

@api_router.put("/design-tasks/{task_id}")
async def update_design_task(task_id: str, update: DesignTaskUpdate, request: Request):
    """Update design task status (1-click complete)"""
    user = await get_current_user(request)
    
    task = await db.design_tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permissions
    if user.role in ["Designer", "HybridDesigner"]:
        if task.get("assigned_to") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    update_data = {"updated_at": now.isoformat()}
    
    if update.status:
        update_data["status"] = update.status
        
        if update.status == "In Progress" and not task.get("started_at"):
            update_data["started_at"] = now.isoformat()
        
        if update.status == "Completed":
            update_data["completed_at"] = now.isoformat()
    
    if update.notes:
        update_data["notes"] = update.notes
    
    await db.design_tasks.update_one(
        {"id": task_id},
        {"$set": update_data}
    )
    
    # Check if all tasks in current stage are complete
    design_project = await db.design_projects.find_one(
        {"id": task.get("design_project_id")},
        {"_id": 0}
    )
    
    if design_project and update.status == "Completed":
        current_stage = design_project.get("current_stage")
        pending_tasks = await db.design_tasks.count_documents({
            "design_project_id": task.get("design_project_id"),
            "stage": current_stage,
            "status": {"$ne": "Completed"}
        })
        
        # If all tasks complete and task was just completed, check for auto-advance
        if pending_tasks == 0:
            project = await db.projects.find_one(
                {"project_id": design_project.get("project_id")},
                {"_id": 0, "project_name": 1}
            )
            project_name = project.get("project_name", "Unknown") if project else "Unknown"
            
            await notify_design_managers(
                design_project["id"],
                f"All tasks complete for '{project_name}' in stage '{current_stage}'. Ready to move forward.",
                f"/design-board/{design_project['id']}"
            )
    
    return {"message": "Task updated", "id": task_id}

@api_router.post("/design-projects/{design_project_id}/measurement-request")
async def create_measurement_request(design_project_id: str, data: MeasurementRequest, request: Request):
    """Create measurement request - auto-creates task and notifies team"""
    user = await get_current_user(request)
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    # Check permissions
    if user.role not in ["Admin", "Manager", "DesignManager", "Designer", "HybridDesigner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Create measurement request record
    measurement_request = {
        "id": f"mreq_{uuid.uuid4().hex[:8]}",
        "design_project_id": design_project_id,
        "project_id": design_project.get("project_id"),
        "requested_by": user.user_id,
        "assigned_to": data.assigned_to or design_project.get("designer_id"),
        "notes": data.notes,
        "status": "pending",  # pending, in_progress, completed
        "files": [],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.measurement_requests.insert_one(measurement_request)
    
    # Create associated task
    task = {
        "id": f"dtask_{uuid.uuid4().hex[:8]}",
        "design_project_id": design_project_id,
        "title": "Complete Site Measurement",
        "description": f"Site measurement requested. {data.notes or ''}".strip(),
        "priority": "High",
        "status": "Pending",
        "stage": "Measurement Required",
        "assigned_to": data.assigned_to or design_project.get("designer_id"),
        "due_date": (now + timedelta(days=2)).isoformat(),
        "measurement_request_id": measurement_request["id"],
        "auto_generated": True,
        "started_at": None,
        "completed_at": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.design_tasks.insert_one(task)
    
    # Notify assigned person
    await create_design_notification(
        [data.assigned_to or design_project.get("designer_id")],
        "Measurement Request",
        "Site measurement has been requested",
        f"/design-board/{design_project_id}"
    )
    
    return {"message": "Measurement request created", "request": measurement_request}

@api_router.post("/design-projects/{design_project_id}/upload")
async def upload_design_file(design_project_id: str, request: Request):
    """Upload design file with auto-stage completion check"""
    user = await get_current_user(request)
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    # Check permissions
    if user.role in ["Designer", "HybridDesigner"]:
        if design_project.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    body = await request.json()
    file_name = body.get("file_name")
    file_url = body.get("file_url")
    file_type = body.get("file_type", "other")  # measurement, floor_plan, design, production_drawing, etc.
    stage = body.get("stage") or design_project.get("current_stage")
    
    now = datetime.now(timezone.utc)
    
    file_record = {
        "id": f"dfile_{uuid.uuid4().hex[:8]}",
        "file_name": file_name,
        "file_url": file_url,
        "file_type": file_type,
        "stage": stage,
        "uploaded_by": user.user_id,
        "uploaded_by_name": user.name,
        "uploaded_at": now.isoformat()
    }
    
    # Add file to design project
    await db.design_projects.update_one(
        {"id": design_project_id},
        {
            "$push": {"files": file_record},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    # Check if this completes a measurement request
    if file_type == "measurement":
        await db.measurement_requests.update_one(
            {"design_project_id": design_project_id, "status": "pending"},
            {"$set": {"status": "completed", "updated_at": now.isoformat()}, "$push": {"files": file_record}}
        )
        
        # Mark measurement tasks as complete
        await db.design_tasks.update_many(
            {
                "design_project_id": design_project_id,
                "title": {"$regex": "measurement", "$options": "i"},
                "status": {"$ne": "Completed"}
            },
            {"$set": {"status": "Completed", "completed_at": now.isoformat()}}
        )
    
    # Check required uploads for stage completion
    stage_config = DESIGN_STAGE_CONFIG.get(stage, {})
    required_uploads = stage_config.get("required_uploads", [])
    
    if file_type in required_uploads:
        # Get all files for this stage
        updated_dp = await db.design_projects.find_one(
            {"id": design_project_id},
            {"_id": 0, "files": 1}
        )
        
        stage_files = [f for f in updated_dp.get("files", []) if f.get("stage") == stage]
        stage_file_types = [f.get("file_type") for f in stage_files]
        
        # Check if all required uploads are present
        all_uploaded = all(req in stage_file_types for req in required_uploads)
        
        if all_uploaded:
            project = await db.projects.find_one(
                {"project_id": design_project.get("project_id")},
                {"_id": 0, "project_name": 1}
            )
            project_name = project.get("project_name", "Unknown") if project else "Unknown"
            
            await notify_design_managers(
                design_project_id,
                f"All required files uploaded for '{project_name}' in stage '{stage}'",
                f"/design-board/{design_project_id}"
            )
    
    return {"message": "File uploaded", "file": file_record}

@api_router.post("/design-projects/{design_project_id}/meeting")
async def schedule_design_meeting(design_project_id: str, data: DesignMeetingCreate, request: Request):
    """Schedule design meeting with auto-generated Meet link"""
    user = await get_current_user(request)
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    # Check permissions
    if user.role in ["Designer", "HybridDesigner"]:
        if design_project.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Generate meet link if requested
    meet_link = generate_meet_link() if data.generate_meet_link else None
    
    meeting = {
        "id": f"dmeet_{uuid.uuid4().hex[:8]}",
        "design_project_id": design_project_id,
        "project_id": design_project.get("project_id"),
        "meeting_type": data.meeting_type,
        "title": f"{data.meeting_type.replace('_', ' ').title()} Meeting",
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "meet_link": meet_link,
        "notes": data.notes,
        "status": "scheduled",  # scheduled, completed, cancelled
        "scheduled_by": user.user_id,
        "scheduled_by_name": user.name,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.design_meetings.insert_one(meeting)
    
    # Add to design project meetings list
    await db.design_projects.update_one(
        {"id": design_project_id},
        {
            "$push": {"meetings": meeting["id"]},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    # Mark meeting scheduling tasks as complete
    await db.design_tasks.update_many(
        {
            "design_project_id": design_project_id,
            "title": {"$regex": "schedule.*meeting", "$options": "i"},
            "status": {"$ne": "Completed"}
        },
        {"$set": {"status": "Completed", "completed_at": now.isoformat()}}
    )
    
    # Also add to main meetings collection for calendar integration
    main_meeting = {
        "id": meeting["id"],
        "title": meeting["title"],
        "description": f"Design meeting for project. {data.notes or ''}".strip(),
        "project_id": design_project.get("project_id"),
        "lead_id": None,
        "scheduled_by": user.user_id,
        "scheduled_for": design_project.get("designer_id"),
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "location": meet_link or "To be determined",
        "status": "Scheduled",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.meetings.insert_one(main_meeting)
    
    # Notify designer
    await create_design_notification(
        [design_project.get("designer_id")],
        "Meeting Scheduled",
        f"{meeting['title']} scheduled for {data.date} at {data.start_time}",
        f"/design-board/{design_project_id}"
    )
    
    return {"message": "Meeting scheduled", "meeting": meeting}

@api_router.put("/design-meetings/{meeting_id}/complete")
async def complete_design_meeting(meeting_id: str, request: Request):
    """Mark design meeting as complete - 1-click action"""
    await get_current_user(request)  # Auth check
    
    meeting = await db.design_meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    now = datetime.now(timezone.utc)
    
    await db.design_meetings.update_one(
        {"id": meeting_id},
        {"$set": {"status": "completed", "completed_at": now.isoformat(), "updated_at": now.isoformat()}}
    )
    
    # Also update main meetings collection
    await db.meetings.update_one(
        {"id": meeting_id},
        {"$set": {"status": "Completed", "updated_at": now.isoformat()}}
    )
    
    # Mark meeting-related tasks as complete
    await db.design_tasks.update_many(
        {
            "design_project_id": meeting.get("design_project_id"),
            "title": {"$regex": "conduct.*meeting|meeting", "$options": "i"},
            "status": {"$ne": "Completed"}
        },
        {"$set": {"status": "Completed", "completed_at": now.isoformat()}}
    )
    
    # Check if stage requires meeting completion for advancement
    design_project = await db.design_projects.find_one(
        {"id": meeting.get("design_project_id")},
        {"_id": 0}
    )
    
    if design_project:
        current_stage = design_project.get("current_stage")
        stage_config = DESIGN_STAGE_CONFIG.get(current_stage, {})
        
        if stage_config.get("next_stage_trigger") == "meeting_complete":
            project = await db.projects.find_one(
                {"project_id": design_project.get("project_id")},
                {"_id": 0, "project_name": 1}
            )
            project_name = project.get("project_name", "Unknown") if project else "Unknown"
            
            await notify_design_managers(
                meeting.get("design_project_id"),
                f"Meeting completed for '{project_name}'. Stage '{current_stage}' ready to advance.",
                f"/design-board/{meeting.get('design_project_id')}"
            )
    
    return {"message": "Meeting marked as complete"}

# ============ VALIDATION PIPELINE (Sharon) ============

@api_router.get("/validation-pipeline")
async def get_validation_pipeline(request: Request):
    """Get validation pipeline for Production Manager"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "ProductionManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get design projects in validation stage
    validation_projects = await db.design_projects.find(
        {"current_stage": "Validation & Kickoff", "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with details
    pipeline_items = []
    for dp in validation_projects:
        project = await db.projects.find_one(
            {"project_id": dp.get("project_id")},
            {"_id": 0, "project_name": 1, "client_name": 1}
        )
        
        designer = await db.users.find_one(
            {"user_id": dp.get("designer_id")},
            {"_id": 0, "name": 1, "picture": 1}
        )
        
        # Get files for validation
        files = [f for f in dp.get("files", []) if f.get("file_type") in ["production_drawings", "cutting_list", "sign_off_document"]]
        
        # Get validation tasks
        validation_tasks = await db.design_tasks.find({
            "design_project_id": dp["id"],
            "stage": "Validation & Kickoff"
        }, {"_id": 0}).to_list(20)
        
        pipeline_items.append({
            "design_project": dp,
            "project": project,
            "designer": designer,
            "files": files,
            "tasks": validation_tasks,
            "has_drawings": any(f.get("file_type") == "production_drawings" for f in files),
            "has_sign_off": any(f.get("file_type") == "sign_off_document" for f in files)
        })
    
    # Also get tasks pending validation
    validation_tasks = await db.design_tasks.find({
        "stage": "Validation & Kickoff",
        "status": {"$ne": "Completed"},
        "title": {"$regex": "validate|validation", "$options": "i"}
    }, {"_id": 0}).to_list(100)
    
    return {
        "pipeline": pipeline_items,
        "pending_validation_tasks": validation_tasks,
        "total_pending": len(pipeline_items)
    }

@api_router.post("/validation-pipeline/{design_project_id}/validate")
async def validate_design_project(design_project_id: str, data: ValidationRequest, request: Request):
    """Validate production drawings - 1-click action"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "ProductionManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    now = datetime.now(timezone.utc)
    
    # Create validation record
    validation = {
        "id": f"val_{uuid.uuid4().hex[:8]}",
        "design_project_id": design_project_id,
        "validated_by": user.user_id,
        "validated_by_name": user.name,
        "status": data.status,
        "notes": data.notes,
        "created_at": now.isoformat()
    }
    
    await db.validations.insert_one(validation)
    
    # Update design project
    update_data = {"updated_at": now.isoformat()}
    
    if data.status == "approved":
        # Mark validation tasks as complete
        await db.design_tasks.update_many(
            {
                "design_project_id": design_project_id,
                "title": {"$regex": "validate", "$options": "i"},
                "status": {"$ne": "Completed"}
            },
            {"$set": {"status": "Completed", "completed_at": now.isoformat()}}
        )
        
        # Notify designer
        await create_design_notification(
            [design_project.get("designer_id")],
            "Validation Approved",
            "Production drawings have been approved",
            f"/design-board/{design_project_id}"
        )
    elif data.status == "needs_revision":
        # Notify designer with revision notes
        await create_design_notification(
            [design_project.get("designer_id")],
            "Revision Required",
            f"Production drawings need revision: {data.notes or 'Please check with Production Manager'}",
            f"/design-board/{design_project_id}"
        )
    
    await db.design_projects.update_one(
        {"id": design_project_id},
        {"$set": update_data, "$push": {"validations": validation}}
    )
    
    return {"message": f"Validation {data.status}", "validation": validation}

@api_router.post("/validation-pipeline/{design_project_id}/send-to-production")
async def send_to_production(design_project_id: str, request: Request):
    """Send project to production - final action in design workflow"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "ProductionManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    design_project = await db.design_projects.find_one(
        {"id": design_project_id},
        {"_id": 0}
    )
    
    if not design_project:
        raise HTTPException(status_code=404, detail="Design project not found")
    
    now = datetime.now(timezone.utc)
    
    # Mark design project as completed
    stage_history = design_project.get("stage_history", [])
    if stage_history:
        stage_history[-1]["completed_at"] = now.isoformat()
    
    await db.design_projects.update_one(
        {"id": design_project_id},
        {"$set": {
            "status": "completed",
            "stage_history": stage_history,
            "sent_to_production_at": now.isoformat(),
            "sent_to_production_by": user.user_id,
            "updated_at": now.isoformat()
        }}
    )
    
    # Mark all remaining tasks as complete
    await db.design_tasks.update_many(
        {"design_project_id": design_project_id, "status": {"$ne": "Completed"}},
        {"$set": {"status": "Completed", "completed_at": now.isoformat()}}
    )
    
    # Update main project stage
    await db.projects.update_one(
        {"project_id": design_project.get("project_id")},
        {"$set": {"stage": "Production Preparation", "updated_at": now.isoformat()}}
    )
    
    # Add system comment
    comment = {
        "id": f"cm_{uuid.uuid4().hex[:8]}",
        "user_id": "system",
        "user_name": "System",
        "role": "System",
        "message": f"Design workflow completed. Project sent to production by {user.name}",
        "is_system": True,
        "created_at": now.isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": design_project.get("project_id")},
        {"$push": {"comments": comment}}
    )
    
    # Notify designer
    await create_design_notification(
        [design_project.get("designer_id")],
        "Project Sent to Production",
        "Your design project has been approved and sent to production!",
        f"/projects/{design_project.get('project_id')}"
    )
    
    return {"message": "Project sent to production"}

# ============ DESIGN MANAGER DASHBOARD (Arya) ============

@api_router.get("/design-manager/dashboard")
async def get_design_manager_dashboard(request: Request):
    """Dashboard for Design Manager - overview of all design projects"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "DesignManager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Get all active design projects
    active_projects = await db.design_projects.find(
        {"status": "active"},
        {"_id": 0}
    ).to_list(1000)
    
    # Projects by stage
    projects_by_stage = {}
    for stage in DESIGN_WORKFLOW_STAGES:
        projects_by_stage[stage] = 0
    
    delayed_projects = []
    bottlenecks = {"measurement": 0, "designer": 0, "validation": 0}
    
    for dp in active_projects:
        stage = dp.get("current_stage")
        if stage in projects_by_stage:
            projects_by_stage[stage] += 1
        
        # Check for delays
        overdue_tasks = await db.design_tasks.count_documents({
            "design_project_id": dp["id"],
            "status": {"$ne": "Completed"},
            "due_date": {"$lt": now.isoformat()}
        })
        
        if overdue_tasks > 0:
            project = await db.projects.find_one(
                {"project_id": dp.get("project_id")},
                {"_id": 0, "project_name": 1}
            )
            designer = await db.users.find_one(
                {"user_id": dp.get("designer_id")},
                {"_id": 0, "name": 1}
            )
            
            delayed_projects.append({
                "design_project_id": dp["id"],
                "project_name": project.get("project_name") if project else "Unknown",
                "designer_name": designer.get("name") if designer else "Unknown",
                "stage": stage,
                "overdue_tasks": overdue_tasks
            })
            
            # Categorize bottleneck
            if stage == "Measurement Required":
                bottlenecks["measurement"] += 1
            elif stage == "Validation & Kickoff":
                bottlenecks["validation"] += 1
            else:
                bottlenecks["designer"] += 1
    
    # Get designers with their workload
    designers = await db.users.find(
        {"role": {"$in": ["Designer", "HybridDesigner"]}, "status": "Active"},
        {"_id": 0}
    ).to_list(100)
    
    designer_workload = []
    for designer in designers:
        active_count = await db.design_projects.count_documents({
            "designer_id": designer["user_id"],
            "status": "active"
        })
        
        overdue_count = await db.design_tasks.count_documents({
            "assigned_to": designer["user_id"],
            "status": {"$ne": "Completed"},
            "due_date": {"$lt": now.isoformat()}
        })
        
        designer_workload.append({
            "user_id": designer["user_id"],
            "name": designer["name"],
            "picture": designer.get("picture"),
            "active_projects": active_count,
            "overdue_tasks": overdue_count,
            "is_behind": overdue_count > 0
        })
    
    # Sort by overdue tasks (most behind first)
    designer_workload.sort(key=lambda x: x["overdue_tasks"], reverse=True)
    
    # Get pending meetings
    pending_meetings = await db.design_meetings.count_documents({
        "status": "scheduled",
        "date": {"$lte": (now + timedelta(days=7)).strftime("%Y-%m-%d")}
    })
    
    # Get referral projects
    referral_count = await db.design_projects.count_documents({
        "is_referral": True,
        "status": "active"
    })
    
    # Missing drawings (Production Drawings stage with no drawings uploaded)
    production_drawing_projects = await db.design_projects.find(
        {"current_stage": "Production Drawings Preparation", "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    missing_drawings = 0
    for dp in production_drawing_projects:
        files = dp.get("files", [])
        if not any(f.get("file_type") == "production_drawings" for f in files):
            missing_drawings += 1
    
    return {
        "summary": {
            "total_active_projects": len(active_projects),
            "delayed_count": len(delayed_projects),
            "pending_meetings": pending_meetings,
            "missing_drawings": missing_drawings,
            "referral_projects": referral_count
        },
        "projects_by_stage": projects_by_stage,
        "delayed_projects": delayed_projects[:10],
        "designer_workload": designer_workload,
        "bottlenecks": bottlenecks
    }

# ============ CEO DASHBOARD ============

@api_router.get("/ceo/dashboard")
async def get_ceo_dashboard(request: Request):
    """Private CEO dashboard with performance scores and analytics"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # === Designer Performance Scores ===
    designers = await db.users.find(
        {"role": {"$in": ["Designer", "HybridDesigner"]}, "status": "Active"},
        {"_id": 0}
    ).to_list(100)
    
    designer_scores = []
    for designer in designers:
        designer_id = designer["user_id"]
        
        # Get completed design projects
        completed_projects = await db.design_projects.count_documents({
            "designer_id": designer_id,
            "status": "completed"
        })
        
        # Get on-time completion rate
        total_tasks = await db.design_tasks.count_documents({
            "assigned_to": designer_id,
            "status": "Completed"
        })
        
        late_tasks = await db.design_tasks.count_documents({
            "assigned_to": designer_id,
            "status": "Completed",
            "$expr": {"$gt": ["$completed_at", "$due_date"]}
        })
        
        on_time_rate = ((total_tasks - late_tasks) / total_tasks * 100) if total_tasks > 0 else 100
        
        # Active projects
        active_projects = await db.design_projects.count_documents({
            "designer_id": designer_id,
            "status": "active"
        })
        
        # Current overdue
        overdue_count = await db.design_tasks.count_documents({
            "assigned_to": designer_id,
            "status": {"$ne": "Completed"},
            "due_date": {"$lt": now.isoformat()}
        })
        
        # Calculate performance score (0-100)
        score = min(100, max(0, int(
            on_time_rate * 0.6 +  # 60% weight on on-time
            (completed_projects * 5) +  # Bonus for completed projects
            (100 - overdue_count * 10)  # Penalty for overdue
        )))
        
        designer_scores.append({
            "user_id": designer_id,
            "name": designer["name"],
            "picture": designer.get("picture"),
            "role": designer["role"],
            "score": score,
            "on_time_rate": round(on_time_rate, 1),
            "completed_projects": completed_projects,
            "active_projects": active_projects,
            "overdue_tasks": overdue_count
        })
    
    designer_scores.sort(key=lambda x: x["score"], reverse=True)
    
    # === Design Manager (Arya) Performance ===
    design_managers = await db.users.find(
        {"role": "DesignManager", "status": "Active"},
        {"_id": 0}
    ).to_list(10)
    
    manager_scores = []
    for manager in design_managers:
        # Get total design projects under management
        total_projects = await db.design_projects.count_documents({"status": "active"})
        delayed_project_count = await db.design_projects.count_documents({
            "status": "active",
            "current_stage": {"$ne": "Validation & Kickoff"}
        })
        
        # Calculate review turnaround (from stage history)
        manager_scores.append({
            "user_id": manager["user_id"],
            "name": manager["name"],
            "picture": manager.get("picture"),
            "total_projects_managed": total_projects,
            "delayed_projects": len([dp for dp in (await db.design_projects.find(
                {"status": "active"}, {"_id": 0}
            ).to_list(1000)) if any(
                t.get("status") != "Completed" and t.get("due_date", "") < now.isoformat()
                for t in (await db.design_tasks.find({"design_project_id": dp["id"]}, {"_id": 0}).to_list(100))
            )]),
            "score": 85  # Placeholder - would need more detailed tracking
        })
    
    # === Validation Speed (Sharon) ===
    production_managers = await db.users.find(
        {"role": "ProductionManager", "status": "Active"},
        {"_id": 0}
    ).to_list(10)
    
    validation_scores = []
    for pm in production_managers:
        validations = await db.validations.find(
            {"validated_by": pm["user_id"]},
            {"_id": 0}
        ).to_list(1000)
        
        approved_count = len([v for v in validations if v.get("status") == "approved"])
        revision_count = len([v for v in validations if v.get("status") == "needs_revision"])
        
        validation_scores.append({
            "user_id": pm["user_id"],
            "name": pm["name"],
            "picture": pm.get("picture"),
            "total_validations": len(validations),
            "approved": approved_count,
            "needs_revision": revision_count,
            "approval_rate": round(approved_count / len(validations) * 100, 1) if validations else 100
        })
    
    # === Delay Attribution ===
    delay_by_stage = {}
    delay_by_designer = {}
    
    all_design_projects = await db.design_projects.find(
        {"status": "active"},
        {"_id": 0}
    ).to_list(1000)
    
    for dp in all_design_projects:
        overdue_tasks = await db.design_tasks.find({
            "design_project_id": dp["id"],
            "status": {"$ne": "Completed"},
            "due_date": {"$lt": now.isoformat()}
        }, {"_id": 0}).to_list(100)
        
        for task in overdue_tasks:
            stage = task.get("stage", "Unknown")
            if stage not in delay_by_stage:
                delay_by_stage[stage] = 0
            delay_by_stage[stage] += 1
            
            assignee = task.get("assigned_to")
            if assignee:
                if assignee not in delay_by_designer:
                    assignee_user = await db.users.find_one(
                        {"user_id": assignee},
                        {"_id": 0, "name": 1}
                    )
                    delay_by_designer[assignee] = {
                        "name": assignee_user.get("name") if assignee_user else "Unknown",
                        "count": 0
                    }
                delay_by_designer[assignee]["count"] += 1
    
    # === Workload Distribution ===
    workload = []
    for designer in designers:
        active = await db.design_projects.count_documents({
            "designer_id": designer["user_id"],
            "status": "active"
        })
        workload.append({
            "name": designer["name"],
            "active_projects": active
        })
    
    # === Project Health Overview ===
    total_design_projects = await db.design_projects.count_documents({})
    active_design_projects = await db.design_projects.count_documents({"status": "active"})
    completed_design_projects = await db.design_projects.count_documents({"status": "completed"})
    
    # Projects with delays
    projects_with_delays = 0
    for dp in all_design_projects:
        has_overdue = await db.design_tasks.count_documents({
            "design_project_id": dp["id"],
            "status": {"$ne": "Completed"},
            "due_date": {"$lt": now.isoformat()}
        })
        if has_overdue > 0:
            projects_with_delays += 1
    
    return {
        "designer_performance": designer_scores,
        "manager_performance": manager_scores,
        "validation_performance": validation_scores,
        "delay_attribution": {
            "by_stage": delay_by_stage,
            "by_designer": list(delay_by_designer.values())
        },
        "workload_distribution": workload,
        "project_health": {
            "total": total_design_projects,
            "active": active_design_projects,
            "completed": completed_design_projects,
            "with_delays": projects_with_delays,
            "health_percentage": round((active_design_projects - projects_with_delays) / active_design_projects * 100, 1) if active_design_projects > 0 else 100
        },
        "bottleneck_analysis": {
            "most_delayed_stage": max(delay_by_stage.items(), key=lambda x: x[1])[0] if delay_by_stage else None,
            "delay_by_stage": delay_by_stage
        }
    }

# ============ OPERATIONS LEAD DASHBOARD ============

@api_router.get("/operations/dashboard")
async def get_operations_dashboard(request: Request):
    """Dashboard for Operations Lead - post-production delivery and installation tracking"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "OperationsLead"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Get projects in operations stages
    operations_stages = ["Production", "Quality Check", "Delivery", "Installation", "Handover"]
    
    # Get all projects in these stages
    operations_projects = await db.projects.find(
        {"stage": {"$in": operations_stages}, "status": {"$nin": ["Lost", "Completed"]}},
        {"_id": 0}
    ).to_list(500)
    
    # Projects by stage
    projects_by_stage = {stage: 0 for stage in operations_stages}
    delayed_deliveries = []
    
    for project in operations_projects:
        stage = project.get("stage")
        if stage in projects_by_stage:
            projects_by_stage[stage] += 1
        
        # Check for delays in delivery
        timeline = project.get("timeline", [])
        for milestone in timeline:
            if milestone.get("stage_ref") in ["Delivery", "Installation", "Handover"]:
                expected = milestone.get("expectedDate")
                completed = milestone.get("completedDate")
                if expected and not completed:
                    expected_date = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                    if expected_date < now:
                        days_delayed = (now - expected_date).days
                        delayed_deliveries.append({
                            "project_id": project.get("project_id"),
                            "project_name": project.get("project_name"),
                            "client_name": project.get("client_name"),
                            "stage": stage,
                            "milestone": milestone.get("title"),
                            "days_delayed": days_delayed
                        })
    
    # Get upcoming deliveries (next 7 days)
    upcoming_deliveries = []
    seven_days = (now + timedelta(days=7)).isoformat()
    
    for project in operations_projects:
        if project.get("stage") in ["Delivery", "Installation"]:
            timeline = project.get("timeline", [])
            for milestone in timeline:
                expected = milestone.get("expectedDate")
                if expected and not milestone.get("completedDate"):
                    if expected <= seven_days:
                        upcoming_deliveries.append({
                            "project_id": project.get("project_id"),
                            "project_name": project.get("project_name"),
                            "client_name": project.get("client_name"),
                            "milestone": milestone.get("title"),
                            "expected_date": expected
                        })
    
    # Completed this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    completed_this_month = await db.projects.count_documents({
        "stage": "Completed",
        "updated_at": {"$gte": month_start.isoformat()}
    })
    
    return {
        "summary": {
            "total_in_operations": len(operations_projects),
            "in_production": projects_by_stage.get("Production", 0),
            "in_quality_check": projects_by_stage.get("Quality Check", 0),
            "in_delivery": projects_by_stage.get("Delivery", 0),
            "in_installation": projects_by_stage.get("Installation", 0),
            "pending_handover": projects_by_stage.get("Handover", 0),
            "delayed_count": len(delayed_deliveries),
            "completed_this_month": completed_this_month
        },
        "projects_by_stage": projects_by_stage,
        "delayed_deliveries": delayed_deliveries[:10],
        "upcoming_deliveries": upcoming_deliveries[:10]
    }

# ============ V1 PRODUCTION/OPS MANAGER DASHBOARD ============

@api_router.get("/production-ops/dashboard")
async def get_production_ops_dashboard(request: Request):
    """
    V1 Dashboard for Production/Operations Manager
    Covers: Validation, Kick-Off, Production, Delivery, Installation, Handover
    """
    user = await get_current_user(request)
    
    # Allow Admin, ProductionOpsManager, or users with senior_manager_view
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    has_senior_view = user_doc.get("senior_manager_view", False) if user_doc else False
    
    if user.role not in ["Admin", "ProductionOpsManager"] and not has_senior_view:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    # Get projects in execution stages (V1 stages)
    execution_stages = EXECUTION_STAGES  # ["Validation", "Kick-Off", "Production", "Delivery", "Installation", "Handover"]
    
    all_projects = await db.projects.find(
        {"stage": {"$in": execution_stages}, "status": {"$nin": ["Lost"]}},
        {"_id": 0}
    ).to_list(500)
    
    # Count by stage
    projects_by_stage = {stage: 0 for stage in execution_stages}
    delayed_projects = []
    upcoming_deliveries = []
    
    for project in all_projects:
        stage = project.get("stage")
        if stage in projects_by_stage:
            projects_by_stage[stage] += 1
        
        # Check for delays
        timeline = project.get("timeline", [])
        for milestone in timeline:
            if milestone.get("stage_ref") == stage:
                expected = milestone.get("expectedDate")
                completed = milestone.get("completedDate")
                if expected and not completed:
                    try:
                        expected_date = datetime.fromisoformat(expected.replace("Z", "+00:00"))
                        if expected_date < now:
                            days_delayed = (now - expected_date).days
                            delayed_projects.append({
                                "project_id": project.get("project_id"),
                                "project_name": project.get("project_name"),
                                "client_name": project.get("client_name"),
                                "stage": stage,
                                "days_delayed": days_delayed
                            })
                    except:
                        pass
    
    # Get upcoming deliveries (next 7 days)
    seven_days = (now + timedelta(days=7)).isoformat()
    for project in all_projects:
        if project.get("stage") in ["Delivery", "Installation", "Handover"]:
            timeline = project.get("timeline", [])
            for milestone in timeline:
                expected = milestone.get("expectedDate")
                if expected and not milestone.get("completedDate"):
                    if expected <= seven_days:
                        upcoming_deliveries.append({
                            "project_id": project.get("project_id"),
                            "project_name": project.get("project_name"),
                            "client_name": project.get("client_name"),
                            "stage": project.get("stage"),
                            "expected_date": expected
                        })
    
    # Due this week
    week_end = (now + timedelta(days=7)).isoformat()
    due_this_week = len([p for p in upcoming_deliveries])
    
    # Completed this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    completed_this_month = await db.projects.count_documents({
        "stage": "Handover",
        "updated_at": {"$gte": month_start.isoformat()}
    })
    
    return {
        "summary": {
            "total_in_execution": len(all_projects),
            "delayed_count": len(delayed_projects),
            "due_this_week": due_this_week,
            "completed_this_month": completed_this_month
        },
        "projects_by_stage": projects_by_stage,
        "delayed_projects": sorted(delayed_projects, key=lambda x: x["days_delayed"], reverse=True)[:10],
        "upcoming_deliveries": upcoming_deliveries[:10]
    }

# ============ SALES MANAGER DASHBOARD ============

@api_router.get("/sales-manager/dashboard")
async def get_sales_manager_dashboard(request: Request):
    """
    Dashboard for Sales Manager - monitors all pre-booking leads, sales performance, funnel analytics
    """
    user = await get_current_user(request)
    
    if user.role not in SALES_MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Access denied. Sales Manager role required.")
    
    now = datetime.now(timezone.utc)
    
    # Get all leads in pre-booking stages (sales pipeline)
    all_leads = await db.leads.find(
        {"stage": {"$in": PRE_BOOKING_STAGES}, "status": {"$nin": ["Lost", "Converted"]}},
        {"_id": 0}
    ).to_list(1000)
    
    # Sales funnel metrics
    funnel = {stage: 0 for stage in PRE_BOOKING_STAGES}
    bc_call_pending = 0
    bc_call_done = 0
    site_visit_pending = 0
    site_visit_done = 0
    tentative_boq_sent = 0
    revised_boq_sent = 0
    waiting_for_booking = 0
    
    # Leads by assignee (designer performance)
    leads_by_assignee = {}
    
    # Inactive leads tracking
    inactive_leads = []  # No activity in X days
    no_followup_leads = []  # No follow-up scheduled
    needs_reassignment = []  # Multiple failed attempts
    
    for lead in all_leads:
        stage = lead.get("stage", "New Lead")
        if stage in funnel:
            funnel[stage] += 1
        
        # Count by status
        if "BC Call" in stage:
            if "Done" in stage:
                bc_call_done += 1
            else:
                bc_call_pending += 1
        
        if "Site Visit" in stage:
            if "Done" in stage:
                site_visit_done += 1
            else:
                site_visit_pending += 1
        
        if stage == "Tentative BOQ Sent":
            tentative_boq_sent += 1
        elif stage == "Revised BOQ Sent":
            revised_boq_sent += 1
        elif stage == "Waiting for Booking":
            waiting_for_booking += 1
        
        # Track by assignee
        assignee_id = lead.get("assigned_to")
        if assignee_id:
            if assignee_id not in leads_by_assignee:
                leads_by_assignee[assignee_id] = {
                    "total": 0,
                    "new": 0,
                    "bc_done": 0,
                    "site_done": 0,
                    "boq_sent": 0,
                    "waiting_booking": 0
                }
            leads_by_assignee[assignee_id]["total"] += 1
            if stage == "New Lead":
                leads_by_assignee[assignee_id]["new"] += 1
            elif "BC Call Done" in stage:
                leads_by_assignee[assignee_id]["bc_done"] += 1
            elif "Site Visit Done" in stage:
                leads_by_assignee[assignee_id]["site_done"] += 1
            elif "BOQ" in stage:
                leads_by_assignee[assignee_id]["boq_sent"] += 1
            elif stage == "Waiting for Booking":
                leads_by_assignee[assignee_id]["waiting_booking"] += 1
        
        # Check for inactive leads (no update in 7+ days)
        updated_at = lead.get("updated_at")
        if updated_at:
            try:
                last_update = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                days_inactive = (now - last_update).days
                if days_inactive >= 7:
                    inactive_leads.append({
                        "lead_id": lead.get("lead_id"),
                        "client_name": lead.get("client_name"),
                        "stage": stage,
                        "assigned_to": assignee_id,
                        "days_inactive": days_inactive
                    })
            except:
                pass
        
        # Check for leads with no follow-up
        next_followup = lead.get("next_followup")
        if not next_followup:
            no_followup_leads.append({
                "lead_id": lead.get("lead_id"),
                "client_name": lead.get("client_name"),
                "stage": stage,
                "assigned_to": assignee_id
            })
        
        # Check for leads needing reassignment (multiple reschedules or long in same stage)
        if lead.get("reschedule_count", 0) >= 3:
            needs_reassignment.append({
                "lead_id": lead.get("lead_id"),
                "client_name": lead.get("client_name"),
                "stage": stage,
                "assigned_to": assignee_id,
                "reason": "Multiple reschedules"
            })
    
    # Get designer details for performance view
    designer_performance = []
    sales_users = await db.users.find(
        {"role": {"$in": ["PreSales", "HybridDesigner", "Designer"]}, "status": "Active"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}
    ).to_list(100)
    
    for sales_user in sales_users:
        user_id = sales_user["user_id"]
        stats = leads_by_assignee.get(user_id, {
            "total": 0, "new": 0, "bc_done": 0, "site_done": 0, "boq_sent": 0, "waiting_booking": 0
        })
        
        # Calculate conversion rate
        total = stats["total"]
        conversion_rate = (stats["waiting_booking"] / total * 100) if total > 0 else 0
        
        designer_performance.append({
            "user_id": user_id,
            "name": sales_user.get("name"),
            "picture": sales_user.get("picture"),
            "role": sales_user.get("role"),
            "stats": stats,
            "conversion_rate": round(conversion_rate, 1)
        })
    
    # Sort by conversion rate descending
    designer_performance.sort(key=lambda x: x["conversion_rate"], reverse=True)
    
    # Recent conversions (leads converted to projects in last 30 days)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    recent_conversions = await db.projects.count_documents({
        "created_at": {"$gte": thirty_days_ago},
        "stage": {"$nin": PRE_BOOKING_STAGES}
    })
    
    # Total value in pipeline (estimated)
    pipeline_value = sum(lead.get("budget", 0) or 0 for lead in all_leads)
    
    return {
        "summary": {
            "total_active_leads": len(all_leads),
            "bc_call_pending": bc_call_pending,
            "bc_call_done": bc_call_done,
            "site_visit_pending": site_visit_pending,
            "site_visit_done": site_visit_done,
            "tentative_boq_sent": tentative_boq_sent,
            "revised_boq_sent": revised_boq_sent,
            "waiting_for_booking": waiting_for_booking,
            "inactive_count": len(inactive_leads),
            "no_followup_count": len(no_followup_leads),
            "needs_reassignment_count": len(needs_reassignment),
            "recent_conversions": recent_conversions,
            "pipeline_value": pipeline_value
        },
        "funnel": funnel,
        "designer_performance": designer_performance,
        "inactive_leads": sorted(inactive_leads, key=lambda x: x["days_inactive"], reverse=True)[:15],
        "no_followup_leads": no_followup_leads[:15],
        "needs_reassignment": needs_reassignment[:15]
    }


@api_router.post("/sales-manager/reassign-lead/{lead_id}")
async def reassign_lead(lead_id: str, request: Request):
    """Reassign a lead to a different designer"""
    user = await get_current_user(request)
    
    if user.role not in SALES_MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Access denied. Sales Manager role required.")
    
    body = await request.json()
    new_assignee_id = body.get("assignee_id")
    reason = body.get("reason", "Reassigned by Sales Manager")
    
    if not new_assignee_id:
        raise HTTPException(status_code=400, detail="New assignee ID required")
    
    # Get the lead
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Verify lead is in sales stage
    if lead.get("stage") not in PRE_BOOKING_STAGES:
        raise HTTPException(status_code=400, detail="Can only reassign leads in sales stages")
    
    # Get new assignee details
    new_assignee = await db.users.find_one(
        {"user_id": new_assignee_id},
        {"_id": 0, "name": 1, "email": 1, "role": 1}
    )
    if not new_assignee:
        raise HTTPException(status_code=404, detail="New assignee not found")
    
    old_assignee_id = lead.get("assigned_to")
    now = datetime.now(timezone.utc)
    
    # Update lead
    await db.leads.update_one(
        {"lead_id": lead_id},
        {
            "$set": {
                "assigned_to": new_assignee_id,
                "assigned_to_name": new_assignee.get("name"),
                "updated_at": now.isoformat()
            },
            "$push": {
                "comments": {
                    "id": str(uuid.uuid4()),
                    "user_id": user.user_id,
                    "user_name": user.name,
                    "message": f"Lead reassigned to {new_assignee.get('name')}. Reason: {reason}",
                    "is_system": True,
                    "created_at": now.isoformat()
                }
            }
        }
    )
    
    # Notify new assignee
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": new_assignee_id,
        "title": "Lead Assigned",
        "message": f"Lead '{lead.get('client_name')}' has been assigned to you by {user.name}",
        "type": "lead_assigned",
        "read": False,
        "link_url": f"/leads/{lead_id}",
        "created_at": now.isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "message": f"Lead reassigned to {new_assignee.get('name')}"}


@api_router.get("/sales-manager/lead-activity/{lead_id}")
async def get_lead_sales_activity(lead_id: str, request: Request):
    """Get all sales-related activity for a lead"""
    user = await get_current_user(request)
    
    if user.role not in SALES_MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Access denied. Sales Manager role required.")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get all comments and activities
    comments = lead.get("comments", [])
    
    # Get meetings related to this lead
    meetings = await db.meetings.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).to_list(50)
    
    # Combine into activity timeline
    activity = []
    
    for comment in comments:
        activity.append({
            "type": "comment",
            "timestamp": comment.get("created_at"),
            "user_name": comment.get("user_name"),
            "message": comment.get("message"),
            "is_system": comment.get("is_system", False)
        })
    
    for meeting in meetings:
        activity.append({
            "type": "meeting",
            "timestamp": meeting.get("created_at"),
            "meeting_type": meeting.get("meeting_type"),
            "status": meeting.get("status"),
            "scheduled_for": meeting.get("scheduled_for")
        })
    
    # Sort by timestamp descending
    activity.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    return {
        "lead_id": lead_id,
        "client_name": lead.get("client_name"),
        "stage": lead.get("stage"),
        "assigned_to": lead.get("assigned_to_name"),
        "activity": activity[:50]
    }


# ============ AUTO-COLLABORATOR SYSTEM ============

async def auto_add_stage_collaborators(project_id: str, new_stage: str, activity_message: str = None):
    """
    Livspace-style auto-collaborator system.
    Automatically adds collaborators based on project stage transitions.
    """
    roles_to_add = STAGE_COLLABORATOR_ROLES.get(new_stage, [])
    
    if not roles_to_add:
        return
    
    project = await db.projects.find_one(
        {"project_id": project_id},
        {"_id": 0, "collaborators": 1, "project_name": 1}
    )
    
    if not project:
        return
    
    current_collaborators = project.get("collaborators", [])
    current_user_ids = [c.get("user_id") for c in current_collaborators]
    
    new_collaborators = []
    now = datetime.now(timezone.utc)
    
    for role in roles_to_add:
        # Find users with this role
        role_users = await db.users.find(
            {"role": role, "status": "Active"},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}
        ).to_list(10)
        
        for role_user in role_users:
            if role_user["user_id"] not in current_user_ids:
                new_collaborators.append({
                    "user_id": role_user["user_id"],
                    "name": role_user.get("name"),
                    "email": role_user.get("email"),
                    "role": role_user.get("role"),
                    "picture": role_user.get("picture"),
                    "added_at": now.isoformat(),
                    "added_by": "system",
                    "reason": f"Auto-added at stage: {new_stage}"
                })
                current_user_ids.append(role_user["user_id"])
    
    if new_collaborators:
        # Update project collaborators
        await db.projects.update_one(
            {"project_id": project_id},
            {
                "$push": {"collaborators": {"$each": new_collaborators}},
                "$set": {"updated_at": now.isoformat()}
            }
        )
        
        # Add activity entry for each new collaborator
        for collab in new_collaborators:
            activity_entry = {
                "id": str(uuid.uuid4()),
                "type": "collaborator_added",
                "message": f"{collab['name']} ({collab['role']}) auto-added as collaborator",
                "user_name": "System",
                "timestamp": now.isoformat(),
                "metadata": {
                    "collaborator_id": collab["user_id"],
                    "collaborator_role": collab["role"],
                    "trigger_stage": new_stage
                }
            }
            
            await db.projects.update_one(
                {"project_id": project_id},
                {"$push": {"activity": activity_entry}}
            )
        
        # Send notifications to new collaborators
        for collab in new_collaborators:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": collab["user_id"],
                "title": "Added to Project",
                "message": f"You've been added as a collaborator to {project.get('project_name', 'a project')} at stage: {new_stage}",
                "type": "collaborator",
                "read": False,
                "link_url": f"/projects/{project_id}",
                "created_at": now.isoformat()
            }
            await db.notifications.insert_one(notification)

# ============ DESIGN WORKFLOW SEED DATA ============

@api_router.post("/design-workflow/seed")
async def seed_design_workflow_data(request: Request):
    """Seed design workflow data for testing"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Create design manager user
    design_manager = {
        "user_id": f"dm_{uuid.uuid4().hex[:8]}",
        "email": "arya@arkiflo.com",
        "name": "Arya (Design Manager)",
        "role": "DesignManager",
        "status": "Active",
        "created_at": now.isoformat()
    }
    
    existing_dm = await db.users.find_one({"email": "arya@arkiflo.com"})
    if not existing_dm:
        await db.users.insert_one(design_manager)
    
    # Create production manager user
    prod_manager = {
        "user_id": f"pm_{uuid.uuid4().hex[:8]}",
        "email": "sharon@arkiflo.com",
        "name": "Sharon (Production Manager)",
        "role": "ProductionManager",
        "status": "Active",
        "created_at": now.isoformat()
    }
    
    existing_pm = await db.users.find_one({"email": "sharon@arkiflo.com"})
    if not existing_pm:
        await db.users.insert_one(prod_manager)
    
    # Create sample designers
    designer_names = ["Priya Designer", "Rahul Designer", "Anita Hybrid Designer"]
    designer_roles = ["Designer", "Designer", "HybridDesigner"]
    
    created_designers = []
    for i, name in enumerate(designer_names):
        email = f"{name.lower().replace(' ', '.')}@arkiflo.com"
        existing = await db.users.find_one({"email": email})
        if not existing:
            designer = {
                "user_id": f"des_{uuid.uuid4().hex[:8]}",
                "email": email,
                "name": name,
                "role": designer_roles[i],
                "status": "Active",
                "created_at": now.isoformat()
            }
            await db.users.insert_one(designer)
            created_designers.append(designer)
        else:
            created_designers.append(existing)
    
    # Get existing projects
    projects = await db.projects.find({}, {"_id": 0}).to_list(10)
    
    design_projects_created = 0
    for i, project in enumerate(projects[:5]):
        # Check if design project already exists
        existing_dp = await db.design_projects.find_one({"project_id": project["project_id"]})
        if existing_dp:
            continue
        
        designer = created_designers[i % len(created_designers)]
        stage_index = i % len(DESIGN_WORKFLOW_STAGES)
        current_stage = DESIGN_WORKFLOW_STAGES[stage_index]
        
        design_project = {
            "id": f"dp_{uuid.uuid4().hex[:8]}",
            "project_id": project["project_id"],
            "designer_id": designer["user_id"],
            "current_stage": current_stage,
            "stage_history": [{
                "stage": current_stage,
                "entered_at": (now - timedelta(days=i*3)).isoformat(),
                "completed_at": None,
                "notes": "Seeded design project"
            }],
            "is_referral": i == 2,  # One referral project
            "referral_source": "Milestone Infrastructure" if i == 2 else None,
            "status": "active",
            "files": [],
            "meetings": [],
            "created_by": user.user_id,
            "created_at": (now - timedelta(days=i*3)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.design_projects.insert_one(design_project)
        design_projects_created += 1
        
        # Create auto-tasks for current stage
        await create_design_auto_tasks(
            design_project["id"],
            current_stage,
            designer["user_id"]
        )
    
    return {
        "message": "Design workflow data seeded",
        "design_projects_created": design_projects_created,
        "design_manager": design_manager.get("email") if not existing_dm else "Already exists",
        "production_manager": prod_manager.get("email") if not existing_pm else "Already exists",
        "designers": [d.get("email") for d in created_designers]
    }


# ============ WARRANTY ENDPOINTS ============

@api_router.get("/warranties")
async def list_warranties(request: Request, search: Optional[str] = None, status: Optional[str] = None):
    """List all warranties with optional filters"""
    user = await get_current_user(request)
    
    if user.role == "Technician":
        raise HTTPException(status_code=403, detail="Technicians cannot access warranty list")
    
    query = {}
    if search:
        query["$or"] = [
            {"pid": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"project_name": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["warranty_status"] = status
    
    warranties = await db.warranties.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return warranties

@api_router.get("/warranties/{warranty_id}")
async def get_warranty(warranty_id: str, request: Request):
    """Get a single warranty by ID"""
    user = await get_current_user(request)
    
    warranty = await db.warranties.find_one({"warranty_id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    return warranty

@api_router.get("/warranties/by-pid/{pid}")
async def get_warranty_by_pid(pid: str, request: Request):
    """Get warranty by PID"""
    user = await get_current_user(request)
    
    warranty = await db.warranties.find_one({"pid": pid}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found for this PID")
    
    return warranty

@api_router.get("/warranties/by-project/{project_id}")
async def get_warranty_by_project(project_id: str, request: Request):
    """Get warranty by project ID"""
    user = await get_current_user(request)
    
    warranty = await db.warranties.find_one({"project_id": project_id}, {"_id": 0})
    return warranty  # Can be None if no warranty exists yet

@api_router.put("/warranties/{warranty_id}")
async def update_warranty(warranty_id: str, request: Request):
    """Update warranty details (files, materials, modules, notes, and dates for Admin)"""
    user = await get_current_user(request)
    
    warranty = await db.warranties.find_one({"warranty_id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    # Get user document for permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    # Permission check: Admin, ProductionOpsManager, SalesManager, OR collaborator with warranty.update
    allowed_roles = ["Admin", "SalesManager", "ProductionOpsManager"]
    is_collaborator = user.user_id in warranty.get("collaborators", [])
    has_warranty_update = has_permission(user_doc, "warranty.update")
    
    if user.role not in allowed_roles and not (is_collaborator and has_warranty_update):
        raise HTTPException(status_code=403, detail="You don't have permission to update warranties")
    
    body = await request.json()
    
    now = datetime.now(timezone.utc)
    update_fields = {"updated_at": now.isoformat()}
    
    # Standard fields - all managers can update
    allowed_fields = ["warranty_book_url", "vendor_warranty_files", "materials_list", "modules_list", "notes"]
    for field in allowed_fields:
        if field in body:
            update_fields[field] = body[field]
    
    # Admin-only fields - warranty dates and period
    admin_fields = ["warranty_start_date", "warranty_end_date", "warranty_period_years"]
    if user.role == "Admin":
        for field in admin_fields:
            if field in body:
                update_fields[field] = body[field]
        
        # If warranty_period_years is provided, recalculate end date
        if "warranty_period_years" in body and "warranty_start_date" in body:
            try:
                start_date = datetime.strptime(body["warranty_start_date"], "%Y-%m-%d")
                end_date = start_date + timedelta(days=365 * int(body["warranty_period_years"]))
                update_fields["warranty_end_date"] = end_date.strftime("%Y-%m-%d")
            except Exception as e:
                logger.warning(f"Error calculating warranty end date: {e}")
    
    await db.warranties.update_one(
        {"warranty_id": warranty_id},
        {"$set": update_fields}
    )
    
    # Log the update if dates were changed
    if any(f in body for f in admin_fields):
        activity_entry = {
            "id": str(uuid.uuid4()),
            "type": "warranty_update",
            "message": f"Warranty dates updated by {user.name}",
            "user_id": user.user_id,
            "user_name": user.name,
            "timestamp": now.isoformat(),
            "metadata": {k: body[k] for k in admin_fields if k in body}
        }
        await db.warranties.update_one(
            {"warranty_id": warranty_id},
            {"$push": {"activity": activity_entry}}
        )
    
    updated = await db.warranties.find_one({"warranty_id": warranty_id}, {"_id": 0})
    return updated


@api_router.get("/warranties/{warranty_id}/collaborators")
async def get_warranty_collaborators(warranty_id: str, request: Request):
    """Get list of collaborators for a warranty"""
    user = await get_current_user(request)
    
    warranty = await db.warranties.find_one({"warranty_id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    # Get collaborator details
    collaborator_ids = warranty.get("collaborators", [])
    collaborators = []
    
    for collab_id in collaborator_ids:
        user_doc = await db.users.find_one({"user_id": collab_id}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1})
        if user_doc:
            collaborators.append(user_doc)
    
    return collaborators


@api_router.post("/warranties/{warranty_id}/collaborators")
async def add_warranty_collaborator(warranty_id: str, request: Request):
    """Add a collaborator (typically Technician) to a warranty request"""
    user = await get_current_user(request)
    body = await request.json()
    
    # Permission check: ProductionOpsManager, Admin, or user with warranty.update
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    allowed_roles = ["Admin", "ProductionOpsManager", "SalesManager"]
    has_warranty_update = has_permission(user_doc, "warranty.update")
    
    if user.role not in allowed_roles and not has_warranty_update:
        raise HTTPException(status_code=403, detail="Access denied - cannot manage warranty collaborators")
    
    warranty = await db.warranties.find_one({"warranty_id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    collaborator_user_id = body.get("user_id")
    if not collaborator_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Check if user exists
    target_user = await db.users.find_one({"user_id": collaborator_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a collaborator
    collaborators = warranty.get("collaborators", [])
    if collaborator_user_id in collaborators:
        raise HTTPException(status_code=400, detail="User is already a collaborator")
    
    # Add collaborator
    now = datetime.now(timezone.utc)
    await db.warranties.update_one(
        {"warranty_id": warranty_id},
        {
            "$push": {"collaborators": collaborator_user_id},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    # Log activity
    activity_entry = {
        "id": str(uuid.uuid4()),
        "type": "collaborator_added",
        "message": f"{target_user.get('name')} ({target_user.get('role')}) added as collaborator by {user.name}",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat(),
        "metadata": {"collaborator_id": collaborator_user_id, "collaborator_name": target_user.get("name")}
    }
    await db.warranties.update_one(
        {"warranty_id": warranty_id},
        {"$push": {"activity": activity_entry}}
    )
    
    return {"message": f"Added {target_user.get('name')} as collaborator", "collaborator": target_user}


@api_router.delete("/warranties/{warranty_id}/collaborators/{collaborator_user_id}")
async def remove_warranty_collaborator(warranty_id: str, collaborator_user_id: str, request: Request):
    """Remove a collaborator from a warranty"""
    user = await get_current_user(request)
    
    # Permission check
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=403, detail="User not found")
    
    allowed_roles = ["Admin", "ProductionOpsManager", "SalesManager"]
    has_warranty_update = has_permission(user_doc, "warranty.update")
    
    if user.role not in allowed_roles and not has_warranty_update:
        raise HTTPException(status_code=403, detail="Access denied - cannot manage warranty collaborators")
    
    warranty = await db.warranties.find_one({"warranty_id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    # Check if user is a collaborator
    collaborators = warranty.get("collaborators", [])
    if collaborator_user_id not in collaborators:
        raise HTTPException(status_code=400, detail="User is not a collaborator")
    
    # Get collaborator details for logging
    target_user = await db.users.find_one({"user_id": collaborator_user_id}, {"_id": 0})
    collaborator_name = target_user.get("name", "Unknown") if target_user else "Unknown"
    
    # Remove collaborator
    now = datetime.now(timezone.utc)
    await db.warranties.update_one(
        {"warranty_id": warranty_id},
        {
            "$pull": {"collaborators": collaborator_user_id},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    # Log activity
    activity_entry = {
        "id": str(uuid.uuid4()),
        "type": "collaborator_removed",
        "message": f"{collaborator_name} removed from collaborators by {user.name}",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat(),
        "metadata": {"collaborator_id": collaborator_user_id, "collaborator_name": collaborator_name}
    }
    await db.warranties.update_one(
        {"warranty_id": warranty_id},
        {"$push": {"activity": activity_entry}}
    )
    
    return {"message": f"Removed {collaborator_name} from collaborators"}


async def create_warranty_for_project(project_id: str, user_id: str, user_name: str):
    """Auto-create warranty when project reaches Closed status"""
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        return None
    
    # Check if warranty already exists
    existing = await db.warranties.find_one({"project_id": project_id}, {"_id": 0})
    if existing:
        return existing
    
    now = datetime.now(timezone.utc)
    handover_date = now.strftime("%Y-%m-%d")
    warranty_end = (now + timedelta(days=365*10)).strftime("%Y-%m-%d")  # 10 years
    
    warranty_id = f"WAR-{uuid.uuid4().hex[:8].upper()}"
    
    warranty = {
        "warranty_id": warranty_id,
        "pid": project.get("pid", ""),
        "project_id": project_id,
        "project_name": project.get("project_name", ""),
        "customer_name": project.get("client_name", ""),
        "customer_address": project.get("client_address", ""),
        "customer_phone": project.get("client_phone", ""),
        "customer_email": project.get("client_email", ""),
        "handover_date": handover_date,
        "warranty_start_date": handover_date,
        "warranty_end_date": warranty_end,
        "warranty_status": "Active",
        "warranty_book_url": None,
        "vendor_warranty_files": [],
        "materials_list": [],
        "modules_list": [],
        "service_requests": [],
        "notes": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.warranties.insert_one(warranty)
    
    # Add timeline entry to project
    timeline_entry = {
        "id": f"timeline_{uuid.uuid4().hex[:8]}",
        "title": "Warranty Created",
        "message": f"10-year warranty record created. Warranty ID: {warranty_id}",
        "user_id": user_id,
        "user_name": user_name,
        "type": "warranty_created",
        "created_at": now.isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": project_id},
        {"$push": {"comments": timeline_entry}}
    )
    
    return warranty


# ============ SERVICE REQUEST ENDPOINTS ============

@api_router.get("/service-requests")
async def list_service_requests(
    request: Request, 
    search: Optional[str] = None, 
    stage: Optional[str] = None,
    priority: Optional[str] = None,
    technician_id: Optional[str] = None
):
    """List service requests with filters"""
    user = await get_current_user(request)
    
    query = {}
    
    # Technicians can only see their assigned requests
    if user.role == "Technician":
        query["assigned_technician_id"] = user.user_id
    
    if search:
        query["$or"] = [
            {"service_request_id": {"$regex": search, "$options": "i"}},
            {"pid": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}}
        ]
    if stage:
        query["stage"] = stage
    if priority:
        query["priority"] = priority
    if technician_id and user.role != "Technician":
        query["assigned_technician_id"] = technician_id
    
    requests = await db.service_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return requests

@api_router.get("/service-requests/{request_id}")
async def get_service_request(request_id: str, request: Request):
    """Get a single service request"""
    user = await get_current_user(request)
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Technicians can only view their assigned requests
    if user.role == "Technician" and sr.get("assigned_technician_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return sr

@api_router.get("/service-requests/by-pid/{pid}")
async def get_service_requests_by_pid(pid: str, request: Request):
    """Get all service requests for a PID"""
    user = await get_current_user(request)
    
    requests = await db.service_requests.find({"pid": pid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/service-requests/by-project/{project_id}")
async def get_service_requests_by_project(project_id: str, request: Request):
    """Get all service requests for a project"""
    user = await get_current_user(request)
    
    requests = await db.service_requests.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.post("/service-requests")
async def create_service_request(data: ServiceRequestCreate, request: Request):
    """Create a new service request (internal)"""
    user = await get_current_user(request)
    
    if user.role == "Technician":
        raise HTTPException(status_code=403, detail="Technicians cannot create service requests")
    
    now = datetime.now(timezone.utc)
    service_request_id = f"SR-{uuid.uuid4().hex[:8].upper()}"
    sla_visit_by = (now + timedelta(hours=72)).isoformat()
    
    # Try to find project and warranty by PID
    project = None
    warranty = None
    warranty_status = "Unknown"
    
    if data.pid:
        project = await db.projects.find_one({"pid": data.pid}, {"_id": 0})
        if project:
            warranty = await db.warranties.find_one({"pid": data.pid}, {"_id": 0})
            if warranty:
                # Check if warranty is active
                end_date = datetime.strptime(warranty["warranty_end_date"], "%Y-%m-%d")
                warranty_status = "Active" if end_date > now.replace(tzinfo=None) else "Expired"
    
    service_request = {
        "service_request_id": service_request_id,
        "pid": data.pid,
        "warranty_id": warranty["warranty_id"] if warranty else None,
        "project_id": project["project_id"] if project else None,
        "project_name": project["project_name"] if project else None,
        "customer_name": data.customer_name,
        "customer_phone": data.customer_phone,
        "customer_email": data.customer_email,
        "customer_address": data.customer_address,
        "issue_category": data.issue_category,
        "issue_description": data.issue_description,
        "issue_images": data.issue_images or [],
        "priority": data.priority or "Medium",
        "warranty_status": warranty_status,
        "stage": "New",
        "assigned_technician_id": None,
        "assigned_technician_name": None,
        "sla_visit_by": sla_visit_by,
        "actual_visit_date": None,
        "expected_closure_date": None,
        "actual_closure_date": None,
        "delay_count": 0,
        "delays": [],
        "last_delay_reason": None,
        "last_delay_owner": None,
        "before_photos": [],
        "after_photos": [],
        "technician_notes": [],
        "spare_parts": [],
        "timeline": [{
            "id": f"timeline_{uuid.uuid4().hex[:8]}",
            "action": "Service Request Created",
            "stage": "New",
            "user_id": user.user_id,
            "user_name": user.name,
            "timestamp": now.isoformat()
        }],
        "comments": [],
        "source": "Internal",
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.service_requests.insert_one(service_request)
    
    # Update warranty with service request reference
    if warranty:
        await db.warranties.update_one(
            {"warranty_id": warranty["warranty_id"]},
            {"$push": {"service_requests": service_request_id}}
        )
    
    return {
        "success": True,
        "service_request_id": service_request_id,
        "message": "Service request created successfully"
    }

@api_router.post("/service-requests/from-google-form")
async def create_service_request_from_google_form(data: ServiceRequestFromGoogleForm):
    """Create service request from Google Form submission (no auth required)"""
    now = datetime.now(timezone.utc)
    service_request_id = f"SR-{uuid.uuid4().hex[:8].upper()}"
    sla_visit_by = (now + timedelta(hours=72)).isoformat()
    
    # Try to find project and warranty by PID
    project = None
    warranty = None
    warranty_status = "Unknown"
    customer_address = None
    customer_email = None
    
    if data.pid:
        project = await db.projects.find_one({"pid": data.pid}, {"_id": 0})
        if project:
            warranty = await db.warranties.find_one({"pid": data.pid}, {"_id": 0})
            customer_address = project.get("client_address")
            customer_email = project.get("client_email")
            if warranty:
                end_date = datetime.strptime(warranty["warranty_end_date"], "%Y-%m-%d")
                warranty_status = "Active" if end_date > now.replace(tzinfo=None) else "Expired"
    
    # Convert image URLs to proper format
    issue_images = []
    for url in (data.image_urls or []):
        issue_images.append({
            "url": url,
            "uploaded_at": now.isoformat(),
            "uploaded_by": "Google Form"
        })
    
    service_request = {
        "service_request_id": service_request_id,
        "pid": data.pid,
        "warranty_id": warranty["warranty_id"] if warranty else None,
        "project_id": project["project_id"] if project else None,
        "project_name": project["project_name"] if project else None,
        "customer_name": data.name,
        "customer_phone": data.phone,
        "customer_email": customer_email,
        "customer_address": customer_address,
        "issue_category": "Other",  # Default for Google Form
        "issue_description": data.issue_description,
        "issue_images": issue_images,
        "priority": "Medium",
        "warranty_status": warranty_status,
        "stage": "New",
        "assigned_technician_id": None,
        "assigned_technician_name": None,
        "sla_visit_by": sla_visit_by,
        "actual_visit_date": None,
        "expected_closure_date": None,
        "actual_closure_date": None,
        "delay_count": 0,
        "delays": [],
        "last_delay_reason": None,
        "last_delay_owner": None,
        "before_photos": [],
        "after_photos": [],
        "technician_notes": [],
        "spare_parts": [],
        "timeline": [{
            "id": f"timeline_{uuid.uuid4().hex[:8]}",
            "action": "Service Request Created via Google Form",
            "stage": "New",
            "user_id": "google_form",
            "user_name": "Google Form",
            "timestamp": now.isoformat()
        }],
        "comments": [],
        "source": "Google Form",
        "created_by": "google_form",
        "created_by_name": "Google Form",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.service_requests.insert_one(service_request)
    
    # Update warranty with service request reference
    if warranty:
        await db.warranties.update_one(
            {"warranty_id": warranty["warranty_id"]},
            {"$push": {"service_requests": service_request_id}}
        )
    
    return {
        "success": True,
        "service_request_id": service_request_id,
        "message": "Service request created from Google Form"
    }

@api_router.put("/service-requests/{request_id}/assign")
async def assign_technician(request_id: str, data: ServiceRequestAssignTechnician, request: Request):
    """Assign a technician to a service request"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "SalesManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="You don't have permission to assign technicians")
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Get technician details
    technician = await db.users.find_one({"user_id": data.technician_id}, {"_id": 0})
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    if technician.get("role") != "Technician":
        raise HTTPException(status_code=400, detail="Selected user is not a Technician")
    
    now = datetime.now(timezone.utc)
    
    timeline_entry = {
        "id": f"timeline_{uuid.uuid4().hex[:8]}",
        "action": f"Assigned to Technician: {technician['name']}",
        "stage": "Assigned to Technician",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat()
    }
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$set": {
                "assigned_technician_id": data.technician_id,
                "assigned_technician_name": technician["name"],
                "stage": "Assigned to Technician",
                "updated_at": now.isoformat()
            },
            "$push": {"timeline": timeline_entry}
        }
    )
    
    return {
        "success": True,
        "message": f"Assigned to {technician['name']}",
        "technician_name": technician["name"]
    }

@api_router.put("/service-requests/{request_id}/stage")
async def update_service_request_stage(request_id: str, data: ServiceRequestStageUpdate, request: Request):
    """Update service request stage (forward-only)"""
    user = await get_current_user(request)
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Technicians can only update their assigned requests
    if user.role == "Technician" and sr.get("assigned_technician_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    current_stage = sr.get("stage", "New")
    new_stage = data.stage
    
    if new_stage not in SERVICE_REQUEST_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {SERVICE_REQUEST_STAGES}")
    
    # Validate forward-only progression
    current_index = SERVICE_REQUEST_STAGES.index(current_stage)
    new_index = SERVICE_REQUEST_STAGES.index(new_stage)
    
    if new_index <= current_index:
        raise HTTPException(status_code=400, detail="Can only move forward in stages")
    
    now = datetime.now(timezone.utc)
    update_data = {
        "stage": new_stage,
        "updated_at": now.isoformat()
    }
    
    # Handle specific stage transitions
    if new_stage == "Technician Visited":
        update_data["actual_visit_date"] = now.isoformat()
    
    if new_stage == "Closed":
        update_data["actual_closure_date"] = now.isoformat()
    
    timeline_entry = {
        "id": f"timeline_{uuid.uuid4().hex[:8]}",
        "action": f"Stage updated: {current_stage} → {new_stage}",
        "stage": new_stage,
        "user_id": user.user_id,
        "user_name": user.name,
        "notes": data.notes,
        "timestamp": now.isoformat()
    }
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$set": update_data,
            "$push": {"timeline": timeline_entry}
        }
    )
    
    return {
        "success": True,
        "stage": new_stage,
        "message": f"Stage updated to {new_stage}"
    }

@api_router.put("/service-requests/{request_id}/expected-closure")
async def set_expected_closure_date(request_id: str, data: ServiceRequestClosureDate, request: Request):
    """Set expected closure date (by technician after inspection)"""
    user = await get_current_user(request)
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Technicians can only update their assigned requests
    if user.role == "Technician" and sr.get("assigned_technician_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    
    timeline_entry = {
        "id": f"timeline_{uuid.uuid4().hex[:8]}",
        "action": f"Expected closure date set: {data.expected_closure_date}",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat()
    }
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$set": {
                "expected_closure_date": data.expected_closure_date,
                "updated_at": now.isoformat()
            },
            "$push": {"timeline": timeline_entry}
        }
    )
    
    return {
        "success": True,
        "expected_closure_date": data.expected_closure_date
    }

@api_router.post("/service-requests/{request_id}/delay")
async def log_service_request_delay(request_id: str, data: ServiceRequestDelayUpdate, request: Request):
    """Log a delay for a service request"""
    user = await get_current_user(request)
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    if data.delay_reason not in SERVICE_DELAY_REASONS:
        raise HTTPException(status_code=400, detail=f"Invalid delay reason. Must be one of: {SERVICE_DELAY_REASONS}")
    
    if data.delay_owner not in SERVICE_DELAY_OWNERS:
        raise HTTPException(status_code=400, detail=f"Invalid delay owner. Must be one of: {SERVICE_DELAY_OWNERS}")
    
    now = datetime.now(timezone.utc)
    
    delay_entry = {
        "id": f"delay_{uuid.uuid4().hex[:8]}",
        "reason": data.delay_reason,
        "owner": data.delay_owner,
        "new_expected_date": data.new_expected_date,
        "notes": data.notes,
        "logged_by": user.user_id,
        "logged_by_name": user.name,
        "logged_at": now.isoformat()
    }
    
    timeline_entry = {
        "id": f"timeline_{uuid.uuid4().hex[:8]}",
        "action": f"Delay logged: {data.delay_reason} (Owner: {data.delay_owner})",
        "type": "delay",
        "user_id": user.user_id,
        "user_name": user.name,
        "delay_reason": data.delay_reason,
        "delay_owner": data.delay_owner,
        "new_expected_date": data.new_expected_date,
        "timestamp": now.isoformat()
    }
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$set": {
                "last_delay_reason": data.delay_reason,
                "last_delay_owner": data.delay_owner,
                "expected_closure_date": data.new_expected_date,
                "updated_at": now.isoformat()
            },
            "$inc": {"delay_count": 1},
            "$push": {
                "delays": delay_entry,
                "timeline": timeline_entry
            }
        }
    )
    
    return {
        "success": True,
        "message": "Delay logged successfully",
        "delay_count": sr.get("delay_count", 0) + 1
    }

@api_router.post("/service-requests/{request_id}/photos")
async def upload_service_photos(request_id: str, request: Request):
    """Upload before/after photos"""
    user = await get_current_user(request)
    body = await request.json()
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Technicians can only update their assigned requests
    if user.role == "Technician" and sr.get("assigned_technician_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    photo_type = body.get("type")  # "before" or "after"
    photo_url = body.get("url")
    
    if photo_type not in ["before", "after"]:
        raise HTTPException(status_code=400, detail="Photo type must be 'before' or 'after'")
    
    if not photo_url:
        raise HTTPException(status_code=400, detail="Photo URL is required")
    
    now = datetime.now(timezone.utc)
    
    photo_entry = {
        "id": f"photo_{uuid.uuid4().hex[:8]}",
        "url": photo_url,
        "uploaded_by": user.user_id,
        "uploaded_by_name": user.name,
        "uploaded_at": now.isoformat()
    }
    
    field = "before_photos" if photo_type == "before" else "after_photos"
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$push": {field: photo_entry},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {
        "success": True,
        "message": f"{photo_type.capitalize()} photo uploaded",
        "photo": photo_entry
    }

@api_router.post("/service-requests/{request_id}/notes")
async def add_technician_note(request_id: str, request: Request):
    """Add a technician note"""
    user = await get_current_user(request)
    body = await request.json()
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    note_text = body.get("note")
    if not note_text:
        raise HTTPException(status_code=400, detail="Note text is required")
    
    now = datetime.now(timezone.utc)
    
    note_entry = {
        "id": f"note_{uuid.uuid4().hex[:8]}",
        "note": note_text,
        "user_id": user.user_id,
        "user_name": user.name,
        "created_at": now.isoformat()
    }
    
    timeline_entry = {
        "id": f"timeline_{uuid.uuid4().hex[:8]}",
        "action": f"Note added: {note_text[:50]}...",
        "type": "note",
        "user_id": user.user_id,
        "user_name": user.name,
        "timestamp": now.isoformat()
    }
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$push": {
                "technician_notes": note_entry,
                "timeline": timeline_entry
            },
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return {
        "success": True,
        "note": note_entry
    }

@api_router.post("/service-requests/{request_id}/comments")
async def add_service_request_comment(request_id: str, request: Request):
    """Add a comment to service request"""
    user = await get_current_user(request)
    body = await request.json()
    
    sr = await db.service_requests.find_one({"service_request_id": request_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    message = body.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    now = datetime.now(timezone.utc)
    
    comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": message,
        "created_at": now.isoformat()
    }
    
    await db.service_requests.update_one(
        {"service_request_id": request_id},
        {
            "$push": {"comments": comment},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    
    return comment

@api_router.get("/technicians")
async def list_technicians(request: Request):
    """List all technicians"""
    user = await get_current_user(request)
    
    technicians = await db.users.find(
        {"role": "Technician", "status": "Active"},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1}
    ).to_list(100)
    
    # Add service request counts
    for tech in technicians:
        open_count = await db.service_requests.count_documents({
            "assigned_technician_id": tech["user_id"],
            "stage": {"$nin": ["Completed", "Closed"]}
        })
        tech["open_requests"] = open_count
    
    return technicians


# ============ GLOBAL SEARCH ENDPOINT ============

@api_router.get("/global-search")
async def global_search(q: str, request: Request):
    """
    Smart global search across all modules with partial match, contains search,
    case-insensitive, and multi-field matching.
    """
    user = await get_current_user(request)
    
    if not q or len(q) < 2:
        return []
    
    # Build regex pattern for partial/contains match (case-insensitive)
    pattern = {"$regex": q, "$options": "i"}
    results = []
    
    # Search Leads
    if user.role not in ["Technician"]:
        lead_query = {"$or": [
            {"customer_name": pattern},
            {"customer_phone": pattern},
            {"customer_email": pattern},
            {"customer_address": pattern},
            {"pid": pattern},
            {"customer_requirements": pattern},
            {"source": pattern}
        ]}
        
        leads = await db.leads.find(lead_query, {"_id": 0}).limit(10).to_list(10)
        for lead in leads:
            results.append({
                "type": "lead",
                "id": lead.get("lead_id"),
                "title": lead.get("customer_name", "Unknown"),
                "subtitle": f"{lead.get('customer_phone', '')} • {lead.get('source', '')}",
                "pid": lead.get("pid"),
                "stage": lead.get("stage")
            })
    
    # Search Pre-Sales
    if user.role not in ["Technician", "Designer"]:
        presales_query = {"$or": [
            {"customer_name": pattern},
            {"customer_phone": pattern},
            {"customer_email": pattern},
            {"customer_address": pattern},
            {"source": pattern},
            {"notes": pattern}
        ]}
        
        presales = await db.presales.find(presales_query, {"_id": 0}).limit(10).to_list(10)
        for ps in presales:
            results.append({
                "type": "presales",
                "id": ps.get("presales_id"),
                "title": ps.get("customer_name", "Unknown"),
                "subtitle": f"{ps.get('customer_phone', '')} • {ps.get('status', '')}",
                "pid": None,
                "stage": ps.get("status")
            })
    
    # Search Projects
    if user.role not in ["Technician", "PreSales"]:
        project_query = {"$or": [
            {"project_name": pattern},
            {"client_name": pattern},
            {"client_phone": pattern},
            {"client_email": pattern},
            {"client_address": pattern},
            {"pid": pattern},
            {"summary": pattern}
        ]}
        
        projects = await db.projects.find(project_query, {"_id": 0}).limit(10).to_list(10)
        for proj in projects:
            results.append({
                "type": "project",
                "id": proj.get("project_id"),
                "title": proj.get("project_name", "Unknown"),
                "subtitle": f"{proj.get('client_name', '')} • {proj.get('stage', '')}",
                "pid": proj.get("pid"),
                "stage": proj.get("stage")
            })
    
    # Search Warranties
    if user.role not in ["Technician"]:
        warranty_query = {"$or": [
            {"pid": pattern},
            {"project_name": pattern},
            {"customer_name": pattern},
            {"customer_phone": pattern},
            {"customer_email": pattern},
            {"customer_address": pattern},
            {"warranty_id": pattern}
        ]}
        
        warranties = await db.warranties.find(warranty_query, {"_id": 0}).limit(5).to_list(5)
        for warranty in warranties:
            results.append({
                "type": "warranty",
                "id": warranty.get("warranty_id"),
                "project_id": warranty.get("project_id"),
                "title": f"Warranty: {warranty.get('customer_name', 'Unknown')}",
                "subtitle": f"{warranty.get('project_name', '')} • {warranty.get('warranty_status', '')}",
                "pid": warranty.get("pid"),
                "stage": warranty.get("warranty_status")
            })
    
    # Search Service Requests
    sr_query = {"$or": [
        {"service_request_id": pattern},
        {"pid": pattern},
        {"customer_name": pattern},
        {"customer_phone": pattern},
        {"customer_email": pattern},
        {"customer_address": pattern},
        {"issue_category": pattern},
        {"issue_description": pattern},
        {"assigned_technician_name": pattern}
    ]}
    
    # Technicians can only see their assigned requests
    if user.role == "Technician":
        sr_query = {"$and": [sr_query, {"assigned_technician_id": user.user_id}]}
    
    service_requests = await db.service_requests.find(sr_query, {"_id": 0}).limit(10).to_list(10)
    for sr in service_requests:
        results.append({
            "type": "service_request",
            "id": sr.get("service_request_id"),
            "title": f"{sr.get('service_request_id', '')} - {sr.get('customer_name', 'Unknown')}",
            "subtitle": f"{sr.get('issue_category', '')} • {sr.get('stage', '')}",
            "pid": sr.get("pid"),
            "stage": sr.get("stage")
        })
    
    # Search Technicians (only for Admin/Manager)
    if user.role in ["Admin", "SalesManager", "ProductionOpsManager"]:
        tech_query = {"role": "Technician", "$or": [
            {"name": pattern},
            {"email": pattern},
            {"phone": pattern}
        ]}
        
        technicians = await db.users.find(tech_query, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).limit(5).to_list(5)
        for tech in technicians:
            results.append({
                "type": "technician",
                "id": tech.get("user_id"),
                "title": tech.get("name", "Unknown"),
                "subtitle": tech.get("email", ""),
                "pid": None,
                "stage": None
            })
    
    # Sort results by relevance (exact matches first)
    def sort_key(item):
        title = item.get("title", "").lower()
        pid = (item.get("pid") or "").lower()
        q_lower = q.lower()
        
        # Exact match gets highest priority
        if title == q_lower or pid == q_lower:
            return 0
        # Starts with query
        if title.startswith(q_lower) or pid.startswith(q_lower):
            return 1
        # Contains query
        return 2
    
    results.sort(key=sort_key)
    
    return results[:20]  # Limit total results


# ============ ACADEMY ENDPOINTS ============

@api_router.get("/academy/categories")
async def list_academy_categories(request: Request):
    """List all academy categories"""
    user = await get_current_user(request)
    
    categories = await db.academy_categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Add lesson count to each category
    for cat in categories:
        lesson_count = await db.academy_lessons.count_documents({"category_id": cat["category_id"]})
        cat["lesson_count"] = lesson_count
    
    return categories

@api_router.get("/academy/categories/{category_id}")
async def get_academy_category(category_id: str, request: Request):
    """Get a single academy category with its lessons"""
    user = await get_current_user(request)
    
    category = await db.academy_categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    lessons = await db.academy_lessons.find(
        {"category_id": category_id}, 
        {"_id": 0}
    ).sort("order", 1).to_list(1000)
    
    category["lessons"] = lessons
    return category

@api_router.post("/academy/categories")
async def create_academy_category(data: AcademyCategoryCreate, request: Request):
    """Create a new academy category (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can create categories")
    
    now = datetime.now(timezone.utc)
    category_id = f"cat_{uuid.uuid4().hex[:8]}"
    
    # Get max order if not provided
    if data.order == 0:
        max_order = await db.academy_categories.find_one(sort=[("order", -1)])
        data.order = (max_order.get("order", 0) + 1) if max_order else 1
    
    category = {
        "category_id": category_id,
        "name": data.name,
        "description": data.description,
        "icon": data.icon or "folder",
        "order": data.order,
        "lesson_count": 0,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.academy_categories.insert_one(category)
    
    return {
        "success": True,
        "category_id": category_id,
        "message": "Category created successfully"
    }

@api_router.put("/academy/categories/{category_id}")
async def update_academy_category(category_id: str, request: Request):
    """Update an academy category (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can update categories")
    
    body = await request.json()
    category = await db.academy_categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    now = datetime.now(timezone.utc)
    update_fields = {"updated_at": now.isoformat()}
    
    allowed_fields = ["name", "description", "icon", "order"]
    for field in allowed_fields:
        if field in body:
            update_fields[field] = body[field]
    
    await db.academy_categories.update_one(
        {"category_id": category_id},
        {"$set": update_fields}
    )
    
    updated = await db.academy_categories.find_one({"category_id": category_id}, {"_id": 0})
    return updated

@api_router.delete("/academy/categories/{category_id}")
async def delete_academy_category(category_id: str, request: Request):
    """Delete an academy category and all its lessons (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can delete categories")
    
    category = await db.academy_categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Delete all lessons in this category
    await db.academy_lessons.delete_many({"category_id": category_id})
    
    # Delete the category
    await db.academy_categories.delete_one({"category_id": category_id})
    
    return {"success": True, "message": "Category and all lessons deleted"}

@api_router.get("/academy/lessons")
async def list_academy_lessons(request: Request, category_id: Optional[str] = None):
    """List all lessons, optionally filtered by category"""
    user = await get_current_user(request)
    
    query = {}
    if category_id:
        query["category_id"] = category_id
    
    lessons = await db.academy_lessons.find(query, {"_id": 0}).sort("order", 1).to_list(1000)
    return lessons

@api_router.get("/academy/lessons/{lesson_id}")
async def get_academy_lesson(lesson_id: str, request: Request):
    """Get a single lesson"""
    user = await get_current_user(request)
    
    lesson = await db.academy_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return lesson

@api_router.post("/academy/lessons")
async def create_academy_lesson(data: AcademyLessonCreate, request: Request):
    """Create a new lesson (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can create lessons")
    
    # Verify category exists
    category = await db.academy_categories.find_one({"category_id": data.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    now = datetime.now(timezone.utc)
    lesson_id = f"lesson_{uuid.uuid4().hex[:8]}"
    
    # Get max order if not provided
    if data.order == 0:
        max_order = await db.academy_lessons.find_one(
            {"category_id": data.category_id},
            sort=[("order", -1)]
        )
        data.order = (max_order.get("order", 0) + 1) if max_order else 1
    
    lesson = {
        "lesson_id": lesson_id,
        "category_id": data.category_id,
        "title": data.title,
        "description": data.description,
        "content_type": data.content_type,
        "video_url": data.video_url,
        "video_type": data.video_type,
        "pdf_url": data.pdf_url,
        "text_content": data.text_content,
        "images": data.images or [],
        "order": data.order,
        "duration_minutes": data.duration_minutes,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.academy_lessons.insert_one(lesson)
    
    return {
        "success": True,
        "lesson_id": lesson_id,
        "message": "Lesson created successfully"
    }

@api_router.put("/academy/lessons/{lesson_id}")
async def update_academy_lesson(lesson_id: str, data: AcademyLessonUpdate, request: Request):
    """Update a lesson (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can update lessons")
    
    lesson = await db.academy_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    now = datetime.now(timezone.utc)
    update_fields = {"updated_at": now.isoformat()}
    
    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            update_fields[field] = value
    
    await db.academy_lessons.update_one(
        {"lesson_id": lesson_id},
        {"$set": update_fields}
    )
    
    updated = await db.academy_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    return updated

@api_router.delete("/academy/lessons/{lesson_id}")
async def delete_academy_lesson(lesson_id: str, request: Request):
    """Delete a lesson (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can delete lessons")
    
    lesson = await db.academy_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    await db.academy_lessons.delete_one({"lesson_id": lesson_id})
    
    return {"success": True, "message": "Lesson deleted"}

@api_router.post("/academy/seed")
async def seed_academy_categories(request: Request):
    """Seed default academy categories (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can seed categories")
    
    now = datetime.now(timezone.utc)
    created_count = 0
    
    for cat_data in DEFAULT_ACADEMY_CATEGORIES:
        # Check if category already exists
        existing = await db.academy_categories.find_one({"name": cat_data["name"]}, {"_id": 0})
        if not existing:
            category = {
                "category_id": f"cat_{uuid.uuid4().hex[:8]}",
                "name": cat_data["name"],
                "description": cat_data["description"],
                "icon": cat_data["icon"],
                "order": cat_data["order"],
                "lesson_count": 0,
                "created_by": user.user_id,
                "created_by_name": user.name,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            await db.academy_categories.insert_one(category)
            created_count += 1
    
    return {
        "success": True,
        "message": f"Created {created_count} categories",
        "total_categories": len(DEFAULT_ACADEMY_CATEGORIES)
    }


# ============ ACADEMY FILE UPLOAD ENDPOINTS ============

@api_router.post("/academy/upload")
async def upload_academy_file(request: Request, file: UploadFile = File(...)):
    """
    Upload a file (video, PDF, image) for Academy lessons.
    Only Admin/Manager roles can upload.
    Files are stored locally and served to authenticated users only.
    """
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can upload files")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Get file extension
    file_ext = Path(file.filename).suffix.lower()
    
    # Determine file type and validate extension
    if file_ext in ALLOWED_VIDEO_EXTENSIONS:
        file_type = "video"
    elif file_ext in ALLOWED_PDF_EXTENSIONS:
        file_type = "pdf"
    elif file_ext in ALLOWED_IMAGE_EXTENSIONS:
        file_type = "image"
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed: videos ({', '.join(ALLOWED_VIDEO_EXTENSIONS)}), PDFs (.pdf), images ({', '.join(ALLOWED_IMAGE_EXTENSIONS)})"
        )
    
    # Generate unique filename
    unique_id = uuid.uuid4().hex[:12]
    safe_filename = f"{unique_id}{file_ext}"
    file_path = UPLOADS_DIR / safe_filename
    
    # Check file size (for videos, enforce limit)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(content)
    
    # Return the URL to access the file
    file_url = f"/api/academy/files/{safe_filename}"
    
    return {
        "success": True,
        "file_url": file_url,
        "file_type": file_type,
        "file_name": file.filename,
        "file_size": len(content),
        "uploaded_by": user.name
    }


@api_router.get("/academy/files/{filename}")
async def serve_academy_file(filename: str, request: Request):
    """
    Serve Academy files to authenticated users only.
    This ensures internal training content is not publicly accessible.
    """
    # Authenticate user
    user = await get_current_user(request)
    
    # Validate filename (prevent directory traversal)
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = UPLOADS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type based on extension
    ext = Path(filename).suffix.lower()
    content_types = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    
    content_type = content_types.get(ext, "application/octet-stream")
    
    return FileResponse(
        path=file_path,
        media_type=content_type,
        filename=filename
    )


@api_router.delete("/academy/files/{filename}")
async def delete_academy_file(filename: str, request: Request):
    """Delete an Academy file (Admin/Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "SalesManager", "DesignManager", "ProductionOpsManager"]:
        raise HTTPException(status_code=403, detail="Only Admin and Managers can delete files")
    
    # Validate filename
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = UPLOADS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete the file
    file_path.unlink()
    
    return {"success": True, "message": "File deleted"}



# ============================================================================
# ============ ACCOUNTING MODULE (PHASE 1) - ISOLATED FROM CRM ===============
# ============================================================================
# This module is completely separate from CRM functionality.
# It only READs Project data (PID, Name, Customer) for expense linking.
# NO modifications to CRM collections or logic.

# Pydantic Models for Accounting
class AccountCreate(BaseModel):
    account_name: str
    account_type: str  # "bank" or "cash"
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    category: str  # "Company Bank (Primary)", "Company Bank (Secondary)", "Cash-in-Hand"
    opening_balance: float = 0.0
    is_active: bool = True

class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class TransactionCreate(BaseModel):
    transaction_date: str  # ISO date string
    transaction_type: str  # "inflow" or "outflow"
    amount: float
    mode: str  # "cash", "bank_transfer", "upi", "cheque"
    category_id: str
    account_id: str
    project_id: Optional[str] = None  # Link to CRM project (read-only)
    paid_to: Optional[str] = None  # Vendor/Person name
    remarks: str
    attachment_url: Optional[str] = None

class TransactionUpdate(BaseModel):
    transaction_type: Optional[str] = None
    amount: Optional[float] = None
    mode: Optional[str] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    project_id: Optional[str] = None
    paid_to: Optional[str] = None
    remarks: Optional[str] = None
    attachment_url: Optional[str] = None


# ============ ACCOUNTING: ACCOUNTS MASTER ============

@api_router.get("/accounting/accounts")
async def list_accounting_accounts(request: Request):
    """List all accounting accounts (bank/cash)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_dashboard") and not has_permission(user_doc, "finance.view_cashbook"):
        raise HTTPException(status_code=403, detail="Access denied - no finance view permission")
    
    accounts = await db.accounting_accounts.find({}, {"_id": 0}).to_list(100)
    return accounts


@api_router.post("/accounting/accounts")
async def create_accounting_account(account: AccountCreate, request: Request):
    """Create a new accounting account (Admin only)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.manage_accounts"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.manage_accounts permission")
    
    now = datetime.now(timezone.utc)
    account_id = f"acc_{uuid.uuid4().hex[:8]}"
    
    new_account = {
        "account_id": account_id,
        "account_name": account.account_name,
        "account_type": account.account_type,
        "bank_name": account.bank_name,
        "branch": account.branch,
        "category": account.category,
        "opening_balance": account.opening_balance,
        "current_balance": account.opening_balance,
        "is_active": account.is_active,
        "created_at": now.isoformat(),
        "created_by": user.user_id,
        "updated_at": now.isoformat()
    }
    
    await db.accounting_accounts.insert_one(new_account)
    
    # Log audit entry
    audit_entry = {
        "audit_id": f"audit_{uuid.uuid4().hex[:8]}",
        "action": "account_created",
        "entity_type": "accounting_account",
        "entity_id": account_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "details": f"Created account: {account.account_name}",
        "timestamp": now.isoformat()
    }
    await db.accounting_audit_log.insert_one(audit_entry)
    
    return {**new_account, "_id": None}


@api_router.put("/accounting/accounts/{account_id}")
async def update_accounting_account(account_id: str, account: AccountUpdate, request: Request):
    """Update an accounting account"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.manage_accounts"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.manage_accounts permission")
    
    existing = await db.accounting_accounts.find_one({"account_id": account_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    
    now = datetime.now(timezone.utc)
    update_dict = {"updated_at": now.isoformat()}
    
    for field in ["account_name", "bank_name", "branch", "category", "is_active"]:
        value = getattr(account, field, None)
        if value is not None:
            update_dict[field] = value
    
    await db.accounting_accounts.update_one(
        {"account_id": account_id},
        {"$set": update_dict}
    )
    
    updated = await db.accounting_accounts.find_one({"account_id": account_id}, {"_id": 0})
    return updated


@api_router.put("/accounting/accounts/{account_id}/opening-balance")
async def set_opening_balance(account_id: str, request: Request):
    """Set opening balance for an account (Admin only, with audit log)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.set_opening_balance"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.set_opening_balance permission")
    
    body = await request.json()
    new_balance = body.get("opening_balance")
    
    if new_balance is None:
        raise HTTPException(status_code=400, detail="opening_balance is required")
    
    existing = await db.accounting_accounts.find_one({"account_id": account_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Account not found")
    
    old_balance = existing.get("opening_balance", 0)
    now = datetime.now(timezone.utc)
    
    # Calculate balance difference and update current balance
    balance_diff = new_balance - old_balance
    new_current = existing.get("current_balance", old_balance) + balance_diff
    
    await db.accounting_accounts.update_one(
        {"account_id": account_id},
        {"$set": {
            "opening_balance": new_balance,
            "current_balance": new_current,
            "updated_at": now.isoformat()
        }}
    )
    
    # Audit log
    audit_entry = {
        "audit_id": f"audit_{uuid.uuid4().hex[:8]}",
        "action": "opening_balance_set",
        "entity_type": "accounting_account",
        "entity_id": account_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "details": f"Changed opening balance from {old_balance} to {new_balance}",
        "old_value": old_balance,
        "new_value": new_balance,
        "timestamp": now.isoformat()
    }
    await db.accounting_audit_log.insert_one(audit_entry)
    
    updated = await db.accounting_accounts.find_one({"account_id": account_id}, {"_id": 0})
    return {"success": True, "account": updated}


# ============ ACCOUNTING: EXPENSE CATEGORIES ============

@api_router.get("/accounting/categories")
async def list_accounting_categories(request: Request):
    """List all expense categories"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_dashboard") and not has_permission(user_doc, "finance.add_transaction"):
        raise HTTPException(status_code=403, detail="Access denied - no finance permission")
    
    categories = await db.accounting_categories.find({}, {"_id": 0}).to_list(100)
    
    # If no categories exist, create defaults
    if not categories:
        default_categories = [
            {"name": "Project Expenses", "description": "Expenses linked to specific projects"},
            {"name": "Office Expenses", "description": "General office running costs"},
            {"name": "Sales & Marketing", "description": "Marketing and promotional expenses"},
            {"name": "Travel / TA", "description": "Travel and transportation allowances"},
            {"name": "Site Expenses", "description": "On-site operational costs"},
            {"name": "Miscellaneous", "description": "Other uncategorized expenses"}
        ]
        
        now = datetime.now(timezone.utc)
        for cat in default_categories:
            cat_id = f"cat_{uuid.uuid4().hex[:8]}"
            await db.accounting_categories.insert_one({
                "category_id": cat_id,
                "name": cat["name"],
                "description": cat["description"],
                "is_active": True,
                "created_at": now.isoformat()
            })
        
        categories = await db.accounting_categories.find({}, {"_id": 0}).to_list(100)
    
    return categories


@api_router.post("/accounting/categories")
async def create_accounting_category(category: CategoryCreate, request: Request):
    """Create a new expense category"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.manage_categories"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.manage_categories permission")
    
    now = datetime.now(timezone.utc)
    cat_id = f"cat_{uuid.uuid4().hex[:8]}"
    
    new_category = {
        "category_id": cat_id,
        "name": category.name,
        "description": category.description,
        "is_active": category.is_active,
        "created_at": now.isoformat(),
        "created_by": user.user_id
    }
    
    await db.accounting_categories.insert_one(new_category)
    return {**new_category, "_id": None}


@api_router.put("/accounting/categories/{category_id}")
async def update_accounting_category(category_id: str, request: Request):
    """Update an expense category"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.manage_categories"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.manage_categories permission")
    
    body = await request.json()
    
    existing = await db.accounting_categories.find_one({"category_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ["name", "description", "is_active"]:
        if field in body:
            update_dict[field] = body[field]
    
    await db.accounting_categories.update_one(
        {"category_id": category_id},
        {"$set": update_dict}
    )
    
    updated = await db.accounting_categories.find_one({"category_id": category_id}, {"_id": 0})
    return updated


# ============ ACCOUNTING: TRANSACTIONS (CASH BOOK / DAY BOOK) ============

@api_router.get("/accounting/transactions")
async def list_transactions(
    request: Request,
    date: Optional[str] = None,
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    project_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """List transactions (Cash Book view)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_cashbook") and not has_permission(user_doc, "finance.view_bankbook"):
        raise HTTPException(status_code=403, detail="Access denied - no finance view permission")
    
    query = {}
    
    if date:
        query["transaction_date"] = {"$regex": f"^{date}"}
    elif start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        if date_filter:
            query["transaction_date"] = date_filter
    
    if account_id:
        query["account_id"] = account_id
    if category_id:
        query["category_id"] = category_id
    if project_id:
        query["project_id"] = project_id
    
    transactions = await db.accounting_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    accounts = {a["account_id"]: a for a in await db.accounting_accounts.find({}, {"_id": 0}).to_list(100)}
    categories = {c["category_id"]: c for c in await db.accounting_categories.find({}, {"_id": 0}).to_list(100)}
    
    for txn in transactions:
        txn["account_name"] = accounts.get(txn.get("account_id"), {}).get("account_name", "Unknown")
        txn["category_name"] = categories.get(txn.get("category_id"), {}).get("name", "Unknown")
        
        if txn.get("project_id"):
            project = await db.projects.find_one(
                {"project_id": txn["project_id"]},
                {"_id": 0, "pid": 1, "project_name": 1, "client_name": 1}
            )
            if project:
                txn["project_pid"] = project.get("pid", "").replace("ARKI-", "")
                txn["project_name"] = project.get("project_name", "")
                txn["client_name"] = project.get("client_name", "")
    
    return transactions


@api_router.post("/accounting/transactions")
async def create_transaction(txn: TransactionCreate, request: Request):
    """Create a new transaction entry"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.add_transaction"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.add_transaction permission")
    
    if not txn.remarks or not txn.remarks.strip():
        raise HTTPException(status_code=400, detail="Remarks is required")
    
    if txn.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    txn_date = txn.transaction_date[:10]
    daily_closing = await db.accounting_daily_closings.find_one({"date": txn_date, "is_locked": True})
    if daily_closing:
        raise HTTPException(status_code=400, detail=f"Day {txn_date} is locked. Cannot add transactions.")
    
    account = await db.accounting_accounts.find_one({"account_id": txn.account_id})
    if not account:
        raise HTTPException(status_code=400, detail="Invalid account")
    
    category = await db.accounting_categories.find_one({"category_id": txn.category_id})
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    if txn.project_id:
        project = await db.projects.find_one({"project_id": txn.project_id})
        if not project:
            raise HTTPException(status_code=400, detail="Invalid project ID")
    
    now = datetime.now(timezone.utc)
    txn_id = f"txn_{uuid.uuid4().hex[:8]}"
    
    new_txn = {
        "transaction_id": txn_id,
        "transaction_date": txn.transaction_date,
        "transaction_type": txn.transaction_type,
        "amount": txn.amount,
        "mode": txn.mode,
        "category_id": txn.category_id,
        "account_id": txn.account_id,
        "project_id": txn.project_id,
        "paid_to": txn.paid_to,
        "remarks": txn.remarks,
        "attachment_url": txn.attachment_url,
        "is_verified": False,
        "verified_by": None,
        "verified_at": None,
        "created_at": now.isoformat(),
        "created_by": user.user_id,
        "created_by_name": user.name,
        "updated_at": now.isoformat()
    }
    
    await db.accounting_transactions.insert_one(new_txn)
    
    balance_change = txn.amount if txn.transaction_type == "inflow" else -txn.amount
    await db.accounting_accounts.update_one(
        {"account_id": txn.account_id},
        {"$inc": {"current_balance": balance_change}}
    )
    
    return {**new_txn, "_id": None}


@api_router.put("/accounting/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, txn: TransactionUpdate, request: Request):
    """Update a transaction (only if day is not locked)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.edit_transaction"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.edit_transaction permission")
    
    existing = await db.accounting_transactions.find_one({"transaction_id": transaction_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    txn_date = existing.get("transaction_date", "")[:10]
    daily_closing = await db.accounting_daily_closings.find_one({"date": txn_date, "is_locked": True})
    if daily_closing:
        raise HTTPException(status_code=400, detail=f"Day {txn_date} is locked. Cannot edit transactions.")
    
    now = datetime.now(timezone.utc)
    update_dict = {"updated_at": now.isoformat()}
    
    old_amount = existing.get("amount", 0)
    old_type = existing.get("transaction_type")
    old_account_id = existing.get("account_id")
    
    for field in ["transaction_type", "amount", "mode", "category_id", "account_id", "project_id", "paid_to", "remarks", "attachment_url"]:
        value = getattr(txn, field, None)
        if value is not None:
            update_dict[field] = value
    
    await db.accounting_transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": update_dict}
    )
    
    new_amount = update_dict.get("amount", old_amount)
    new_type = update_dict.get("transaction_type", old_type)
    new_account_id = update_dict.get("account_id", old_account_id)
    
    old_balance_change = old_amount if old_type == "inflow" else -old_amount
    await db.accounting_accounts.update_one(
        {"account_id": old_account_id},
        {"$inc": {"current_balance": -old_balance_change}}
    )
    
    new_balance_change = new_amount if new_type == "inflow" else -new_amount
    await db.accounting_accounts.update_one(
        {"account_id": new_account_id},
        {"$inc": {"current_balance": new_balance_change}}
    )
    
    updated = await db.accounting_transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    return updated


@api_router.delete("/accounting/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, request: Request):
    """Delete a transaction (only if day is not locked)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.delete_transaction"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.delete_transaction permission")
    
    existing = await db.accounting_transactions.find_one({"transaction_id": transaction_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    txn_date = existing.get("transaction_date", "")[:10]
    daily_closing = await db.accounting_daily_closings.find_one({"date": txn_date, "is_locked": True})
    if daily_closing:
        raise HTTPException(status_code=400, detail=f"Day {txn_date} is locked. Cannot delete transactions.")
    
    old_amount = existing.get("amount", 0)
    old_type = existing.get("transaction_type")
    old_account_id = existing.get("account_id")
    
    old_balance_change = old_amount if old_type == "inflow" else -old_amount
    await db.accounting_accounts.update_one(
        {"account_id": old_account_id},
        {"$inc": {"current_balance": -old_balance_change}}
    )
    
    await db.accounting_transactions.delete_one({"transaction_id": transaction_id})
    
    return {"success": True, "message": "Transaction deleted"}


@api_router.put("/accounting/transactions/{transaction_id}/verify")
async def verify_transaction(transaction_id: str, request: Request):
    """Verify a transaction"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.verify_transaction"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.verify_transaction permission")
    
    existing = await db.accounting_transactions.find_one({"transaction_id": transaction_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    now = datetime.now(timezone.utc)
    
    await db.accounting_transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {
            "is_verified": True,
            "verified_by": user.user_id,
            "verified_by_name": user.name,
            "verified_at": now.isoformat()
        }}
    )
    
    updated = await db.accounting_transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    return updated


# ============ ACCOUNTING: DAILY CLOSING ============

@api_router.get("/accounting/daily-summary/{date}")
async def get_daily_summary(date: str, request: Request):
    """Get daily summary with opening/closing balances"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_cashbook"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.view_cashbook permission")
    
    accounts = await db.accounting_accounts.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    transactions = await db.accounting_transactions.find(
        {"transaction_date": {"$regex": f"^{date}"}},
        {"_id": 0}
    ).to_list(1000)
    
    total_inflow = sum(t["amount"] for t in transactions if t.get("transaction_type") == "inflow")
    total_outflow = sum(t["amount"] for t in transactions if t.get("transaction_type") == "outflow")
    
    account_summaries = []
    for acc in accounts:
        acc_txns = [t for t in transactions if t.get("account_id") == acc["account_id"]]
        acc_inflow = sum(t["amount"] for t in acc_txns if t.get("transaction_type") == "inflow")
        acc_outflow = sum(t["amount"] for t in acc_txns if t.get("transaction_type") == "outflow")
        
        day_net = acc_inflow - acc_outflow
        opening_balance = acc["current_balance"] - day_net
        closing_balance = acc["current_balance"]
        
        account_summaries.append({
            "account_id": acc["account_id"],
            "account_name": acc["account_name"],
            "account_type": acc["account_type"],
            "opening_balance": opening_balance,
            "inflow": acc_inflow,
            "outflow": acc_outflow,
            "closing_balance": closing_balance
        })
    
    daily_closing = await db.accounting_daily_closings.find_one({"date": date})
    
    return {
        "date": date,
        "is_locked": daily_closing.get("is_locked", False) if daily_closing else False,
        "locked_by": daily_closing.get("locked_by_name") if daily_closing else None,
        "locked_at": daily_closing.get("locked_at") if daily_closing else None,
        "total_inflow": total_inflow,
        "total_outflow": total_outflow,
        "net_change": total_inflow - total_outflow,
        "transaction_count": len(transactions),
        "accounts": account_summaries
    }


@api_router.post("/accounting/close-day/{date}")
async def close_day(date: str, request: Request):
    """Lock a day's transactions (Admin only)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.close_day"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.close_day permission")
    
    existing = await db.accounting_daily_closings.find_one({"date": date})
    if existing and existing.get("is_locked"):
        raise HTTPException(status_code=400, detail=f"Day {date} is already locked")
    
    now = datetime.now(timezone.utc)
    
    transactions = await db.accounting_transactions.find(
        {"transaction_date": {"$regex": f"^{date}"}},
        {"_id": 0}
    ).to_list(1000)
    
    total_inflow = sum(t["amount"] for t in transactions if t.get("transaction_type") == "inflow")
    total_outflow = sum(t["amount"] for t in transactions if t.get("transaction_type") == "outflow")
    
    closing_record = {
        "date": date,
        "is_locked": True,
        "locked_by": user.user_id,
        "locked_by_name": user.name,
        "locked_at": now.isoformat(),
        "summary": {
            "total_inflow": total_inflow,
            "total_outflow": total_outflow,
            "transaction_count": len(transactions)
        }
    }
    
    if existing:
        await db.accounting_daily_closings.update_one(
            {"date": date},
            {"$set": closing_record}
        )
    else:
        await db.accounting_daily_closings.insert_one(closing_record)
    
    audit_entry = {
        "audit_id": f"audit_{uuid.uuid4().hex[:8]}",
        "action": "day_closed",
        "entity_type": "daily_closing",
        "entity_id": date,
        "user_id": user.user_id,
        "user_name": user.name,
        "details": f"Closed day {date} with {len(transactions)} transactions",
        "timestamp": now.isoformat()
    }
    await db.accounting_audit_log.insert_one(audit_entry)
    
    # Remove _id from closing_record if present (added by insert_one)
    closing_record.pop("_id", None)
    
    return {"success": True, "message": f"Day {date} has been locked", "closing": closing_record}


# ============ ACCOUNTING: REPORTS ============

@api_router.get("/accounting/reports/project-expenses")
async def report_project_expenses(request: Request, project_id: Optional[str] = None):
    """Get project-wise expense summary"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_reports"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.view_reports permission")
    
    query = {"project_id": {"$ne": None}}
    if project_id:
        query["project_id"] = project_id
    
    transactions = await db.accounting_transactions.find(query, {"_id": 0}).to_list(10000)
    
    project_map = {}
    for txn in transactions:
        pid = txn.get("project_id")
        if pid not in project_map:
            project_map[pid] = {"project_id": pid, "inflow": 0, "outflow": 0, "transactions": []}
        
        if txn.get("transaction_type") == "inflow":
            project_map[pid]["inflow"] += txn.get("amount", 0)
        else:
            project_map[pid]["outflow"] += txn.get("amount", 0)
        
        project_map[pid]["transactions"].append(txn)
    
    result = []
    for pid, data in project_map.items():
        project = await db.projects.find_one(
            {"project_id": pid},
            {"_id": 0, "pid": 1, "project_name": 1, "client_name": 1}
        )
        if project:
            data["project_pid"] = project.get("pid", "").replace("ARKI-", "")
            data["project_name"] = project.get("project_name", "")
            data["client_name"] = project.get("client_name", "")
        data["net"] = data["inflow"] - data["outflow"]
        result.append(data)
    
    return result


@api_router.get("/accounting/reports/category-summary")
async def report_category_summary(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get category-wise expense summary"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_reports"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.view_reports permission")
    
    query = {}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        query["transaction_date"] = date_filter
    
    transactions = await db.accounting_transactions.find(query, {"_id": 0}).to_list(10000)
    categories = {c["category_id"]: c for c in await db.accounting_categories.find({}, {"_id": 0}).to_list(100)}
    
    cat_map = {}
    for txn in transactions:
        cat_id = txn.get("category_id")
        if cat_id not in cat_map:
            cat_info = categories.get(cat_id, {})
            cat_map[cat_id] = {
                "category_id": cat_id,
                "category_name": cat_info.get("name", "Unknown"),
                "inflow": 0,
                "outflow": 0,
                "count": 0
            }
        
        if txn.get("transaction_type") == "inflow":
            cat_map[cat_id]["inflow"] += txn.get("amount", 0)
        else:
            cat_map[cat_id]["outflow"] += txn.get("amount", 0)
        cat_map[cat_id]["count"] += 1
    
    result = list(cat_map.values())
    for r in result:
        r["net"] = r["inflow"] - r["outflow"]
    
    return sorted(result, key=lambda x: x["outflow"], reverse=True)


@api_router.get("/accounting/reports/account-balances")
async def report_account_balances(request: Request):
    """Get current balance of all accounts"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.view_reports"):
        raise HTTPException(status_code=403, detail="Access denied - no finance.view_reports permission")
    
    accounts = await db.accounting_accounts.find({}, {"_id": 0}).to_list(100)
    
    total_balance = sum(a.get("current_balance", 0) for a in accounts if a.get("is_active"))
    
    return {
        "accounts": accounts,
        "total_balance": total_balance
    }


@api_router.get("/accounting/projects-list")
async def get_projects_for_accounting(request: Request, search: Optional[str] = None):
    """Get list of projects for expense linking (READ ONLY from CRM)"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not has_permission(user_doc, "finance.add_transaction"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if search:
        query["$or"] = [
            {"pid": {"$regex": search, "$options": "i"}},
            {"project_name": {"$regex": search, "$options": "i"}},
            {"client_name": {"$regex": search, "$options": "i"}}
        ]
    
    projects = await db.projects.find(
        query,
        {"_id": 0, "project_id": 1, "pid": 1, "project_name": 1, "client_name": 1}
    ).to_list(500)
    
    for p in projects:
        p["pid_display"] = p.get("pid", "").replace("ARKI-", "")
    
    return projects


# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "Arkiflo API is running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
