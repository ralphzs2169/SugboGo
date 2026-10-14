from django.apps import AppConfig


class MerchantAnalyticsConfig(AppConfig):
    """Register merchant analytics and its separately controlled demo Plus entitlement."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.merchant_operations.merchant_analytics"
