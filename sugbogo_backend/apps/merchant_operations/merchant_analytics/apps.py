from django.apps import AppConfig


class MerchantAnalyticsConfig(AppConfig):
    """Register merchant analytics, demo Plus access, and stored recommendation jobs."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.merchant_operations.merchant_analytics"
