"""Owned-business timing of recorded profile visits without opening-hour inference."""

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.metadata import build_meta

from .premium_common import owned_business_data


class EngagementHeatmapService:
    """Build one bounded weekday/hour matrix from an owned business's event observations."""

    WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    NOTE = (
        "Recorded profile-visit timestamps retain daily deduplication; later visits in the same UTC day "
        "are not additional events. Counts are not physical arrivals, every interaction, or recommended opening hours."
    )

    @staticmethod
    def period_occurrences(period):
        """Count selected calendar occurrences per Manila slot without iterating the whole date range."""
        start = period.start.astimezone(MANILA)
        end = period.end.astimezone(MANILA)
        # Shared report periods start at local midnight; only the final date can be partial.
        whole_days = (end.date() - start.date()).days
        whole_weeks, remaining_days = divmod(whole_days, 7)
        counts = {(weekday, hour): whole_weeks for weekday in range(1, 8) for hour in range(24)}
        for offset in range(remaining_days):
            weekday = (start.weekday() + offset) % 7 + 1
            for hour in range(24):
                counts[(weekday, hour)] += 1
        partial = bool(end.minute or end.second or end.microsecond)
        for hour in range(end.hour + int(partial)):
            counts[(end.isoweekday(), hour)] += 1
        return counts, (end.isoweekday(), end.hour) if partial else None

    @classmethod
    def get_report(cls, user, period):
        """Resolve ownership and derive totals, cells and sample context from a single scoped read."""
        business = BusinessProfileService.get_business_for_merchant(user)
        occurrences, partial_slot = cls.period_occurrences(period)
        try:
            rows = VisibilityEventService.get_profile_visit_timing(
                business_ids=[business.pk], start_time=period.start, end_time=period.end,
            )
        except VisibilityTrackingUnavailable:
            rows = None
        counts = {(row["weekday"], row["hour"]): row["count"] for row in rows} if rows is not None else None
        cells = []
        for (weekday, hour), occurrence_count in occurrences.items():
            if occurrence_count == 0:
                value, state = None, "outside_period"
            elif counts is None:
                value, state = None, "visibility_unavailable"
            else:
                value = counts.get((weekday, hour), 0)
                state = "recorded_visits" if value else "zero_recorded_visits"
            cells.append({
                "id": f"{weekday}:{hour}", "weekday": weekday, "hour": hour,
                "profile_visits": value, "state": state,
                "period_occurrences": occurrence_count,
                "includes_partial_hour": (weekday, hour) == partial_slot,
            })
        total = sum(counts.values()) if counts is not None else None
        nonzero = sum(value > 0 for value in counts.values()) if counts is not None else None
        meta = build_meta(
            period, availability="unavailable" if counts is None else "available",
            partial_reasons=("daily_deduplicated_event_timing", "no_timing_inference_policy"),
        )
        return {
            "business": owned_business_data(business),
            "label": "Recorded profile-visit timing", "metric": "profile_visits",
            "timezone": "Asia/Manila", "grid_version": "manila-weekday-hour-v1",
            "weekdays": [{"weekday": index, "label": label} for index, label in enumerate(cls.WEEKDAYS, 1)],
            "hours": list(range(24)), "cells": cells,
            "total_profile_visits": total,
            "display_state": "visibility_unavailable" if total is None else "recorded_visits" if total else "zero_recorded_visits",
            "sample": {
                "nonzero_cells": nonzero,
                "in_period_cells": sum(value > 0 for value in occurrences.values()),
                "outside_period_cells": sum(value == 0 for value in occurrences.values()),
                "conclusions_available": False, "reason": "no_approved_timing_inference_policy",
            },
            "legend": {
                "method": "linear_count", "minimum": 0 if counts is not None else None,
                "maximum": max(counts.values(), default=0) if counts is not None else None,
                "zero_range": total == 0 if total is not None else None,
            },
            "deduplication": "explorer_business_event_type_utc_day",
            "measurement_note": cls.NOTE,
            "period_occurrences_note": "Selected calendar occurrences, not verified tracking coverage or business opening hours.",
            "sources": {"visibility": build_meta(period, availability="unavailable" if counts is None else "available")},
            "meta": meta,
        }
