"""Explicit opt-in driver verification against a temporary database on local MongoDB."""

import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
from unittest import skipUnless
from unittest.mock import patch
from urllib.parse import urlsplit
from uuid import uuid4

from django.test import SimpleTestCase
from django.utils import timezone
from pymongo import MongoClient

from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.shared.analytics.date_ranges import resolve_period


@skipUnless(
    os.environ.get("SUGBOGO_LIVE_ROUTE_INTENT_VERIFY") == "1"
    and bool(os.environ.get("SUGBOGO_ROUTE_INTENT_TEST_MONGO_URI")),
    "Local MongoDB route-intent verification requires explicit opt-in and a test URI.",
)
class LiveRoutePlanningMongoTests(SimpleTestCase):
    def test_unique_concurrent_upserts_and_real_aggregation(self):
        uri = os.environ["SUGBOGO_ROUTE_INTENT_TEST_MONGO_URI"]
        parsed = urlsplit(uri)
        self.assertEqual(parsed.scheme, "mongodb")
        self.assertIn(parsed.hostname, {"localhost", "127.0.0.1", "::1"})
        self.assertNotIn(",", parsed.netloc)
        database_name = f"sg_ri_{uuid4().hex}"
        self.assertRegex(database_name, r"^sg_ri_[a-f0-9]{32}$")
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
            directConnection=True,
        )
        try:
            collection = client[database_name][RoutePlanningEventService.COLLECTION_NAME]
            business = SimpleNamespace(pk=10, USER_ID_id=20)
            user = SimpleNamespace(pk=30)
            now = timezone.now()
            with (
                patch.object(RoutePlanningEventService, "_get_collection", return_value=collection),
                patch.object(RoutePlanningEventService, "_get_business", return_value=business),
                patch.object(RoutePlanningEventService, "_indexes_initialized", False),
                patch("django.utils.timezone.now", return_value=now),
            ):
                initialized = RoutePlanningEventService.initialize_tracking()
                self.assertTrue(initialized["initialized"])
                repeated = RoutePlanningEventService.initialize_tracking()
                self.assertFalse(repeated["initialized"])
                self.assertEqual(
                    repeated["started_at"],
                    initialized["started_at"],
                )
                self.assertEqual(
                    collection.count_documents({
                        "navigation_method": {"$exists": True},
                    }),
                    0,
                )
                empty, started, reason = RoutePlanningEventService.get_totals(
                    business_id=business.pk,
                    owner_id=business.USER_ID_id,
                    period=resolve_period(now=now + timedelta(seconds=1)),
                )
                self.assertEqual(empty["total_requests"], 0)
                self.assertIsNone(reason)

                def record(value):
                    return RoutePlanningEventService.record_intent(
                        user=user,
                        business_id=business.pk,
                        navigation_method="ROAD_ROUTE",
                    )

                with ThreadPoolExecutor(max_workers=8) as executor:
                    results = list(executor.map(record, range(16)))
                self.assertEqual(sum(result["recorded"] for result in results), 1)
                self.assertEqual(sum(result["duplicate"] for result in results), 15)
                for actor in (user, SimpleNamespace(pk=31)):
                    RoutePlanningEventService.record_intent(
                        user=actor,
                        business_id=business.pk,
                        navigation_method="JEEPNEY",
                    )
                totals, started, reason = RoutePlanningEventService.get_totals(
                    business_id=business.pk,
                    owner_id=business.USER_ID_id,
                    period=resolve_period(now=now + timedelta(seconds=1)),
                )
                self.assertEqual(totals, {
                    "total_requests": 3,
                    "distinct_explorer_accounts": 2,
                    "road_route_requests": 1,
                    "jeepney_requests": 2,
                })
                self.assertIsNone(reason)
                self.assertIsNotNone(started)
                unique = collection.index_information()[RoutePlanningEventService.DEDUPE_INDEX_NAME]
                self.assertTrue(unique["unique"])
        finally:
            # Only this test's freshly generated local database may be removed.
            if re.fullmatch(r"sg_ri_[a-f0-9]{32}", database_name):
                client.drop_database(database_name)
            client.close()
