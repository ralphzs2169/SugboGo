from rest_framework.exceptions import ValidationError


def validate_merchant_change_reason(reason):
    """Enforce reason length for submissions from any service caller."""
    if not isinstance(reason, str) or not reason.strip():
        raise ValidationError({
            "reason": ["Please provide a reason for this change."],
        })

    normalized = reason.strip()
    if len(normalized) < 10:
        raise ValidationError({
            "reason": ["Please enter at least 10 characters."],
        })
    if len(normalized) > 500:
        raise ValidationError({
            "reason": ["Your reason must not exceed 500 characters."],
        })
    return normalized
