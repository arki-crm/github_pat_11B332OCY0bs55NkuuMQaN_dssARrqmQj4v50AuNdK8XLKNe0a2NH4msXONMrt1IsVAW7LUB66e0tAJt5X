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

# ============ USER MANAGEMENT ============

VALID_ROLES = ["Admin", "Manager", "Designer", "PreSales", "Trainee"]

def format_user_response(user_doc):
    """Format user document for API response"""
    def format_dt(dt):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return str(dt) if dt else None
    
    return {
        "user_id": user_doc.get("user_id"),
        "email": user_doc.get("email"),
        "name": user_doc.get("name"),
        "picture": user_doc.get("picture"),
        "role": user_doc.get("role", "Designer"),
        "phone": user_doc.get("phone"),
        "status": user_doc.get("status", "Active"),
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
    """List all users (Admin and Manager only)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
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
    
    old_stage = project.get("stage", "Design Finalization")
    new_stage = stage_update.stage
    
    if old_stage == new_stage:
        return {"message": "Stage unchanged", "stage": new_stage}
    
    now = datetime.now(timezone.utc)
    
    # Create system comment for stage change
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Stage updated from \"{old_stage}\" to \"{new_stage}\"",
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

@api_router.get("/users/designers")
async def get_designers(request: Request):
    """Get list of all designers (for assigning to leads)"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    designers = await db.users.find(
        {"role": "Designer"}, 
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "picture": 1}
    ).to_list(1000)
    return designers

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
        milestones = MILESTONE_GROUPS.get(stage_name, [])
        
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
async def list_leads(request: Request, status: Optional[str] = None, search: Optional[str] = None):
    """List leads based on role permissions"""
    user = await get_current_user(request)
    
    # Build query based on role
    query = {"is_converted": False}
    
    if user.role == "Designer":
        # Designer sees only leads assigned to them
        query["designer_id"] = user.user_id
    elif user.role == "PreSales":
        # PreSales sees only their assigned leads
        query["assigned_to"] = user.user_id
    # Admin and Manager see all leads
    
    # Status filter
    if status and status != "all":
        query["status"] = status
    
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
    
    # Check access based on role
    if user.role == "Designer":
        if lead.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == "PreSales":
        if lead.get("assigned_to") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
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
    """Create a new lead"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    lead_id = f"lead_{uuid.uuid4().hex[:8]}"
    
    new_lead = {
        "lead_id": lead_id,
        "customer_name": lead_data.customer_name,
        "customer_phone": lead_data.customer_phone,
        "source": lead_data.source,
        "status": lead_data.status,
        "stage": "BC Call Done",
        "assigned_to": user.user_id if user.role == "PreSales" else None,
        "designer_id": None,
        "is_converted": False,
        "project_id": None,
        "timeline": generate_lead_timeline("BC Call Done", now.isoformat()),
        "comments": [{
            "id": f"comment_{uuid.uuid4().hex[:8]}",
            "user_id": "system",
            "user_name": "System",
            "role": "System",
            "message": "Lead created",
            "is_system": True,
            "created_at": now.isoformat()
        }],
        "updated_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.leads.insert_one(new_lead)
    
    return new_lead

@api_router.post("/leads/{lead_id}/comments")
async def add_lead_comment(lead_id: str, comment: CommentCreate, request: Request):
    """Add a comment to a lead"""
    user = await get_current_user(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check access based on role
    if user.role == "Designer":
        if lead.get("designer_id") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == "PreSales":
        if lead.get("assigned_to") != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
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

@api_router.put("/leads/{lead_id}/stage")
async def update_lead_stage(lead_id: str, stage_update: LeadStageUpdate, request: Request):
    """Update lead stage"""
    user = await get_current_user(request)
    
    # Only PreSales, Manager, Admin can change lead stages
    if user.role not in ["Admin", "Manager", "PreSales"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if stage_update.stage not in LEAD_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {LEAD_STAGES}")
    
    lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # PreSales can only change their own leads
    if user.role == "PreSales" and lead.get("assigned_to") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    old_stage = lead.get("stage", "BC Call Done")
    new_stage = stage_update.stage
    
    if old_stage == new_stage:
        return {"message": "Stage unchanged", "stage": new_stage}
    
    now = datetime.now(timezone.utc)
    
    # Create system comment
    system_comment = {
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Stage updated from \"{old_stage}\" to \"{new_stage}\"",
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
    
    return {
        "message": "Stage updated successfully",
        "stage": new_stage,
        "status": new_status,
        "system_comment": system_comment
    }

@api_router.put("/leads/{lead_id}/assign-designer")
async def assign_designer(lead_id: str, assign_data: LeadAssignDesigner, request: Request):
    """Assign a designer to a lead"""
    user = await get_current_user(request)
    
    if user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
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

@api_router.post("/leads/{lead_id}/convert")
async def convert_to_project(lead_id: str, request: Request):
    """Convert a lead to a project"""
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
    
    # Generate project timeline with TAT-aware expected dates
    project_timeline = generate_project_timeline("Design Finalization", now.isoformat())
    
    # Copy comments and add conversion system comment
    project_comments = lead.get("comments", []).copy()
    project_comments.append({
        "id": f"comment_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "user_name": user.name,
        "role": user.role,
        "message": f"Project created from lead on {now.strftime('%d/%m/%Y')} by {user.name}.",
        "is_system": True,
        "created_at": now.isoformat()
    })
    
    # Create project
    new_project = {
        "project_id": project_id,
        "project_name": f"{lead['customer_name']} - Interior Project",
        "client_name": lead["customer_name"],
        "client_phone": lead["customer_phone"],
        "stage": "Design Finalization",
        "collaborators": [lead["designer_id"]] if lead.get("designer_id") else [],
        "summary": f"Converted from lead {lead_id}",
        "timeline": project_timeline,
        "comments": project_comments,
        "files": [],
        "notes": [],
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
                "message": f"Converted to project {project_id}",
                "is_system": True,
                "created_at": now.isoformat()
            }}
        }
    )
    
    return {
        "message": "Lead converted to project successfully",
        "project_id": project_id,
        "lead_id": lead_id
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
            "updated_at": (now - timedelta(days=7)).isoformat(),
            "created_at": (now - timedelta(days=45)).isoformat()
        }
    ]
    
    # Clear existing projects and insert new ones
    await db.projects.delete_many({})
    await db.projects.insert_many(sample_projects)
    
    return {"message": f"Seeded {len(sample_projects)} sample projects", "count": len(sample_projects)}

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
