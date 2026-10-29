"""Platform transportation planning observations, separate from completed travel."""

from datetime import UTC, datetime

from apps.business.models import Business
from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.metadata import build_meta

from .reporting_helpers import calendar_buckets


class TransportationPlanningService:
    """Reconcile one Mongo aggregate and one bounded business-name lookup."""

    METHODS = (
        ("ROAD_ROUTE", "Road routes"),
        ("JEEPNEY", "Jeepney guidance"),
        ("OTHER", "Other recorded methods"),
    )

    @classmethod
    def get_report(
        cls,
        period,
        interval="weekly",
    ):
        """Preserve unknown coverage and tracking boundaries in every output."""
        aggregate, started_at, reason = RoutePlanningEventService.read_platform(
            period,
            interval,
        )
        reasons = ["best_effort_delivery"]
        if reason:
            reasons.append(reason)
        if started_at is not None and period.start < started_at < period.end:
            reasons.append("tracking_started_during_period")
        result = {
            "total_requests": None,
            "distinct_requesting_accounts": None,
            "requests_without_account_identity": None,
            "methods": None,
            "series": None,
            "destinations": None,
            "destination_limit": 10,
            "unavailable_destinations_in_ranking": None,
            "tracking_started_at": started_at,
            "interval": interval,
            "definitions": {
                "population": "All stored method-bearing planning events in the selected period after tracking started. No current business status or owner filter is added at read time. Business owners are excluded at ingestion.",
                "deduplication": "One recorded request per account, business, navigation method and UTC day. Counts are not every invocation, completed journeys, physical visits or conversion.",
                "accounts": "Period-wide distinct positive numeric account identities are counted directly, across all methods and businesses. Never sum daily or merchant distinct counts. Requests without usable account identity remain in request totals and are disclosed separately.",
                "coverage": "Delivery completeness and freshness are unverified. Empty event buckets after tracking began have no observed count, not certified zero activity. Buckets before tracking remain unavailable.",
                "destinations": "Top ten recorded destination IDs with current public business names. Missing businesses remain in the ranking and totals, without navigation. No destination events are excluded; this bounded ranking is not the full inventory.",
                "methods": "Unknown recorded method values are grouped as Other and included in the total and share denominator.",
            },
            "meta": build_meta(
                period,
                availability="unavailable" if aggregate is None else "available",
                partial_reasons=reasons,
            ),
        }
        if aggregate is None:
            return result
        counts = {
            row["_id"]: row["count"]
            for row in aggregate["methods"]
        }
        total = sum(counts.values())
        result["total_requests"] = total
        result["distinct_requesting_accounts"] = next(
            (row["count"] for row in aggregate["accounts"]),
            0,
        )
        result["requests_without_account_identity"] = next(
            (row["count"] for row in aggregate["unknown_accounts"]),
            0,
        )
        result["methods"] = []
        for method, label in cls.METHODS:
            count = counts.get(method, 0)
            share = None
            if total:
                share = round(count / total * 100, 2)
            result["methods"].append({
                "method": method,
                "label": label,
                "count": count,
                "share_percent": share,
            })
        observed = {}
        for row in aggregate["series"]:
            bucket = row["_id"]["bucket"]
            if bucket.tzinfo is None:
                bucket = bucket.replace(tzinfo=UTC)
            observed[(bucket, row["_id"]["method"])] = row["count"]
        result["series"] = []
        for bucket in calendar_buckets(period, interval):
            start = datetime.fromisoformat(bucket["start"])
            end = datetime.fromisoformat(bucket["end_exclusive"])
            # The first bucket can start midweek; find its actual Mongo bucket by local date.
            key_start = (
                datetime.fromisoformat(bucket["date"])
                .replace(tzinfo=MANILA)
                .astimezone(UTC)
            )
            values = {}
            for method, label in cls.METHODS:
                values[method.lower()] = observed.get((key_start, method))
            observation_start = None
            if end > started_at:
                observation_start = max(start, started_at)
            result["series"].append({
                **bucket,
                "observation_start": observation_start,
                "tracking_started": end > started_at,
                **values,
            })
        ids = [
            row["_id"]
            for row in aggregate["destinations"]
            if type(row["_id"]) is int and row["_id"] > 0
        ]
        names = dict(
            Business.objects.filter(pk__in=ids).values_list(
                "pk",
                "BUSN_NAME",
            ),
        )
        result["destinations"] = []
        missing = 0
        for row in aggregate["destinations"]:
            business_id = row["_id"]
            name = None
            if type(business_id) is int:
                name = names.get(business_id)
            if name is None:
                missing += 1
            result["destinations"].append({
                "business_id": business_id if type(business_id) is int else None,
                "business_name": name,
                "count": row["count"],
                "road_route": row["road_route"],
                "jeepney": row["jeepney"],
                "other": row["other"],
            })
        result["unavailable_destinations_in_ranking"] = missing
        return result
