from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    """Register the payment foundation independently of gateway processing."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payments"
