"""Monitor ingestion without mistaking server receipts for complete tracking coverage."""

import json
import logging

from django.conf import settings
from django.utils import timezone

from apps.shared.analytics.comparisons import equal_elapsed_periods


logger = logging.getLogger(__name__)


class VisibilityCoverageService:
    """Fail closed until durable end-to-end coverage evidence has an authoritative producer."""

    DEFINITION_VERSION = "account_business_utc_day_owner_excluded_v1"

    @classmethod
    def observe(
        cls,
        *,
        event_type,
        business_ids,
        occurred_at,
        outcome,
        recorded_count=None,
        duplicate_count=None,
        reason=None,
    ):
        """Emit privacy-limited operational evidence without changing event-write outcomes."""
        payload = {
            "definition_version": cls.DEFINITION_VERSION,
            "observed_at": timezone.now().isoformat(),
            "occurred_at": occurred_at.isoformat(),
            "event_type": str(event_type),
            "business_ids": list(business_ids),
            "outcome": outcome,
            "recorded_count": recorded_count,
            "duplicate_count": duplicate_count,
            "reason": reason,
            "coverage_verified": False,
        }
        # Receipts cannot see undelivered client requests or writes made by a demo seeder.
        # A logging/sink failure must neither fail a successful event nor certify its coverage.
        try:
            logger.log(
                logging.WARNING if outcome == "failed" else logging.INFO,
                "visibility_tracking %s",
                json.dumps(payload, sort_keys=True),
            )
        except Exception:
            return

    @classmethod
    def assess(
        cls,
        *,
        business_id,
        event_type,
        period,
    ):
        """Expose missing evidence rather than certify dates from activity or connectivity."""
        reasons = [
            "client_delivery_history_unverified",
            "persistence_history_unverified",
            "business_account_eligibility_history_unverified",
            "synthetic_provenance_unverified",
        ]
        if not equal_elapsed_periods(period):
            reasons.insert(0, "unequal_comparison_periods")
        if settings.TIME_ZONE != "UTC":
            reasons.insert(0, "deduplication_timezone_mismatch")
        return {
            "eligible": False,
            "reason": "coverage_unverified",
            "reasons": reasons,
            "definition_version": cls.DEFINITION_VERSION,
        }
