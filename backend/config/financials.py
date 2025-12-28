"""Financials Configuration"""

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
