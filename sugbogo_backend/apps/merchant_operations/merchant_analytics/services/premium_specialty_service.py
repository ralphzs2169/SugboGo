"""Retained valid specialty endorsements by creation week, without removal history."""

from django.db.models import Count
from django.db.models.functions import TruncWeek

from apps.business.services.vouch_service import VouchService
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.comparisons import (
    compare_count_difference,
    equal_elapsed_periods,
)

from .premium_common import owned_business_data, snapshot_meta, week_buckets


class PremiumSpecialtyService:
    """Describe vouches added in the period that remain valid at the report snapshot."""

    @staticmethod
    def get_report(
        user,
        period,
    ):
        """Scope current active specialties and aggregate retained endorsement timestamps."""
        business = BusinessProfileService.get_business_for_merchant(user)
        specialties = VouchService.get_current_specialty_support(business.pk, as_of=period.generated_at)
        # Plan limitation: deletions and validity changes erase historical support states.
        retained = VouchService.get_retained_vouches(
            business.pk,
            as_of=period.generated_at,
        )
        evidence = retained.filter(
            VOUCH_CREATED_AT__gte=period.start,
            VOUCH_CREATED_AT__lt=period.end,
        )
        current_value = evidence.count()
        previous_value = retained.filter(
            VOUCH_CREATED_AT__gte=period.previous_start,
            VOUCH_CREATED_AT__lt=period.previous_end,
        ).count()
        change = compare_count_difference(
            current=current_value,
            previous=previous_value,
            data_available=equal_elapsed_periods(period),
        )
        if not equal_elapsed_periods(period):
            change["reason"] = "unequal_comparison_periods"
        totals = {row["TAG_ID"]: row for row in evidence.values("TAG_ID").annotate(
            added_and_still_valid=Count("pk"), distinct_supporters=Count("USER_ID", distinct=True),
        )}
        rows = evidence.annotate(week=TruncWeek("VOUCH_CREATED_AT", tzinfo=MANILA)).values("TAG_ID", "week").annotate(
            added_and_still_valid=Count("pk"), distinct_supporters=Count("USER_ID", distinct=True),
        ).order_by("week", "TAG_ID")
        weekly = {(row["TAG_ID"], row["week"].date().isoformat()): row for row in rows}
        result = []
        for specialty in specialties:
            tag = specialty["specialty_id"]
            total = totals.get(tag, {})
            result.append({
                "specialty_id": tag, "specialty_name": specialty["specialty_name"],
                "added_and_still_valid": total.get("added_and_still_valid", 0),
                "distinct_supporters": total.get("distinct_supporters", 0),
                "series": [{**bucket,
                            "added_and_still_valid": weekly.get((tag, bucket["date"]), {}).get("added_and_still_valid", 0),
                            "distinct_supporters": weekly.get((tag, bucket["date"]), {}).get("distinct_supporters", 0)}
                           for bucket in week_buckets(period)],
            })
        return {
            "business": owned_business_data(business), "interval": "weekly", "label": "Added and still valid",
            "specialties": result, "snapshot_as_of": period.generated_at.isoformat(),
            "vouches_added_and_still_valid": current_value,
            "previous_vouches_added_and_still_valid": previous_value,
            "vouches_added_change": change,
            "meta": snapshot_meta(period, "retained_valid_vouches_only", "vouch_removal_history_unavailable"),
        }
