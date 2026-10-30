"""Explicitly repair missing all-time legacy classifications independently of rating work."""

from django.core.management.base import BaseCommand, CommandError

from apps.reviews.models import BusinessRating
from apps.reviews.services.business_rating_service import BusinessRatingService
from apps.reviews.services.business_review_summary_service import BusinessReviewSummaryService
from apps.reviews.services.review_sentiment_service import ReviewSentimentService


class Command(BaseCommand):
    help = "Explicitly run local inference for missing all-time legacy sentiment."

    def add_arguments(
        self,
        parser,
    ):
        """Require a deliberate business selection and legacy inference opt-in."""
        parser.add_argument("--business-id", type=int, required=True)
        parser.add_argument("--legacy-unverified", action="store_true", required=True)

    def handle(
        self,
        *args,
        **options,
    ):
        """Run existing classification only for a business explicitly using legacy inputs."""
        business_id = options["business_id"]
        if not BusinessRating.objects.filter(
            BUSN_ID_id=business_id,
            BRAT_SCORING_VERSION=BusinessRatingService.LEGACY_VERSION,
        ).exists():
            raise CommandError("Select a business with an initialized legacy rating.")
        result = ReviewSentimentService.reconcile_business(
            business_id,
            all_time=True,
        )
        BusinessReviewSummaryService.recompute_sentiment(business_id)
        self.stdout.write(
            f"attempted={result['attempted']} updated={result['updated']} "
            f"failed={result['failed']}",
        )
        if result["failed"]:
            raise CommandError("Some sentiment classifications still require recovery.")
