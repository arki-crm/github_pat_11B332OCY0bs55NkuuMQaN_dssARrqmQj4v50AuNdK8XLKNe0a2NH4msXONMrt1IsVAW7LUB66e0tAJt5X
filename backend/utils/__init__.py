"""Utility functions for Arkiflo API"""

from .auth import get_current_user, require_admin
from .formatting import format_user_response, format_datetime
from .timeline import (
    generate_lead_timeline, generate_project_timeline,
    update_timeline_on_stage_change
)
from .financials import calculate_schedule_amounts, validate_payment_schedule
from .notifications import (
    create_notification, notify_users,
    get_relevant_users_for_project, get_relevant_users_for_lead
)
from .settings import log_system_action, get_settings, save_settings

__all__ = [
    # Auth
    'get_current_user', 'require_admin',
    # Formatting
    'format_user_response', 'format_datetime',
    # Timeline
    'generate_lead_timeline', 'generate_project_timeline',
    'update_timeline_on_stage_change',
    # Financials
    'calculate_schedule_amounts', 'validate_payment_schedule',
    # Notifications
    'create_notification', 'notify_users',
    'get_relevant_users_for_project', 'get_relevant_users_for_lead',
    # Settings
    'log_system_action', 'get_settings', 'save_settings',
]
