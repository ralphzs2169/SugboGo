"""Inspect readiness or explicitly backfill a bounded business cohort."""

import json

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import APIException

from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService


class Command(BaseCommand):
    """Keep historical inference explicit, bounded, and scoped to one business."""

    help = "Report Gemini cutover readiness; optionally queue missing observations for one business."

    def add_arguments(self, parser):
        """Declare read-only defaults and an explicit bounded queue option."""
        parser.add_argument("--business-id", type=int, required=True)
        parser.add_argument("--queue", action="store_true")
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        """Print readiness without changing authority or invoking a provider directly."""
        if options["business_id"] <= 0 or not 1 <= options["limit"] <= 100:
            raise CommandError("Provide a positive business ID and a limit between 1 and 100.")
        try:
            result = GeminiSentimentCutoverService.prepare(options["business_id"], options["queue"], options["limit"])
        except APIException as exc:
            raise CommandError(str(exc.detail)) from None
        self.stdout.write(json.dumps(result))
