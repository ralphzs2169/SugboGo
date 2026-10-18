"""Owned-business Standard aggregates without comparisons or Premium analysis."""

from django.db.models import Count, Exists, F, OuterRef, Q

from apps.business.services.pocket_service import PocketService
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.business.services.vouch_service import VouchService
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.reviews.models import Review, ReviewReply
from apps.shared.analytics.metadata import build_meta


def standard_meta(period, **options):
    """Reuse source metadata while omitting every prior-period boundary from Standard."""
    meta = build_meta(period, **options)
    meta["period"].pop("previous_start", None)
    meta["period"].pop("previous_end_exclusive", None)
    return meta


class StandardAnalyticsService:
    """Aggregate Standard metrics only for the authenticated merchant's owned business."""

    @staticmethod
    def visibility(business_id, period):
        """Preserve successful visibility reads and mark failed metrics as unavailable."""
        values = {"profile_visits": None, "distinct_profile_visitors": None, "saves_in_period": None}
        query = {"business_ids": [business_id], "start_time": period.start, "end_time": period.end}
        reasons = []
        try:
            totals = VisibilityEventService.get_analytics_totals(**query)
            values["profile_visits"] = totals["PROFILE_VISIT"]
            values["saves_in_period"] = totals["SAVE"]
        except VisibilityTrackingUnavailable as error:
            reasons.append("event_totals_unavailable")
            if error.reason is not None:
                reasons.append(error.reason)
        try:
            values["distinct_profile_visitors"] = VisibilityEventService.count_analytics_explorers(
                **query, event_type="PROFILE_VISIT",
            )
        except VisibilityTrackingUnavailable as error:
            reasons.append("distinct_visitors_unavailable")
            if error.reason is not None:
                reasons.append(error.reason)
        successful = sum(value is not None for value in values.values())
        availability = "unavailable" if successful == 0 else "partial" if reasons else "available"
        return values, standard_meta(period, availability=availability, partial_reasons=reasons)

    @staticmethod
    def review_counts(business_id, period):
        """Count current published reviews and period-cohort replies by generated_at cutoff."""
        cutoff = period.generated_at
        eligible_reply = ReviewReply.objects.filter(
            REVW_ID=OuterRef("pk"), RPLY_CREATED_AT__lte=cutoff,
            RPLY_CREATED_AT__gte=OuterRef("REVW_CREATED_AT"),
        )
        published = Review.objects.filter(
            BUSN_ID=business_id, REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_CREATED_AT__lte=cutoff,
        ).annotate(has_eligible_reply=Exists(eligible_reply))
        current = published.aggregate(
            total=Count("pk"), unanswered=Count("pk", filter=Q(has_eligible_reply=False)),
        )
        cohort = published.filter(
            REVW_CREATED_AT__gte=period.start, REVW_CREATED_AT__lt=period.end,
        ).aggregate(total=Count("pk"), replied=Count("pk", filter=Q(has_eligible_reply=True)))
        anomalies = ReviewReply.objects.filter(REVW_ID__in=published).filter(
            Q(RPLY_CREATED_AT__gt=cutoff) | Q(RPLY_CREATED_AT__lt=F("REVW_ID__REVW_CREATED_AT")),
        ).count()
        return {
            "new_published_in_period": cohort["total"],
            "current_published_total": current["total"],
            "current_unanswered_published": current["unanswered"],
            "period_eligible_published": cohort["total"],
            "period_replied_published": cohort["replied"],
            "reply_rate": round(cohort["replied"] / cohort["total"] * 100, 1) if cohort["total"] else None,
            "reply_cutoff": cutoff.isoformat(),
            "excluded_reply_timestamp_count": anomalies,
        }

    @classmethod
    def get_report(cls, user, period):
        """Derive ownership server-side and return explicitly separated event/cohort snapshots."""
        business = BusinessProfileService.get_business_for_merchant(user)
        visibility, visibility_meta = cls.visibility(business.pk, period)
        reviews = cls.review_counts(business.pk, period)
        specialty_support = VouchService.get_current_specialty_support(
            business.pk,
            as_of=period.generated_at,
        )
        # Each VOUCH_ID belongs to one TAG_ID and each business/tag link is unique.
        # These disjoint evidence counts include multiple specialties per supporter.
        current_valid_vouches = sum(
            specialty["valid_vouches"]
            for specialty in specialty_support
        )
        reasons = ["current_state_reporting"]
        if reviews["excluded_reply_timestamp_count"]:
            reasons.append("reply_timestamp_anomalies")
        if any(value is None for value in visibility.values()):
            reasons.append("visibility_metrics_unavailable")
        return {
            "business": {"id": business.pk, "name": business.BUSN_NAME, "status": business.BUSN_STATUS},
            **visibility,
            "current_pocket_holders": PocketService.get_current_holder_count(business.pk, as_of=period.generated_at),
            "specialty_support": specialty_support,
            "current_valid_vouches": current_valid_vouches,
            "reviews": reviews,
            "snapshot_as_of": period.generated_at.isoformat(),
            "meta": standard_meta(period, availability="partial", partial_reasons=reasons),
            "sources": {
                "visibility": visibility_meta,
                "domain": standard_meta(
                    period, coverage_verified=True, data_through=period.end,
                    partial_reasons=tuple(reason for reason in reasons if reason != "visibility_metrics_unavailable"),
                ),
            },
        }
