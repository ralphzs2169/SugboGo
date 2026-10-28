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

from .reporting_helpers import calendar_buckets


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

    DEFINITIONS = {
        "profile_visits": "Recorded PROFILE_VISIT events during the selected period.",
        "impressions": "Recorded IMPRESSION events during the selected period.",
        "saves": (
            "Recorded SAVE events during the selected period; "
            "not current Pocket inventory or churn."
        ),
        "deduplication": (
            "Stored events retain the event-type, actor, business "
            "and UTC-day deduplication key."
        ),
        "missing_observations": (
            "Timeline buckets without an observed aggregate are null, not measured zero. "
            "No tracking completeness or source watermark is inferred from the last event."
        ),
        "comparisons": (
            "Previous-period comparisons are hidden while discovery tracking "
            "coverage is not fully verified."
        ),
    }

    @classmethod
    def get_summary(
        cls,
        period,
    ):
        """Read all three recorded period totals in one existing visibility aggregation."""
        values = {
            metric: None
            for metric in cls.EVENT_METRICS
        }
        availability = "available"
        reasons = ()
        try:
            totals = VisibilityEventService.get_analytics_totals(
                start_time=period.start,
                end_time=period.end,
            )
            values = {
                metric: totals[event.value]
                for metric, event in cls.EVENT_METRICS.items()
            }
        except VisibilityTrackingUnavailable:
            availability = "unavailable"
            reasons = ("total_read_unavailable",)
        return {
            "totals": values,
            "definitions": cls.DEFINITIONS,
            "meta": build_meta(
                period,
                availability=availability,
                partial_reasons=reasons,
            ),
        }

    @staticmethod
    def build_timeline(
        period,
        interval,
        series,
    ):
        """Add every effective calendar bucket while keeping unobserved counts null."""
        if series is None:
            return None
        observed = {
            row["date"]: row["value"]
            for row in series
        }
        timeline = []
        for bucket in calendar_buckets(period, interval):
            timeline.append({
                **bucket,
                "value": observed.get(bucket["date"]),
                "in_progress": (
                    period.includes_partial_day
                    and bucket["end_exclusive"] == period.end.isoformat()
                ),
            })
        return timeline

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
        timeline = None
        if include_series:
            timeline = cls.build_timeline(
                period,
                interval,
                current["series"],
            )
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
            "timeline": timeline,
            "definitions": cls.DEFINITIONS,
            "meta": meta,
            "sources": {
                "visibility_current": current["meta"],
                "visibility_previous": previous["meta"],
            },
        }
