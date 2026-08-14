from apps.merchant_application.models import MerchantApplication

APPLICATION_REVIEW_SLA_BUSINESS_DAYS = 5
APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS = 3

REVIEWABLE_APPLICATION_STATUSES = [
    MerchantApplication.ApplicationStatus.SUBMITTED,
    MerchantApplication.ApplicationStatus.APPROVED,
    MerchantApplication.ApplicationStatus.REJECTED,
]

def get_review_sla_business_days():
    """Return the configured merchant application review SLA."""
    return {
        "min": APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS - 1,
        "max": APPLICATION_REVIEW_SLA_BUSINESS_DAYS,
    }