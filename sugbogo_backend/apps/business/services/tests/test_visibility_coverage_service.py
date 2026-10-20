from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings
from pymongo.errors import AutoReconnect, BulkWriteError

from apps.business.services.visibility_coverage_service import VisibilityCoverageService
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityEventType,
    VisibilityTrackingUnavailable,
)
from apps.shared.analytics.date_ranges import resolve_period


class VisibilityCoverageTests(SimpleTestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 13, 4, 30, tzinfo=UTC)
        self.period = resolve_period(now=self.now)

    def test_receipts_never_certify_current_or_historical_or_seeded_coverage(self):
        with patch("apps.business.services.visibility_coverage_service.logger.log") as log:
            VisibilityCoverageService.observe(
                event_type="PROFILE_VISIT",
                business_ids=[9],
                occurred_at=self.now,
                outcome="accepted",
                recorded_count=100,
                duplicate_count=0,
            )
        historical_period = resolve_period(
            preset="custom",
            start_date="2020-01-01",
            end_date="2020-01-07",
            now=self.now,
        )
        for period in (self.period, historical_period):
            result = VisibilityCoverageService.assess(
                business_id=9,
                event_type="PROFILE_VISIT",
                period=period,
            )
            self.assertFalse(result["eligible"])
            self.assertIn("synthetic_provenance_unverified", result["reasons"])
        self.assertIn('"coverage_verified": false', log.call_args.args[2])
        self.assertNotIn("explorer_id", log.call_args.args[2])

    def test_ingestion_failure_and_cooldown_are_observed_and_propagated(self):
        errors = (
            VisibilityTrackingUnavailable(),
            VisibilityTrackingUnavailable(cooldown_short_circuit=True),
            AutoReconnect("unacknowledged"),
        )
        for error in errors:
            with self.subTest(error=type(error).__name__):
                with (
                    patch.object(
                        VisibilityEventService,
                        "_persist_events",
                        side_effect=error,
                    ),
                    patch.object(VisibilityCoverageService, "observe") as observe,
                ):
                    with self.assertRaises(type(error)):
                        VisibilityEventService._record_events(
                            VisibilityEventType.SAVE,
                            1,
                            [9],
                            self.now,
                        )
                    self.assertEqual(observe.call_args.kwargs["outcome"], "failed")

    def test_excluded_self_interactions_do_not_produce_ingestion_receipts(self):
        result = SimpleNamespace(recorded_count=0, duplicate_count=0)
        with (
            patch.object(
                VisibilityEventService,
                "_persist_events",
                return_value=result,
            ),
            patch.object(VisibilityCoverageService, "observe") as observe,
        ):
            VisibilityEventService._record_events(
                VisibilityEventType.PROFILE_VISIT,
                1,
                [],
                self.now,
            )
        observe.assert_not_called()

    @override_settings(TIME_ZONE="Asia/Manila")
    def test_changed_deduplication_definitions_are_not_comparable(self):
        result = VisibilityCoverageService.assess(
            business_id=9,
            event_type="SAVE",
            period=self.period,
        )
        self.assertIn("deduplication_timezone_mismatch", result["reasons"])

    def test_monitoring_sink_failure_does_not_break_a_recorded_event(self):
        with patch(
            "apps.business.services.visibility_coverage_service.logger.log",
            side_effect=RuntimeError("sink failed"),
        ):
            VisibilityCoverageService.observe(
                event_type="SAVE",
                business_ids=[9],
                occurred_at=self.now,
                outcome="accepted",
                recorded_count=1,
            )

    def test_duplicate_errors_do_not_hide_unacknowledged_persistence(self):
        collection = Mock()
        collection.bulk_write.side_effect = BulkWriteError(
            {
                "writeErrors": [{"code": 11000}],
                "writeConcernErrors": [{"code": 64}],
                "nUpserted": 0,
            },
        )
        with (
            patch.object(VisibilityEventService, "ensure_indexes"),
            patch.object(
                VisibilityEventService,
                "_get_collection",
                return_value=collection,
            ),
            patch.object(VisibilityEventService, "_mark_temporarily_unavailable"),
            patch.object(VisibilityCoverageService, "observe") as observe,
        ):
            with self.assertRaises(VisibilityTrackingUnavailable):
                VisibilityEventService._record_events(
                    VisibilityEventType.PROFILE_VISIT,
                    1,
                    [9],
                    self.now,
                )
            self.assertEqual(observe.call_args.kwargs["outcome"], "failed")
