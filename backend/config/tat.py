"""TAT (Time-to-Action) Configuration"""

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

# Default TAT configurations for Settings
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
