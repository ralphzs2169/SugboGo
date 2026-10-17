"""Presentation evidence for the administrator's geographic discovery heatmap."""

from rest_framework.exceptions import ValidationError

from apps.admin_operations.analytics.services.geographic_aggregation_service import GeographicAggregationService


class DiscoveryHeatmapService:
    """Adapt the shared geographic report for one consistent map and table."""

    @staticmethod
    def cell_state(cell):
        """Distinguish population absence, unavailable observations and readable activity."""
        if cell["eligible_businesses"] == 0:
            return "no_businesses"
        if cell["profile_visits"] is None:
            return "visibility_unavailable"
        return "recorded_visits" if cell["profile_visits"] > 0 else "zero_recorded_visits"

    @classmethod
    def get_report(cls, period, *, cluster=None, category=None, cell=None):
        """Reuse geographic attribution and add selection states and a scope-wide count legend."""
        report = GeographicAggregationService.get_report(period, cluster=cluster, category=category)
        all_cells = report["cells"]
        selected = None
        if all_cells is not None:
            selected = [row for row in all_cells if cell is None or row["id"] == cell]
            if cell is not None and not selected:
                raise ValidationError({"cell": "The cell is outside the approved reporting grid."})
            selected = [{**row, "state": cls.cell_state(row)} for row in selected]
        visibility_readable = report["sources"]["visibility"]["availability"] != "unavailable"
        measurable = all_cells is not None and visibility_readable
        selected_businesses = sum(row["eligible_businesses"] for row in selected) if selected is not None else None
        selected_visits = sum(row["profile_visits"] for row in selected) if selected is not None and visibility_readable else None
        if selected is None:
            state = "geography_unavailable"
        elif selected_businesses == 0:
            state = "no_businesses"
        elif not visibility_readable:
            state = "visibility_unavailable"
        else:
            state = "recorded_visits" if selected_visits > 0 else "zero_recorded_visits"
        return {
            **report,
            "label": "Recorded discovery activity at current business locations",
            "description": "Business-profile visits in fixed 1 km Cebu City cells; not physical arrivals or explorer movement.",
            "metric": "profile_visits", "measurement_type": "period_current_state",
            "cells": selected, "display_state": state,
            "selection": {
                "cell": cell, "returned_cells": len(selected) if selected is not None else None,
                "total_scope_cells": len(all_cells) if all_cells is not None else None,
                "eligible_businesses": selected_businesses, "profile_visits": selected_visits,
                "reconciliation_scope": "full_filtered_inventory",
            },
            "legend": {
                "method": "linear_count", "unit": "recorded_profile_visits",
                "minimum": 0 if measurable else None,
                "maximum": max((row["profile_visits"] for row in all_cells), default=0) if measurable else None,
                "scope": "full_filtered_reporting_scope",
                "zero_range": all(row["profile_visits"] == 0 for row in all_cells) if measurable else None,
            },
        }
