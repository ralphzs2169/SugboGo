"""Explicitly rebuild development ratings without running sentiment inference."""

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import APIException

from apps.business.models import Business
from apps.reviews.services.business_rating_service import BusinessRatingService


class Command(BaseCommand):
    help = "Recompute experimental business ratings for one compatibility version."

    def add_arguments(
        self,
        parser,
    ):
        """Require an explicit version or an explicit unknown-provenance opt-in."""
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--scoring-version")
        group.add_argument("--legacy-unverified", action="store_true")
        parser.add_argument("--business-id", type=int, action="append")

    def handle(
        self,
        *args,
        **options,
    ):
        """Rebuild each business independently and report failures without hiding them."""
        version = options["scoring_version"]
        if options["legacy_unverified"]:
            version = BusinessRatingService.LEGACY_VERSION
        try:
            BusinessRatingService.validate_version(
                version,
                allow_legacy=options["legacy_unverified"],
            )
        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        ids = options["business_id"]
        if ids is None:
            ids = Business.objects.order_by("pk").values_list("pk", flat=True).iterator()
        else:
            ids = sorted(set(ids))
        failed = 0
        for business_id in ids:
            try:
                rating = BusinessRatingService.recompute(
                    business_id,
                    version,
                    allow_legacy=options["legacy_unverified"],
                )
            except Exception as exc:
                failed += 1
                self.stderr.write(f"business={business_id} failed={type(exc).__name__}")
                continue
            self.stdout.write(
                f"business={business_id} state={rating.BRAT_STATE} "
                f"contributors={rating.BRAT_REVIEW_COUNT} experimental=True "
                f"scoring_version={version}",
            )
        if failed:
            raise CommandError(f"{failed} business rating recalculations failed.")

