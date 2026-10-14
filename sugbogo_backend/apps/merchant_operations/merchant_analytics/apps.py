from django.apps import AppConfig


class MerchantAnalyticsConfig(AppConfig):
    """Register the model-free merchant analytics feature."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.merchant_operations.merchant_analytics"
