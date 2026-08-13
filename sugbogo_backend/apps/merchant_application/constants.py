APPLICATION_REVIEW_SLA_BUSINESS_DAYS = 5
APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS = 3

def get_review_sla_business_days():
    """Return the configured merchant application review SLA."""
    return {
        "min": APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS - 1,
        "max": APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
    }