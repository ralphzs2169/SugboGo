"""Platform source population, availability and administrator contract tests."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.test import SimpleTestCase
from pymongo.errors import AutoReconnect
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.admin_operations.analytics.reporting_views import DiscoverySourcesView
from apps.admin_operations.analytics.services.discovery_sources_service import AdminDiscoverySourcesService
from apps.business.services.discovery_source import DiscoverySource
from apps.business.services.tests.discovery_source_fixtures import DiscoverySourceCollection
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class AdminDiscoverySourcesTests(SimpleTestCase):
    """Exercise the real shared aggregation without external storage."""

    def setUp(self):
        """Use a bounded historical period and a read-only Mongo fixture."""
        self.period = resolve_period(
            preset="custom",
            start_date="2026-10-01",
            end_date="2026-10-02",
            now=datetime(2026, 10, 4, tzinfo=UTC),
        )
        self.collection = DiscoverySourceCollection()
        target = patch.object(VisibilityEventService, "_get_collection", return_value=self.collection)
        target.start()
        self.addCleanup(target.stop)
        cooldown = patch.object(VisibilityEventService, "_unavailable_until", 0)
        cooldown.start()
        self.addCleanup(cooldown.stop)

    def test_population_normalization_boundaries_and_reconciliation(self):
        """Include every business and unknown source, excluding other types and end boundary."""
        for index, source in enumerate([*DiscoverySource, None, "invalid"]):
            row = {
                "event_type": "PROFILE_VISIT",
                "business_id": index + 1,
                "explorer_id": 1,
                "occurred_at": self.period.start,
            }
            if source is not None:
                row["discovery_source"] = source
            self.collection.documents.append(row)
        template = self.collection.documents[0]
        self.collection.documents.extend([
            {**template, "occurred_at": self.period.end},
            {**template, "occurred_at": self.period.start - timedelta(microseconds=1)},
            {**template, "event_type": "IMPRESSION"},
        ])
        report = AdminDiscoverySourcesService.get_report(self.period)
        self.assertEqual(report["total_profile_visits"], 9)
        self.assertEqual(len(report["sources"]), 7)
        self.assertEqual(sum(row["count"] for row in report["sources"]), 9)
        unknown = next(row for row in report["sources"] if row["source"] == "UNKNOWN")
        self.assertEqual(unknown["count"], 3)
        self.assertEqual(unknown["share_percent"], 33.33)
        self.assertEqual(len(self.collection.calls), 1)
        self.assertNotIn("business_id", self.collection.calls[0][0]["$match"])
        self.assertEqual(self.collection.index_calls, [])

    def test_healthy_zero_and_unverified_metadata(self):
        """Zero counts do not certify delivery or invent a freshness watermark."""
        report = AdminDiscoverySourcesService.get_report(self.period)
        self.assertEqual(report["total_profile_visits"], 0)
        self.assertTrue(all(row["count"] == 0 for row in report["sources"]))
        self.assertTrue(all(row["share_percent"] is None for row in report["sources"]))
        self.assertEqual(report["meta"]["availability"], "partial")
        self.assertFalse(report["meta"]["coverage_verified"])
        self.assertIsNone(report["meta"]["data_through"])

    def test_missing_collection_and_failure_remain_null(self):
        """Missing storage and driver failures never become measured zeros."""
        self.collection.exists = False
        report = AdminDiscoverySourcesService.get_report(self.period)
        self.assertIn("visibility_collection_missing", report["meta"]["partial_reasons"])
        self.collection.error = AutoReconnect("fixture")
        report = AdminDiscoverySourcesService.get_report(self.period)
        self.assertIsNone(report["sources"])
        self.assertIsNone(report["total_profile_visits"])
        self.assertEqual(report["meta"]["availability"], "unavailable")

    def test_authorization_and_period_validation(self):
        """Authorize only active administrators and reuse shared date validation."""
        factory = APIRequestFactory()
        for role in User.UserRole.values:
            request = factory.get("/", {"period": "7"})
            force_authenticate(request, user=User(USER_ID=1, USER_ROLE=role, USER_STATUS=User.UserStatus.ACTIVE))
            response = DiscoverySourcesView.as_view()(request)
            expected = 200 if role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN) else 403
            self.assertEqual(response.status_code, expected)
        request = factory.get("/", {"period": "custom", "start_date": "invalid"})
        force_authenticate(request, user=User(USER_ID=1, USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE))
        self.assertEqual(DiscoverySourcesView.as_view()(request).status_code, 400)

    def test_rejects_ambiguous_scope_and_inactive_or_anonymous_access(self):
        """Fail closed on scope ambiguity and unauthorized callers."""
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            VisibilityEventService.get_profile_visit_sources(
                business_ids=[1],
                platform=True,
                start_time=self.period.start,
                end_time=self.period.end,
            )
        factory = APIRequestFactory()
        self.assertIn(DiscoverySourcesView.as_view()(factory.get("/")).status_code, (401, 403))
        request = factory.get("/")
        force_authenticate(
            request,
            user=User(
                USER_ID=1,
                USER_ROLE=User.UserRole.ADMIN,
                USER_STATUS=User.UserStatus.SUSPENDED,
            ),
        )
        self.assertEqual(DiscoverySourcesView.as_view()(request).status_code, 403)
