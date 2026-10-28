"""Administrator discovery reports over the existing visibility event store."""

from dataclasses import replace
from datetime import timedelta

from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityEventType,
    VisibilityTrackingUnavailable,
)
from apps.shared.analytics.comparisons import compare_values
from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.metadata import build_meta


class DiscoveryAnalyticsService:
    """Build source-aware discovery results without asserting tracking completeness."""

    EVENT_METRICS = {
        "impressions": VisibilityEventType.IMPRESSION,
        "profile_visits": VisibilityEventType.PROFILE_VISIT,
        "saves": VisibilityEventType.SAVE,
    }
    LABELS = {
        "impressions": "Recorded impressions",
        "profile_visits": "Recorded profile visits",
        "saves": "Recorded Pocket SAVE events",
        "distinct_engaged_explorers": "Discovery-active accounts (not total app MAU)",
    }
    EXPLORER_DESCRIPTION = (
        "Unique accounts with recorded discovery activity during this period, "
        "including Explorer and Merchant actors. This is not total app MAU. "
        "Historical roles are not reconstructed from event identities."
    )

    @staticmethod
    def previous_period(period):
        """Describe the adjacent equal-duration prior query without rounding its dates."""
        duration = period.end - period.start
        return replace(
            period,
            start_date=period.previous_start.astimezone(MANILA).date(),
            end_date=(period.previous_end - timedelta(microseconds=1)).astimezone(MANILA).date(),
            start=period.previous_start,
            end=period.previous_end,
            previous_start=period.previous_start - duration,
            previous_end=period.previous_start,
            includes_partial_day=False,
        )

    @classmethod
    def _read_period(cls, period, metric, interval, include_series):
        """Retain successful reads while representing individual MongoDB failures explicitly."""
        value = None
        series = None
        reasons = []
        query = {"start_time": period.start, "end_time": period.end}
        try:
            if metric == "distinct_engaged_explorers":
                value = VisibilityEventService.count_analytics_explorers(**query)
            else:
                totals = VisibilityEventService.get_analytics_totals(**query)
                value = totals[cls.EVENT_METRICS[metric].value]
        except VisibilityTrackingUnavailable:
            reasons.append("total_read_unavailable")

        if include_series:
            try:
                if metric == "distinct_engaged_explorers":
                    rows = VisibilityEventService.get_analytics_explorer_series(
                        **query, interval=interval,
                    )
                else:
                    rows = VisibilityEventService.get_analytics_series(
                        **query, interval=interval,
                    )
                    rows = [
                        row for row in rows
                        if row["event_type"] == cls.EVENT_METRICS[metric].value
                    ]
                series = [
                    {
                        "date": row["date"],
                        "start": row["start"],
                        "end_exclusive": row["end_exclusive"],
                        "value": row["count"],
                    }
                    for row in rows
                ]
            except VisibilityTrackingUnavailable:
                reasons.append("series_read_unavailable")

        no_data = value is None and (not include_series or series is None)
        availability = "unavailable" if no_data else "partial" if reasons else "available"
        # First/last event timestamps cannot certify coverage or a source watermark.
        meta = build_meta(period, availability=availability, partial_reasons=reasons)
        return {"value": value, "series": series, "meta": meta}

    @staticmethod
    def _comparison(current, previous):
        """Suppress growth claims for unavailable or unverified visibility observations."""
        comparison = compare_values(
            current=current["value"],
            previous=previous["value"],
            current_sample_size=current["value"],
            previous_sample_size=previous["value"],
            data_available=False,
        )
        if current["value"] is not None and previous["value"] is not None:
            comparison["reason"] = "coverage_unverified"
        return comparison

    @classmethod
    def get_report(
        cls, period, *, metric="profile_visits", interval="daily", include_series=True,
    ):
        """Return recorded totals, optional sparse series, and independent period metadata."""
        if metric not in cls.LABELS:
            raise ValidationError({"metric": "Unsupported discovery metric."})
        if interval not in {"daily", "weekly"}:
            raise ValidationError({"interval": "Choose daily or weekly."})
        current = cls._read_period(period, metric, interval, include_series)
        previous = cls._read_period(cls.previous_period(period), metric, interval, False)
        meta = current["meta"].copy()
        if previous["meta"]["availability"] == "unavailable":
            meta["is_partial"] = True
            if meta["availability"] == "available":
                meta["availability"] = "partial"
            meta["partial_reasons"] = [*meta["partial_reasons"], "previous_period_unavailable"]
        return {
            "metric": metric,
            "label": cls.LABELS[metric],
            "description": cls.EXPLORER_DESCRIPTION if metric == "distinct_engaged_explorers" else (
                "Recorded events retain existing UTC-day deduplication; coverage is unverified."
            ),
            "measurement_type": "period",
            "value": current["value"],
            "previous_value": previous["value"],
            "change": cls._comparison(current, previous),
            "interval": interval,
            "series": current["series"],
            "series_is_sparse": True,
            "meta": meta,
            "sources": {
                "visibility_current": current["meta"],
                "visibility_previous": previous["meta"],
            },
        }
