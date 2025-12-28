"""Financial calculation utilities"""

from config.constants import PAYMENT_SCHEDULE_TYPES


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
                "amount": 0
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
