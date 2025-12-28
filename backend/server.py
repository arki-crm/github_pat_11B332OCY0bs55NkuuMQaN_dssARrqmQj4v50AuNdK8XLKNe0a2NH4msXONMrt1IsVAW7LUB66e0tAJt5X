from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
    role: str = "Designer"  # Admin, PreSales, Designer, Manager
    created_at: datetime

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str

class SessionRequest(BaseModel):
    session_id: str

class RoleUpdateRequest(BaseModel):
    role: str

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

# Stage order for timeline logic - 6 main stages
STAGE_ORDER = [
    "Design Finalization",
    "Production Preparation",
    "Production",
    "Delivery",
    "Installation",
    "Handover"
]

# Milestone groups mapped to stages
MILESTONE_GROUPS = {
    "Design Finalization": [
        "Site Measurement",
        "Site Validation",
        "Design Meeting",
        "Design Meeting – 2",
        "Final Design Proposal & Material Selection",
        "Sign-off KWS Units & Payment",
        "Kickoff Meeting"
    ],
    "Production Preparation": [
        "Factory Slot Allocation",
        "JIT Project Delivery Plan",
        "Non-Modular Dependencies",
        "Raw Material Procurement"
    ],
    "Production": [
        "Production Kick-start",
        "Full Order Confirmation",
        "PIV / Site Readiness"
    ],
    "Delivery": [
        "Modular Order Delivery at Site"
    ],
    "Installation": [
        "Modular Installation",
        "Non-Modular Dependency Work for Handover"
    ],
    "Handover": [
        "Handover with Snag",
        "Cleaning",
        "Handover Without Snag"
    ]
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
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info if changed
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
            role = existing_user["role"]
        else:
            # Check if this is the first user (becomes Admin)
            user_count = await db.users.count_documents({})
            role = "Admin" if user_count == 0 else "Designer"
            
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": role,
                "created_at": datetime.now(timezone.utc).isoformat()
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

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role
    )

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============ USER MANAGEMENT (Admin only) ============

@api_router.get("/auth/users", response_model=List[UserResponse])
async def list_users(request: Request):
    """List all users (Admin only)"""
    await require_admin(request)
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(
        user_id=u["user_id"],
        email=u["email"],
        name=u["name"],
        picture=u.get("picture"),
        role=u["role"]
    ) for u in users]

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(user_id: str, role_update: RoleUpdateRequest, request: Request):
    """Update user role (Admin only)"""
    await require_admin(request)
    
    valid_roles = ["Admin", "PreSales", "Designer", "Manager"]
    if role_update.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role_update.role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated successfully", "role": role_update.role}

# ============ PROJECT ENDPOINTS ============

@api_router.get("/projects")
async def list_projects(request: Request, stage: Optional[str] = None, search: Optional[str] = None):
    """List projects - Designer sees only assigned, Admin/Manager sees all"""
    user = await get_current_user(request)
    
    # Build query
    query = {}
    
    # Role-based filtering: Designer only sees assigned projects
    if user.role == "Designer":
        query["collaborators"] = user.user_id
    
    # Stage filter
    if stage and stage != "all":
        query["stage"] = stage
    
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
            "project_name": p["project_name"],
            "client_name": p["client_name"],
            "client_phone": p["client_phone"],
            "stage": p["stage"],
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
        "project_name": project["project_name"],
        "client_name": project["client_name"],
        "client_phone": project["client_phone"],
        "stage": project["stage"],
        "collaborators": collaborator_details,
        "summary": project.get("summary", ""),
        "timeline": project.get("timeline", []),
        "comments": project.get("comments", []),
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
    
    return new_comment

@api_router.put("/projects/{project_id}/stage")
async def update_stage(project_id: str, stage_update: StageUpdate, request: Request):
    """Update project stage"""
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
    
    old_stage = project.get("stage", "Pre 10%")
    new_stage = stage_update.stage
    
    if old_stage == new_stage:
        return {"message": "Stage unchanged", "stage": new_stage}
    
    # Create system comment for stage change
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Stage updated from \"{old_stage}\" to \"{new_stage}\"",
        "is_system": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update timeline based on new stage
    timeline = project.get("timeline", [])
    new_stage_index = STAGE_ORDER.index(new_stage)
    
    for item in timeline:
        item_stage = item.get("stage_ref", "")
        if item_stage in STAGE_ORDER:
            item_index = STAGE_ORDER.index(item_stage)
            if item_index <= new_stage_index:
                item["status"] = "completed"
            else:
                # Check if delayed
                expected_date = item.get("date", "")
                if expected_date:
                    try:
                        expected = datetime.fromisoformat(expected_date.replace("Z", "+00:00"))
                        if expected.tzinfo is None:
                            expected = expected.replace(tzinfo=timezone.utc)
                        if expected < datetime.now(timezone.utc):
                            item["status"] = "delayed"
                        else:
                            item["status"] = "pending"
                    except:
                        item["status"] = "pending"
                else:
                    item["status"] = "pending"
    
    # Update project
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "stage": new_stage,
                "timeline": timeline,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"comments": system_comment}
        }
    )
    
    return {
        "message": "Stage updated successfully",
        "stage": new_stage,
        "system_comment": system_comment
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
    """Add a collaborator (Admin or Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
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
    """Remove a collaborator (Admin only)"""
    user = await get_current_user(request)
    
    if user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
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

@api_router.get("/users/available")
async def get_available_users(request: Request):
    """Get list of all users (for adding collaborators)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}).to_list(1000)
    return users

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
    
    def generate_timeline(stage, created_date):
        """Generate timeline based on project stage with grouped milestones"""
        base_date = datetime.fromisoformat(created_date.replace("Z", "+00:00"))
        if base_date.tzinfo is None:
            base_date = base_date.replace(tzinfo=timezone.utc)
        
        stage_index = STAGE_ORDER.index(stage) if stage in STAGE_ORDER else 0
        
        timeline = []
        day_offset = 0
        
        # Generate milestones for each stage group
        for idx, stage_name in enumerate(STAGE_ORDER):
            milestones = MILESTONE_GROUPS.get(stage_name, [])
            for milestone in milestones:
                # Determine status based on current stage
                if idx < stage_index:
                    status = "completed"
                elif idx == stage_index:
                    # Current stage - first milestone completed, rest pending
                    milestone_idx = milestones.index(milestone)
                    status = "completed" if milestone_idx == 0 else "pending"
                else:
                    status = "pending"
                
                timeline.append({
                    "id": f"tl_{uuid.uuid4().hex[:6]}",
                    "title": milestone,
                    "date": (base_date + timedelta(days=day_offset)).isoformat(),
                    "status": status,
                    "stage_ref": stage_name
                })
                day_offset += 3  # Space milestones 3 days apart
        
        return timeline
    
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
    sample_projects = [
        {
            "project_id": f"proj_{uuid.uuid4().hex[:8]}",
            "project_name": "Modern Minimalist Apartment",
            "client_name": "Rahul Sharma",
            "client_phone": "9876543210",
            "stage": "Design Finalization",
            "collaborators": user_ids[:2] if len(user_ids) >= 2 else user_ids,
            "summary": "Complete interior design for a 3BHK apartment with minimalist aesthetics",
            "timeline": generate_timeline("Design Finalization", (now - timedelta(days=5)).isoformat()),
            "comments": generate_comments(user_ids[:2] if len(user_ids) >= 2 else user_ids, (now - timedelta(days=5)).isoformat()),
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
            "timeline": generate_timeline("Production Preparation", (now - timedelta(days=15)).isoformat()),
            "comments": generate_comments(user_ids[:3] if len(user_ids) >= 3 else user_ids, (now - timedelta(days=15)).isoformat()),
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
            "timeline": generate_timeline("Production", (now - timedelta(days=30)).isoformat()),
            "comments": generate_comments(user_ids[:2] if len(user_ids) >= 2 else user_ids, (now - timedelta(days=30)).isoformat()),
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
            "timeline": generate_timeline("Handover", (now - timedelta(days=60)).isoformat()),
            "comments": generate_comments(user_ids[:1] if len(user_ids) >= 1 else user_ids, (now - timedelta(days=60)).isoformat()),
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
            "timeline": generate_timeline("Production Preparation", (now - timedelta(days=10)).isoformat()),
            "comments": generate_comments(user_ids, (now - timedelta(days=10)).isoformat()),
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
            "timeline": generate_timeline("Design Finalization", (now - timedelta(days=3)).isoformat()),
            "comments": generate_comments(user_ids[:1] if len(user_ids) >= 1 else user_ids, (now - timedelta(days=3)).isoformat()),
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
            "timeline": generate_timeline("Installation", (now - timedelta(days=20)).isoformat()),
            "comments": generate_comments(user_ids[:2] if len(user_ids) >= 2 else user_ids, (now - timedelta(days=20)).isoformat()),
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
            "timeline": generate_timeline("Delivery", (now - timedelta(days=45)).isoformat()),
            "comments": generate_comments(user_ids, (now - timedelta(days=45)).isoformat()),
            "updated_at": (now - timedelta(days=7)).isoformat(),
            "created_at": (now - timedelta(days=45)).isoformat()
        }
    ]
    
    # Clear existing projects and insert new ones
    await db.projects.delete_many({})
    await db.projects.insert_many(sample_projects)
    
    return {"message": f"Seeded {len(sample_projects)} sample projects", "count": len(sample_projects)}

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
