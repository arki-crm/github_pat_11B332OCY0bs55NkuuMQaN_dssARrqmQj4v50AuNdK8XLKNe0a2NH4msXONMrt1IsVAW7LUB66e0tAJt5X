"""Default Email Templates"""

DEFAULT_EMAIL_TEMPLATES = {
    "template_stage_change": {
        "id": "template_stage_change",
        "name": "Stage Change Notification",
        "subject": "Project Stage Updated: {{projectName}}",
        "body": """Dear {{userName}},

The project "{{projectName}}" has been moved to a new stage.

Previous Stage: {{previousStage}}
New Stage: {{newStage}}
Updated By: {{updatedBy}}

Please review the project and take necessary actions.

Best regards,
Arkiflo Team""",
        "variables": ["projectName", "userName", "previousStage", "newStage", "updatedBy"]
    },
    "template_task_assignment": {
        "id": "template_task_assignment",
        "name": "Task Assignment Notification",
        "subject": "New Task Assigned: {{taskTitle}}",
        "body": """Dear {{userName}},

A new task has been assigned to you.

Task: {{taskTitle}}
Project: {{projectName}}
Due Date: {{dueDate}}
Priority: {{priority}}
Assigned By: {{assignedBy}}

Description:
{{description}}

Please complete the task before the due date.

Best regards,
Arkiflo Team""",
        "variables": ["userName", "taskTitle", "projectName", "dueDate", "priority", "assignedBy", "description"]
    },
    "template_task_overdue": {
        "id": "template_task_overdue",
        "name": "Task Overdue Alert",
        "subject": "Overdue Task: {{taskTitle}}",
        "body": """Dear {{userName}},

The following task is overdue and requires immediate attention.

Task: {{taskTitle}}
Project: {{projectName}}
Due Date: {{dueDate}}
Days Overdue: {{daysOverdue}}

Please complete this task as soon as possible or contact your manager if you need assistance.

Best regards,
Arkiflo Team""",
        "variables": ["userName", "taskTitle", "projectName", "dueDate", "daysOverdue"]
    },
    "template_milestone_delay": {
        "id": "template_milestone_delay",
        "name": "Milestone Delay Notification",
        "subject": "Milestone Delayed: {{milestoneName}} - {{projectName}}",
        "body": """Dear {{userName}},

A milestone is delayed and needs attention.

Project: {{projectName}}
Milestone: {{milestoneName}}
Expected Date: {{expectedDate}}
Days Delayed: {{daysDelayed}}
Designer: {{designerName}}

Please review the project and take appropriate action.

Best regards,
Arkiflo Team""",
        "variables": ["userName", "projectName", "milestoneName", "expectedDate", "daysDelayed", "designerName"]
    },
    "template_user_invite": {
        "id": "template_user_invite",
        "name": "User Invitation",
        "subject": "You've been invited to join Arkiflo",
        "body": """Dear {{userName}},

You have been invited to join Arkiflo as a {{role}}.

Invited By: {{invitedBy}}

To get started, please visit our platform and sign in with your Google account using this email address: {{email}}

Login URL: {{loginUrl}}

If you have any questions, please contact your administrator.

Best regards,
Arkiflo Team""",
        "variables": ["userName", "role", "invitedBy", "email", "loginUrl"]
    }
}
