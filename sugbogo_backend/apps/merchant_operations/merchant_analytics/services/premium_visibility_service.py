"""Premium trends over recorded visibility events without certifying tracking coverage."""

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.business.services.visibility_coverage_service import VisibilityCoverageService
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.shared.analytics.comparisons import compare_values
from apps.shared.analytics.metadata import build_meta

from .premium_common import owned_business_data, previous_period


class PremiumVisibilityService:
    """Read independent event metrics for the authenticated merchant's owned business."""

    @staticmethod
    def read_metric(
        business_id,
        period,
        event_type,
        interval,
        *,
        distinct=False,
        include_series=True,
        coverage_verified=False,
    ):
        """Retain successful totals or series when a separate MongoDB read fails."""
        query = {"business_ids": [business_id], "start_time": period.start, "end_time": period.end}
        value = None
        series = None
        reasons = []
        try:
            value = (
                VisibilityEventService.count_analytics_explorers(**query, event_type=event_type)
                if distinct else VisibilityEventService.get_analytics_totals(**query)[event_type]
            )
        except VisibilityTrackingUnavailable:
            reasons.append("total_read_unavailable")
        if include_series:
            try:
                if distinct:
                    rows = VisibilityEventService.get_analytics_explorer_series(
                        **query, interval=interval, event_type=event_type,
                    )
                else:
                    rows = [row for row in VisibilityEventService.get_analytics_series(**query, interval=interval)
                            if row["event_type"] == event_type]
                series = [{"date": row["date"], "start": row["start"],
                           "end_exclusive": row["end_exclusive"], "value": row["count"]} for row in rows]
            except VisibilityTrackingUnavailable:
                reasons.append("series_read_unavailable")
        unavailable = value is None and (not include_series or series is None)
        return {
            "value": value, "series": series,
            "meta": build_meta(period, availability="unavailable" if unavailable else "partial" if reasons else "available",
                               partial_reasons=reasons, coverage_verified=coverage_verified,
                               data_through=period.end if coverage_verified else None),
        }

    @classmethod
    def metric(
        cls,
        business_id,
        period,
        event_type,
        interval,
        *,
        distinct=False,
    ):
        """Calculate changes only after the coverage gate approves both reporting windows."""
        eligibility = VisibilityCoverageService.assess(
            business_id=business_id,
            event_type=event_type,
            period=period,
        )
        current = cls.read_metric(
            business_id,
            period,
            event_type,
            interval,
            distinct=distinct,
            coverage_verified=eligibility["eligible"],
        )
        previous = cls.read_metric(
            business_id,
            previous_period(period),
            event_type,
            interval,
            distinct=distinct,
            include_series=False,
            coverage_verified=eligibility["eligible"],
        )
        change = compare_values(
            current=current["value"],
            previous=previous["value"],
            current_sample_size=current["value"],
            previous_sample_size=previous["value"],
            minimum_sample_size=0,
            data_available=eligibility["eligible"],
        )
        if not eligibility["eligible"]:
            change["reason"] = eligibility["reason"]
        return {
            "value": current["value"], "previous_value": previous["value"], "change": change,
            "series": current["series"], "series_is_sparse": True,
            "sources": {"current": current["meta"], "previous": previous["meta"]},
            "comparison_eligibility": eligibility,
        }

    @classmethod
    def get_report(cls, user, period, *, interval="daily", pocket=False):
        """Derive business ownership before querying only its recorded event scope."""
        business = BusinessProfileService.get_business_for_merchant(user)
        definitions = (
            {"saves": ("SAVE", False), "distinct_savers": ("SAVE", True)} if pocket else
            {"impressions": ("IMPRESSION", False), "profile_visits": ("PROFILE_VISIT", False),
             "distinct_profile_visitors": ("PROFILE_VISIT", True)}
        )
        metrics = {name: cls.metric(business.pk, period, kind, interval, distinct=distinct)
                   for name, (kind, distinct) in definitions.items()}
        sources = [source for metric in metrics.values() for source in metric["sources"].values()]
        unavailable = all(source["availability"] == "unavailable" for source in sources)
        reasons = ["visibility_read_unavailable"] if any(
            reason in source["partial_reasons"] for source in sources
            for reason in ("total_read_unavailable", "series_read_unavailable")
        ) else []
        return {
            "business": owned_business_data(business), "interval": interval, "metrics": metrics,
            "meta": build_meta(period, availability="unavailable" if unavailable else "partial", partial_reasons=reasons),
            "measurement_note": "Recorded events retain UTC-day deduplication. Period uniques are not sums of bucket uniques.",
        }
