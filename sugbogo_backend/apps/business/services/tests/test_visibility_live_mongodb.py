"""Explicitly opted-in live driver checks; never targets the application Mongo database."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
import os
import re
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

from django.conf import settings
from django.contrib.gis.geos import Point
from django.db import connection
from django.test import TestCase, override_settings
from django.urls import reverse
from pymongo import timeout
from pymongo.errors import AutoReconnect, PyMongoError
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.business.models import Business, Category, Cluster, Location
from apps.business.services.pocket_service import PocketService
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.date_ranges import resolve_period
from apps.shared.analytics.metadata import build_meta
from apps.shared.services.mongodb_service import MongoDBService
from apps.users.models import User


# Atlas Free permits database names up to 38 bytes; retain the full UUID.
TEMP_DATABASE_PREFIX = "sg_av_"


def validate_temporary_database(name, application_database):
    """Refuse application/externally selected names and require a complete random test namespace."""
    if not re.fullmatch(TEMP_DATABASE_PREFIX + r"[0-9a-f]{32}", name) or name == application_database:
        raise AssertionError("Refusing non-isolated live MongoDB test target.")


@skipUnless(os.environ.get("SUGBOGO_LIVE_MONGO_VERIFY") == "1", "Live Mongo checks are disabled; explicit approval/opt-in required.")
class VisibilityLiveMongoTests(TestCase):
    START = datetime(2026, 10, 4, 16, tzinfo=UTC)  # Manila Monday midnight.
    END = START + timedelta(days=8)

    @classmethod
    def setUpTestData(cls):
        sql_name = str(connection.settings_dict["NAME"])
        if connection.vendor != "postgresql" or not sql_name.startswith("test_") or sql_name == os.environ.get("DB_NAME"):
            raise AssertionError("Live checks require a separate test_ PostgreSQL/PostGIS database.")
        users = []
        for index in range(5):
            users.append(User.objects.create_user(
                email=f"live-mongo-fixture-{index}@example.com", password=None,
                USER_FNAME="Fixture", USER_LNAME=str(index), USER_REPUTATION=Decimal("0.50"),
                USER_ROLE=User.UserRole.MERCHANT if index < 2 else User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            ))
        cls.explorers = users[2:]
        cluster = Cluster.objects.create(CLUS_NAME="Live verification cluster")
        category = Category.objects.create(CTGRY_NAME="Live verification category", CLUS_ID=cluster)
        location = Location.objects.create(LOCT_POINT=Point(123.88, 10.31, srid=4326), LOCT_ADDRESS="Fixture location")
        cls.businesses = [Business.objects.create(
            BUSN_NAME=f"Live fixture {index}", BUSN_CONTACT_NUMBER="09170000000", USER_ID=users[index],
            CTGRY_ID=category, LOCT_ID=location,
        ) for index in range(2)]

    def live(self, action):
        """Bound driver operations and suppress raw exception text from test failure output."""
        try:
            with timeout(15):
                return action()
        except (PyMongoError, VisibilityTrackingUnavailable) as exc:
            raise AssertionError(f"Live Mongo operation failed: {type(exc).__name__}; code={getattr(exc, 'code', None)}.") from None

    def setUp(self):
        if not settings.MONGODB_URI or not settings.MONGODB_URI.strip():
            self.fail("An explicit configured MONGODB_URI is required.")
        self.application_database = settings.MONGODB_DATABASE
        self.temp_database = TEMP_DATABASE_PREFIX + uuid4().hex
        validate_temporary_database(self.temp_database, self.application_database)
        original_client = MongoDBService._client
        MongoDBService._client = None
        self.addCleanup(setattr, MongoDBService, "_client", original_client)
        self.client = self.live(MongoDBService.get_client)
        self.addCleanup(self.client.close)
        self.live(lambda: self.client.admin.command("ping"))
        # No user-supplied database name is accepted; refuse preexisting targets before writes.
        if self.temp_database in self.live(self.client.list_database_names):
            self.fail("Random verification target already exists; refusing writes or cleanup.")
        self.owned_database_name = self.temp_database
        overridden = override_settings(MONGODB_DATABASE=self.temp_database, TIME_ZONE="UTC")
        overridden.enable()
        self.addCleanup(overridden.disable)
        for attr, value in (("_indexes_initialized", False), ("_unavailable_until", 0)):
            original = getattr(VisibilityEventService, attr)
            setattr(VisibilityEventService, attr, value)
            self.addCleanup(setattr, VisibilityEventService, attr, original)
        # Production logger traces can include server details; sanitized failures remain visible.
        logging = patch("apps.business.services.visibility_event_service.logger.exception")
        logging.start()
        self.addCleanup(logging.stop)
        self.addCleanup(self.drop_owned_database)
        self.collection = self.client[self.temp_database][VisibilityEventService.COLLECTION_NAME]
        self.query = {"start_time": self.START, "end_time": self.END}

    def drop_owned_database(self):
        """Drop only this test's verified fresh namespace, including when assertions fail."""
        validate_temporary_database(self.owned_database_name, self.application_database)
        if self.owned_database_name != self.temp_database:
            raise AssertionError("Temporary database identity changed; refusing cleanup.")
        self.live(lambda: self.client.drop_database(self.owned_database_name))
        if self.owned_database_name in self.live(self.client.list_database_names):
            raise AssertionError(f"Temporary namespace cleanup incomplete: {self.owned_database_name}.")

    def record(self, kind, explorer, business, at):
        """Use public tracking writers with deterministic timestamps and real Mongo operations."""
        with patch.object(VisibilityEventService, "_get_current_time", return_value=at):
            if kind == "IMPRESSION":
                return self.live(lambda: VisibilityEventService.record_impressions(explorer.pk, [business.pk]))
            if kind == "PROFILE_VISIT":
                return self.live(lambda: VisibilityEventService.record_profile_visit(explorer.pk, business.pk))
            return self.live(lambda: VisibilityEventService.record_save(explorer.pk, business.pk))

    def test_signed_jwt_tracking_api_writes_and_duplicates_use_existing_indexes(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.explorers[0])}")
        with patch.object(VisibilityEventService, "_get_current_time", return_value=self.START):
            for url, body in (
                (reverse("business-impressions"), {"business_ids": [self.businesses[0].pk]}),
                (reverse("business-profile-visit", args=[self.businesses[0].pk]), {}),
            ):
                self.assertEqual(self.live(lambda: client.post(url, body, format="json")).status_code, 200)
                duplicate = self.live(lambda: client.post(url, body, format="json"))
                self.assertEqual(duplicate.status_code, 200)
                data = duplicate.data["data"]
                self.assertEqual(data.get("recorded_count", 0), 0)
                self.assertTrue(data.get("duplicate", data.get("duplicate_count") == 1))
        indexes = {row["name"]: row for row in self.live(lambda: list(self.collection.list_indexes()))}
        self.assertTrue(indexes[VisibilityEventService.DEDUPE_INDEX_NAME]["unique"])
        self.assertEqual(list(indexes[VisibilityEventService.AGGREGATION_INDEX_NAME]["key"].items()),
                         [("event_type", 1), ("business_id", 1), ("occurred_at", 1)])
        self.assertEqual(self.live(lambda: VisibilityEventService.get_analytics_totals(**self.query)),
                         {"IMPRESSION": 1, "PROFILE_VISIT": 1, "SAVE": 0})

    def test_utc_deduplication_and_manila_daily_weekly_buckets_are_distinct_rules(self):
        business, explorer = self.businesses[0], self.explorers[0]
        self.assertEqual(self.record("PROFILE_VISIT", explorer, business, self.START).recorded_count, 1)
        self.assertEqual(self.record("PROFILE_VISIT", explorer, business, self.START + timedelta(hours=7)).duplicate_count, 1)
        self.assertEqual(self.record("PROFILE_VISIT", explorer, business, self.START + timedelta(hours=8)).recorded_count, 1)
        for interval in ("daily", "weekly"):
            series = self.live(lambda: VisibilityEventService.get_analytics_series(**self.query, interval=interval))
            self.assertEqual(len(series), 1)
            self.assertEqual(series[0]["date"], "2026-10-05")
            self.assertEqual(series[0]["count"], 2)
        self.assertEqual(self.live(lambda: VisibilityEventService.count_analytics_explorers(**self.query, event_type="PROFILE_VISIT")), 1)

    def test_whole_period_uniques_are_not_sums_across_businesses_days_or_event_types(self):
        a, b, c = self.explorers
        self.record("PROFILE_VISIT", a, self.businesses[0], self.START)
        self.record("PROFILE_VISIT", a, self.businesses[0], self.START + timedelta(days=1))
        self.record("PROFILE_VISIT", a, self.businesses[1], self.START + timedelta(days=1))
        self.record("PROFILE_VISIT", b, self.businesses[0], self.START + timedelta(days=1))
        self.record("IMPRESSION", c, self.businesses[0], self.START)
        self.record("SAVE", a, self.businesses[0], self.START)
        self.assertEqual(self.live(lambda: VisibilityEventService.count_analytics_explorers(**self.query)), 3)
        self.assertEqual(self.live(lambda: VisibilityEventService.count_analytics_explorers(**self.query, event_type="PROFILE_VISIT")), 2)
        series = self.live(lambda: VisibilityEventService.get_analytics_explorer_series(**self.query, event_type="PROFILE_VISIT"))
        self.assertEqual(sum(row["count"] for row in series), 3)
        attention = self.live(lambda: VisibilityEventService.get_business_attention_metrics(
            **self.query, business_ids=[business.pk for business in self.businesses],
        ))
        self.assertEqual(attention[self.businesses[0].pk], {"profile_visits": 3, "saves": 1, "distinct_savers": 1})
        self.assertEqual(attention[self.businesses[1].pk]["profile_visits"], 1)

    def test_half_open_bounds_clipped_buckets_and_first_observation_do_not_certify_coverage(self):
        self.record("PROFILE_VISIT", self.explorers[1], self.businesses[0], self.START - timedelta(seconds=1))
        self.record("PROFILE_VISIT", self.explorers[0], self.businesses[0], self.START)
        self.record("PROFILE_VISIT", self.explorers[0], self.businesses[0], self.END)
        totals = self.live(lambda: VisibilityEventService.get_analytics_totals(**self.query))
        self.assertEqual(totals["PROFILE_VISIT"], 1)
        series = self.live(lambda: VisibilityEventService.get_analytics_series(**self.query, interval="weekly"))
        self.assertEqual(series[0]["start"], self.START.isoformat())
        self.assertEqual(series[0]["end_exclusive"], (self.START + timedelta(days=7)).isoformat())
        first = self.live(lambda: VisibilityEventService.get_first_observed_events())
        self.assertEqual(first["PROFILE_VISIT"], self.START - timedelta(seconds=1))
        period = resolve_period(preset="custom", start_date="2026-10-05", end_date="2026-10-12", now=self.END + timedelta(days=1))
        self.assertFalse(build_meta(period)["coverage_verified"])

    def test_pocket_commit_callback_records_save_and_unsave_does_not_erase_event(self):
        user, business = self.explorers[0], self.businesses[0]
        with timeout(15), patch.object(VisibilityEventService, "_get_current_time", return_value=self.START), self.captureOnCommitCallbacks(execute=True):
            PocketService.create_pocket(user, business.pk)
        self.assertEqual(self.live(lambda: VisibilityEventService.get_analytics_totals(**self.query))["SAVE"], 1)
        with self.assertRaises(ValidationError):
            PocketService.create_pocket(user, business.pk)
        PocketService.remove_pocket(user, business.pk)
        self.assertFalse(PocketService.has_pocketed(user, business.pk))
        self.assertEqual(self.live(lambda: VisibilityEventService.get_analytics_totals(**self.query))["SAVE"], 1)
        with timeout(15), patch.object(VisibilityEventService, "_get_current_time", return_value=self.START), self.captureOnCommitCallbacks(execute=True):
            PocketService.create_pocket(user, business.pk)
        self.assertEqual(self.live(lambda: VisibilityEventService.get_analytics_totals(**self.query))["SAVE"], 1)

    def test_empty_reads_do_not_create_collection_and_injected_failure_is_not_a_live_outage(self):
        self.assertEqual(self.live(lambda: VisibilityEventService.get_analytics_totals(**self.query)),
                         {"IMPRESSION": 0, "PROFILE_VISIT": 0, "SAVE": 0})
        self.assertEqual(self.live(lambda: VisibilityEventService.get_analytics_series(**self.query)), [])
        self.assertEqual(self.live(lambda: self.client[self.temp_database].list_collection_names()), [])
        with patch.object(VisibilityEventService, "_get_collection", side_effect=AutoReconnect("Controlled injected outage")):
            with self.captureOnCommitCallbacks(execute=True):
                PocketService.create_pocket(self.explorers[0], self.businesses[0].pk)
            self.assertTrue(PocketService.has_pocketed(self.explorers[0], self.businesses[0].pk))
            with self.assertRaises(VisibilityTrackingUnavailable):
                VisibilityEventService.get_analytics_totals(**self.query)
