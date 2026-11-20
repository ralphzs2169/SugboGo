from django.apps import AppConfig


class MerchantAnalyticsConfig(AppConfig):
    """Register merchant analytics and paid Merchant Plus access."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.merchant_operations.merchant_analytics"
