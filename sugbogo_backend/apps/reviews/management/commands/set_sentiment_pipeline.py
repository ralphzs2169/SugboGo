"""Explicitly activate or roll back a fully prepared business sentiment cohort."""

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import APIException

from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService


class Command(BaseCommand):
    """Require a business ID and an explicit authoritative mode transition."""

    help = "Activate a prepared Gemini cohort or restore legacy sentiment for one business."

    def add_arguments(self, parser):
        """Declare the explicit business and requested mode."""
        parser.add_argument("--business-id", type=int, required=True)
        parser.add_argument("--mode", choices=("gemini", "legacy"), required=True)

    def handle(self, *args, **options):
        """Perform an atomic transition without implicitly calling a provider."""
        action = GeminiSentimentCutoverService.activate if options["mode"] == "gemini" else GeminiSentimentCutoverService.rollback
        try:
            outcome = action(options["business_id"])
        except APIException as exc:
            raise CommandError(str(exc.detail)) from None
        self.stdout.write(self.style.SUCCESS(outcome))
