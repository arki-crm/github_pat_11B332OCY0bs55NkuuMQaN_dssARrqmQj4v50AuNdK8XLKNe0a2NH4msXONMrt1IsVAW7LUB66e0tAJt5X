"""Timeline generation utilities"""

import uuid
from datetime import datetime, timezone, timedelta
from config.tat import (
    LEAD_STAGES, LEAD_MILESTONES, LEAD_TAT,
    STAGE_ORDER, MILESTONE_GROUPS, PROJECT_TAT
)


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
            completed_date = expected_date.isoformat()
        elif milestone_stage_index == stage_index:
            if idx == 0 or milestone_title == "Lead Created":
                status = "completed"
                completed_date = base_date.isoformat()
            else:
                if expected_date < now:
                    status = "delayed"
                else:
                    status = "pending"
                completed_date = None
        else:
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
            tat_days = PROJECT_TAT.get(milestone_title, 3)
            cumulative_days += tat_days
            
            expected_date = base_date + timedelta(days=cumulative_days)
            
            if stage_idx < stage_index:
                status = "completed"
                completed_date = expected_date.isoformat()
            elif stage_idx == stage_index:
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
            item["status"] = "completed"
            if not item.get("completedDate"):
                item["completedDate"] = now.isoformat()
        elif item_stage_index == new_stage_index:
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
                except Exception:
                    if item["status"] != "completed":
                        item["status"] = "pending"
            else:
                if item["status"] != "completed":
                    item["status"] = "pending"
        else:
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
                except Exception:
                    item["status"] = "pending"
            else:
                item["status"] = "pending"
            item["completedDate"] = None
    
    return timeline
