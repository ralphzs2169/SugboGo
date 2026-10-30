from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.reviews"

    def ready(self):
        """Register rating deletion invalidation for direct and cascaded ORM removal."""
        from apps.reviews import rating_signals  # noqa: F401
