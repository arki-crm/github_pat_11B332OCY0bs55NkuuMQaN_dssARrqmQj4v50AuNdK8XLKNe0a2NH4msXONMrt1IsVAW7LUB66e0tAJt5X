"""Pydantic models for Arkiflo API"""

from .user import (
    User, UserResponse, UserInvite, UserUpdate, 
    ProfileUpdate, SessionRequest, RoleUpdateRequest
)
from .project import (
    Project, ProjectResponse, ProjectCreate, 
    TimelineItem, CommentItem, CommentCreate, StageUpdate
)
from .files import FileUpload, FileItem, NoteCreate, NoteUpdate, NoteItem, CollaboratorAdd
from .lead import Lead, LeadCreate, LeadStageUpdate, LeadAssignDesigner
from .financials import ProjectFinancialsUpdate, PaymentCreate
from .settings import (
    CompanySettings, BrandingSettings, LeadTATSettings, 
    ProjectTATSettings, StageConfig, SystemLog, EmailTemplateUpdate
)
from .notifications import NotificationCreate, NotificationUpdate
from .tasks import TaskCreate, TaskUpdate
from .meetings import MeetingCreate, MeetingUpdate

__all__ = [
    # User models
    'User', 'UserResponse', 'UserInvite', 'UserUpdate',
    'ProfileUpdate', 'SessionRequest', 'RoleUpdateRequest',
    # Project models
    'Project', 'ProjectResponse', 'ProjectCreate',
    'TimelineItem', 'CommentItem', 'CommentCreate', 'StageUpdate',
    # Files models
    'FileUpload', 'FileItem', 'NoteCreate', 'NoteUpdate', 'NoteItem', 'CollaboratorAdd',
    # Lead models
    'Lead', 'LeadCreate', 'LeadStageUpdate', 'LeadAssignDesigner',
    # Financials models
    'ProjectFinancialsUpdate', 'PaymentCreate',
    # Settings models
    'CompanySettings', 'BrandingSettings', 'LeadTATSettings',
    'ProjectTATSettings', 'StageConfig', 'SystemLog', 'EmailTemplateUpdate',
    # Notifications models
    'NotificationCreate', 'NotificationUpdate',
    # Task models
    'TaskCreate', 'TaskUpdate',
    # Meeting models
    'MeetingCreate', 'MeetingUpdate',
]
