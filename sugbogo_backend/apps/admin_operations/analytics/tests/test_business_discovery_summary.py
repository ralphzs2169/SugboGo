"""Business-scoped visits reuse the existing protected discovery-summary response."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.urls import reverse
from pymongo.errors import AutoReconnect
from rest_framework.test import APITestCase

from apps.business.models import Business
from apps.business.services.tests.test_visibility_analytics_service import ReadOnlyCollection
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.reviews.services.tests.test_business_review_summary_service import SummaryFixtureMixin
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class BusinessDiscoverySummaryTests(SummaryFixtureMixin, APITestCase):
    """Verify real read-only event aggregation and availability independently of detail SQL."""

    def setUp(self):
        """Freeze the shared reporting clock and isolate MongoDB with the established fake."""
        self.business = self.create_business()
        self.other_business = self.create_business(1)
        self.admin = User.objects.create_user(
            email="business-visits-admin@example.com",
            password=None,
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.admin)
        self.url = reverse("admin-discovery-summary")
        self.params = {"business_id": self.business.pk, "period": "30"}
        self.now = datetime(2026, 11, 3, 4, 30, tzinfo=UTC)
        self.period = resolve_period(preset="30", now=self.now)
        clock = patch(
            "apps.shared.analytics.date_ranges.timezone.now",
            return_value=self.now,
        )
        clock.start()
        self.addCleanup(clock.stop)
        self.collection = ReadOnlyCollection([])
        collection = patch.object(
            VisibilityEventService,
            "_get_collection",
            return_value=self.collection,
        )
        collection.start()
        self.addCleanup(collection.stop)
        indexes = patch.object(
            VisibilityEventService,
            "ensure_indexes",
            side_effect=AssertionError("Analytics must not create indexes."),
        )
        indexes.start()
        self.addCleanup(indexes.stop)
        original_cooldown = VisibilityEventService._unavailable_until
        VisibilityEventService._unavailable_until = 0
        self.addCleanup(
            setattr,
            VisibilityEventService,
            "_unavailable_until",
            original_cooldown,
        )

    def event(
        self,
        event_type,
        occurred_at,
        business_id=None,
    ):
        """Add an already-recorded event without changing ingestion or deduplication rules."""
        if business_id is None:
            business_id = self.business.pk
        self.collection.documents.append({
            "event_type": event_type,
            "business_id": business_id,
            "explorer_id": 1,
            "occurred_at": occurred_at,
        })

    def test_thirty_day_scope_boundaries_and_event_types(self):
        """Count daily retained profile visits rather than impressions or distinct accounts."""
        self.event("PROFILE_VISIT", self.period.start)
        self.event("PROFILE_VISIT", self.period.start + timedelta(days=1))
        self.event("PROFILE_VISIT", self.period.start - timedelta(microseconds=1))
        self.event("PROFILE_VISIT", self.period.end)
        self.event("PROFILE_VISIT", self.period.start, self.other_business.pk)
        self.event("IMPRESSION", self.period.start)
        self.event("SAVE", self.period.start)
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")
        response = self.client.get(self.url, self.params)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["business_id"], self.business.pk)
        self.assertEqual(data["totals"], {
            "profile_visits": 2,
            "impressions": 1,
            "saves": 1,
        })
        meta = data["meta"]
        self.assertEqual(meta["period"]["timezone"], "Asia/Manila")
        self.assertEqual(meta["period"]["start_date"], "2026-10-05")
        self.assertEqual(meta["period"]["end_date"], "2026-11-03")
        self.assertEqual(meta["period"]["end_exclusive"], self.now.isoformat())
        self.assertEqual(meta["generated_at"], self.now.isoformat())
        self.assertFalse(meta["coverage_verified"])
        self.assertIsNone(meta["data_through"])
        self.assertIn("coverage_unverified", meta["partial_reasons"])
        self.assertEqual(len(self.collection.calls), 1)
        match = self.collection.calls[0][0]["$match"]
        self.assertEqual(match["business_id"], {"$in": [self.business.pk]})
        self.assertEqual(match["occurred_at"]["$gte"], self.period.start)
        self.assertEqual(match["occurred_at"]["$lt"], self.period.end)
        self.assertIn("not physical visits", data["definitions"]["profile_visits"])
        self.assertIn("UTC-day", data["definitions"]["deduplication"])

    def test_successful_empty_read_returns_zero(self):
        """Retain a numeric zero while still disclosing unverified tracking coverage."""
        response = self.client.get(self.url, self.params)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["totals"]["profile_visits"], 0)
        self.assertEqual(data["meta"]["availability"], "partial")

    def test_source_failure_is_null_and_never_breaks_relational_detail(self):
        """Turn MongoDB failure into local analytics unavailability without a fake zero."""
        with patch.object(
            self.collection,
            "aggregate",
            side_effect=AutoReconnect("test outage"),
        ):
            response = self.client.get(self.url, self.params)
            detail = self.client.get(f"/api/admin/businesses/{self.business.pk}/")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertIsNone(data["totals"]["profile_visits"])
        self.assertEqual(data["meta"]["availability"], "unavailable")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["data"]["id"], self.business.pk)

    def test_missing_collection_does_not_become_a_zero(self):
        """Preserve the event store's explicit missing-source reason."""
        self.collection.database.list_collection_names = lambda **kwargs: []
        response = self.client.get(self.url, self.params)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertIsNone(data["totals"]["profile_visits"])
        self.assertIn("visibility_collection_missing", data["meta"]["partial_reasons"])

    def test_invalid_or_missing_business_is_rejected_before_mongo(self):
        """Never let an invalid business selector accidentally produce a platform total."""
        for value in ("0", "-1", "abc", "1.5", ""):
            with self.subTest(value=value):
                response = self.client.get(self.url, {"business_id": value})
                self.assertEqual(response.status_code, 400)
        response = self.client.get(self.url, {"business_id": 99999999})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.collection.calls, [])

    def test_scope_keeps_existing_admin_permissions_and_default_period(self):
        """Require active administrative authority for business-scoped observations."""
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.admin.USER_ROLE = role
            self.admin.save(update_fields=["USER_ROLE"])
            response = self.client.get(self.url, {"business_id": self.business.pk})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                response.data["data"]["meta"]["period"]["start"],
                self.period.start.isoformat(),
            )
        self.collection.calls.clear()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url, self.params).status_code, 401)
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
        ):
            self.client.force_authenticate(User(USER_ROLE=role, USER_STATUS=status))
            self.assertEqual(self.client.get(self.url, self.params).status_code, 403)
        self.assertEqual(self.collection.calls, [])
