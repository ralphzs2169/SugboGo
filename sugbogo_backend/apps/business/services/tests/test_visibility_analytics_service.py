from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase, override_settings
from pymongo.errors import AutoReconnect
from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)


class ReadOnlyCollection:
    """Evaluate the supported Mongo primitives against event fixtures in memory."""

    def __init__(self, documents):
        self.documents = documents
        self.calls = []

    def expression(self, row, expression):
        if isinstance(expression, str) and expression.startswith("$"):
            value = row
            for part in expression[1:].split("."):
                value = value[part]
            return value
        if isinstance(expression, dict) and "$dateTrunc" in expression:
            options = expression["$dateTrunc"]
            value = self.expression(row, options["date"]).astimezone(ZoneInfo(options["timezone"]))
            value = value.replace(hour=0, minute=0, second=0, microsecond=0)
            if options["unit"] == "week":
                if options["startOfWeek"] != "monday":
                    raise AssertionError("Unexpected week boundary.")
                value -= timedelta(days=value.weekday())
            return value.astimezone(UTC).replace(tzinfo=None)
        if isinstance(expression, dict):
            return {key: self.expression(row, value) for key, value in expression.items()}
        return expression

    def aggregate(self, pipeline):
        self.calls.append(pipeline)
        rows = list(self.documents)
        for stage in pipeline:
            if "$match" in stage:
                def matches(row):
                    for key, condition in stage["$match"].items():
                        value = row[key]
                        if not isinstance(condition, dict):
                            if value != condition:
                                return False
                            continue
                        for operator, expected in condition.items():
                            if operator == "$in" and value not in expected:
                                return False
                            if operator == "$gte" and value < expected:
                                return False
                            if operator == "$lt" and value >= expected:
                                return False
                    return True
                rows = [row for row in rows if matches(row)]
            elif "$group" in stage:
                options = stage["$group"]
                groups = {}
                for row in rows:
                    identifier = self.expression(row, options["_id"])
                    key = tuple(identifier.items()) if isinstance(identifier, dict) else identifier
                    target = groups.setdefault(key, {"_id": identifier})
                    for field, accumulator in options.items():
                        if field == "_id":
                            continue
                        if "$sum" in accumulator:
                            target[field] = target.get(field, 0) + self.expression(row, accumulator["$sum"])
                        elif "$min" in accumulator:
                            value = self.expression(row, accumulator["$min"])
                            target[field] = min(target.get(field, value), value)
                        else:
                            raise AssertionError("Unexpected accumulator.")
                rows = list(groups.values())
            elif "$count" in stage:
                rows = [{stage["$count"]: len(rows)}] if rows else []
            elif "$sort" in stage:
                rows.sort(key=lambda row: tuple(self.expression(row, "$" + field) for field in stage["$sort"]))
            else:
                raise AssertionError("Unexpected or mutating aggregation stage.")
        return iter(rows)


@override_settings(MONGODB_VISIBILITY_FAILURE_COOLDOWN_SECONDS=30)
class VisibilityAnalyticsTests(SimpleTestCase):
    START = datetime(2026, 10, 4, 16, tzinfo=UTC)  # Manila Monday midnight.
    END = START + timedelta(days=8)

    def setUp(self):
        self.original_cooldown = VisibilityEventService._unavailable_until
        VisibilityEventService._unavailable_until = 0
        self.addCleanup(setattr, VisibilityEventService, "_unavailable_until", self.original_cooldown)
        self.documents = [
            self.event("PROFILE_VISIT", 1, 10, self.START),
            self.event("PROFILE_VISIT", 1, 10, self.START + timedelta(days=1)),
            self.event("PROFILE_VISIT", 2, 10, self.START + timedelta(days=2)),
            self.event("PROFILE_VISIT", 2, 20, self.START + timedelta(days=2)),
            self.event("SAVE", 2, 20, self.START + timedelta(days=3)),
            self.event("IMPRESSION", 3, 30, self.START + timedelta(days=7)),
            self.event("IMPRESSION", 9, 99, self.START - timedelta(seconds=1)),
            self.event("SAVE", 9, 99, self.END),
        ]
        self.collection = ReadOnlyCollection(self.documents)
        self.collection_patch = patch.object(VisibilityEventService, "_get_collection", return_value=self.collection)
        self.collection_patch.start()
        self.addCleanup(self.collection_patch.stop)
        self.index_patch = patch.object(VisibilityEventService, "ensure_indexes", side_effect=AssertionError("Index write attempted."))
        self.index_patch.start()
        self.addCleanup(self.index_patch.stop)

    @staticmethod
    def event(event_type, explorer_id, business_id, occurred_at):
        return {"event_type": event_type, "explorer_id": explorer_id,
                "business_id": business_id, "occurred_at": occurred_at}

    def query(self, method, **options):
        return method(start_time=self.START, end_time=self.END, **options)

    def test_totals_include_start_exclude_end_and_normalize_business_scope(self):
        totals = self.query(VisibilityEventService.get_analytics_totals)
        self.assertEqual(totals, {"PROFILE_VISIT": 4, "SAVE": 1, "IMPRESSION": 1})
        scoped = self.query(VisibilityEventService.get_analytics_totals, business_ids=[20, 10, 10])
        self.assertEqual(scoped, {"PROFILE_VISIT": 4, "SAVE": 1, "IMPRESSION": 0})
        self.assertEqual(self.collection.calls[-1][0]["$match"]["business_id"]["$in"], [10, 20])

    def test_period_distincts_do_not_add_daily_business_or_event_uniques(self):
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers), 3)
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers, business_ids=[10]), 2)
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers, business_ids=[10, 20]), 2)
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers, event_type="PROFILE_VISIT"), 2)
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers, event_type="SAVE"), 1)

    def test_distinct_series_counts_each_person_once_per_bucket_across_event_types(self):
        self.documents.append(self.event("IMPRESSION", 2, 20, self.START + timedelta(days=2)))
        rows = self.query(VisibilityEventService.get_analytics_explorer_series)
        self.assertEqual(
            [(row["date"], row["count"]) for row in rows],
            [("2026-10-05", 1), ("2026-10-06", 1), ("2026-10-07", 1),
             ("2026-10-08", 1), ("2026-10-12", 1)],
        )
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers), 3)
        self.assertEqual(sum(row["count"] for row in rows), 5)
        self.assertTrue(all(set(row) == {"date", "start", "end_exclusive", "count"} for row in rows))

    def test_distinct_weekly_series_collapses_multiple_days_and_clips_boundaries(self):
        rows = VisibilityEventService.get_analytics_explorer_series(
            start_time=self.START + timedelta(hours=1),
            end_time=self.END - timedelta(hours=1), interval="weekly",
        )
        self.assertEqual([(row["date"], row["count"]) for row in rows],
                         [("2026-10-05", 2), ("2026-10-12", 1)])
        self.assertEqual(rows[0]["start"], (self.START + timedelta(hours=1)).isoformat())
        self.assertEqual(rows[-1]["end_exclusive"], (self.END - timedelta(hours=1)).isoformat())
        self.assertEqual(self.query(VisibilityEventService.get_analytics_explorer_series, business_ids=[]), [])

    def test_distinct_series_failure_raises_without_index_initialization(self):
        with patch.object(self.collection, "aggregate", side_effect=AutoReconnect("Unavailable")):
            with self.assertRaises(VisibilityTrackingUnavailable):
                self.query(VisibilityEventService.get_analytics_explorer_series)

    def test_empty_scope_is_not_platform_and_healthy_empty_data_has_zero_counts(self):
        self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers, business_ids=[]), 0)
        self.assertEqual(self.query(VisibilityEventService.get_analytics_totals, business_ids=[]),
                         {"PROFILE_VISIT": 0, "SAVE": 0, "IMPRESSION": 0})
        self.assertEqual(self.query(VisibilityEventService.get_analytics_series, business_ids=[]), [])

    def test_daily_series_groups_manila_dates_not_utc_dates(self):
        rows = self.query(VisibilityEventService.get_analytics_series)
        visits = [row for row in rows if row["event_type"] == "PROFILE_VISIT"]
        self.assertEqual([(row["date"], row["count"]) for row in visits],
                         [("2026-10-05", 1), ("2026-10-06", 1), ("2026-10-07", 2)])
        self.assertEqual(sum(row["count"] for row in rows), 6)
        self.assertTrue(all("explorer_id" not in row for row in rows))

    def test_weekly_series_uses_monday_and_clips_partial_bucket_bounds(self):
        rows = VisibilityEventService.get_analytics_series(
            start_time=self.START + timedelta(hours=1), end_time=self.END - timedelta(hours=1), interval="weekly",
        )
        first = next(row for row in rows if row["event_type"] == "PROFILE_VISIT")
        self.assertEqual(first["date"], "2026-10-05")
        self.assertEqual(first["start"], (self.START + timedelta(hours=1)).isoformat())
        last = next(row for row in rows if row["date"] == "2026-10-12")
        self.assertEqual(last["end_exclusive"], (self.END - timedelta(hours=1)).isoformat())

    def test_first_observed_events_are_unbounded_and_missing_types_are_null(self):
        observed = VisibilityEventService.get_first_observed_events(business_ids=[10])
        self.assertEqual(observed["PROFILE_VISIT"], self.START)
        self.assertIsNone(observed["SAVE"])
        self.assertEqual(VisibilityEventService.get_first_observed_events()["IMPRESSION"],
                         self.START - timedelta(seconds=1))

    def test_mongo_failure_never_returns_zero_and_cooldown_blocks_retry(self):
        with patch.object(self.collection, "aggregate", side_effect=AutoReconnect("Unavailable")) as aggregate:
            with self.assertRaises(VisibilityTrackingUnavailable):
                self.query(VisibilityEventService.get_analytics_totals)
            with self.assertRaises(VisibilityTrackingUnavailable) as failure:
                self.query(VisibilityEventService.count_analytics_explorers)
            self.assertTrue(failure.exception.cooldown_short_circuit)
            self.assertEqual(aggregate.call_count, 1)

    def test_cursor_iteration_failure_is_also_unavailable(self):
        def failed_cursor():
            yield {"_id": "SAVE", "count": 2}
            raise AutoReconnect("Cursor disconnected")
        with patch.object(self.collection, "aggregate", return_value=failed_cursor()):
            with self.assertRaises(VisibilityTrackingUnavailable):
                self.query(VisibilityEventService.get_analytics_totals)

    def test_recovery_clears_cooldown_after_expiry(self):
        VisibilityEventService._unavailable_until = 5
        with patch.object(VisibilityEventService, "_get_monotonic_time", return_value=6):
            self.assertEqual(self.query(VisibilityEventService.count_analytics_explorers), 3)
        self.assertEqual(VisibilityEventService._unavailable_until, 0)

    def test_invalid_scope_window_and_event_type_are_rejected(self):
        for options in ({"business_ids": [True]}, {"business_ids": [-1]}, {"event_type": "CALL"}):
            with self.subTest(options=options), self.assertRaises(ValidationError):
                self.query(VisibilityEventService.count_analytics_explorers, **options)
        with self.assertRaises(ValidationError):
            VisibilityEventService.get_analytics_totals(start_time=self.END, end_time=self.START)
        with self.assertRaises(ValidationError):
            self.query(VisibilityEventService.get_analytics_series, interval="monthly")
        with self.assertRaises(ValidationError):
            self.query(VisibilityEventService.get_analytics_explorer_series, interval="monthly")
