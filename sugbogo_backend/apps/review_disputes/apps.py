from django.apps import AppConfig


class ReviewDisputesConfig(AppConfig):
    name = 'apps.review_disputes'

    def ready(self):
        """Register historical retention and cascade-safe review deletion handlers."""
        from apps.review_disputes import signals  # noqa: F401
