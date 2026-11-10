"""Inspect or advance a bounded page of the global sentiment rollout."""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import F
from rest_framework.exceptions import APIException

from apps.business.models import Business
from apps.reviews.models import BusinessSentimentPolicy as Policy, ReviewSentimentShadow as Shadow
from apps.reviews.services.gemini_sentiment_contract import contract_version
from apps.reviews.services.gemini_sentiment_cutover_service import GeminiSentimentCutoverService as Cutover


class Command(BaseCommand):
    """Keep reporting read-only and bound explicit backfill across businesses."""

    help = "Report global Gemini readiness; optionally queue reviews and activate complete businesses."

    def add_arguments(self, parser):
        """Expose stable cursor pagination and independent mutation switches."""
        parser.add_argument("--after-business-id", type=int, default=0)
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--review-limit", type=int, default=100)
        parser.add_argument("--queue", action="store_true")
        parser.add_argument("--activate", action="store_true")

    def handle(self, *args, **options):
        """Report a page and optionally advance it without making provider calls."""
        if options["after_business_id"] < 0 or not 1 <= options["limit"] <= 100 or not 1 <= options["review_limit"] <= 100:
            raise CommandError("Use a nonnegative cursor and limits between 1 and 100.")
        if options["queue"] or options["activate"]:
            if not settings.GEMINI_SENTIMENT_ALL_BUSINESSES or not settings.GEMINI_SENTIMENT_CUTOVER_ENABLED:
                raise CommandError("Enable global Gemini authority and cutover processing before rollout mutations.")
            if options["queue"] and not settings.GEMINI_API_KEY:
                raise CommandError("Configure GEMINI_API_KEY before queueing paid inference.")
        businesses = list(Business.objects.filter(
            pk__gt=options["after_business_id"],
        ).order_by("pk").values_list("pk", flat=True)[:options["limit"] + 1])
        rows = []
        remaining = options["review_limit"]
        for business_id in businesses[:options["limit"]]:
            try:
                policy = Cutover.active_policy(business_id)
                model = policy.BSPO_MODEL if policy else settings.GEMINI_SENTIMENT_SHADOW_MODEL
                row = Cutover.prepare(business_id, queue=options["queue"] and remaining > 0, limit=remaining)
                remaining -= row["requested"]
                row["authority"] = "gemini" if policy else "awaiting_cohort"
                row["persisted_mode"] = Policy.objects.filter(BUSN_ID_id=business_id).values_list("BSPO_MODE", flat=True).first()
                row["pinned_version"] = policy.BSPO_VERSION if policy else None
                row["model"] = model
                row["version"] = contract_version(model)
                row["failed_jobs"] = Shadow.objects.filter(
                    REVW_ID__BUSN_ID_id=business_id,
                    RSSH_VERSION=row["version"], RSSH_STATE=Shadow.State.FAILED,
                    RSSH_SOURCE_TEXT=F("REVW_ID__REVW_TEXT"),
                ).count()
                if options["activate"] and row["not_ready"] == 0:
                    row["activation"] = Cutover.activate(business_id)
                    row["authority"] = "gemini"
                rows.append(row)
            except APIException:
                rows.append({"business_id": business_id, "error": "cohort_changed_or_incompatible"})
        self.stdout.write(json.dumps({
            "global_authority": settings.GEMINI_SENTIMENT_ALL_BUSINESSES,
            "processing_enabled": settings.GEMINI_SENTIMENT_CUTOVER_ENABLED,
            "businesses": rows,
            "next_after_business_id": businesses[options["limit"] - 1] if len(businesses) > options["limit"] else None,
            "requested": options["review_limit"] - remaining,
        }))
