from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import SimpleTestCase, override_settings
from pymongo.errors import AutoReconnect
from rest_framework import status
from rest_framework.test import APITestCase, APIRequestFactory, force_authenticate

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityEventType,
    VisibilityTrackingUnavailable,
)
from apps.shared.services.mongodb_service import MongoDBService
from apps.users.models import User
from apps.business.services.tests.test_visibility_event_service import FakeVisibilityCollection
from apps.explorer_operations.explore_businesses.views.visibility_event_views import (
    BusinessImpressionBatchView,
    BusinessProfileVisitView,
)


@override_settings(
    MONGODB_VISIBILITY_FAILURE_COOLDOWN_SECONDS=30,
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        },
    },
)
class VisibilityRetryMetadataTests(SimpleTestCase):
    """Exercise real persistence failures and API envelopes without database access."""

    def setUp(self):
        self.clock = 100.0
        self.collection = FakeVisibilityCollection()
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(
            pk=1,
            USER_ID=1,
            USER_ROLE=User.UserRole.EXPLORER,
            is_authenticated=True,
            is_active=True,
        )
        patches = [
            patch.object(
                VisibilityEventService,
                "_unavailable_until",
                0.0,
            ),
            patch.object(
                VisibilityEventService,
                "_indexes_initialized",
                True,
            ),
            patch.object(
                VisibilityEventService,
                "_get_monotonic_time",
                side_effect=lambda: self.clock,
            ),
            patch.object(
                VisibilityEventService,
                "_validate_active_business_ids",
                return_value=[42],
            ),
            patch.object(
                VisibilityEventService,
                "_validate_active_business",
                return_value=SimpleNamespace(
                    BUSN_ID=42,
                    USER_ID_id=99,
                ),
            ),
        ]
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)
        collection_patch = patch.object(
            VisibilityEventService,
            "_get_collection",
            return_value=self.collection,
        )
        self.get_collection = collection_patch.start()
        self.addCleanup(collection_patch.stop)

    def request_event(
        self,
        profile_visit=False,
        payload=None,
    ):
        """Send an authenticated request through the maintained visibility API view."""
        if payload is None:
            payload = {"business_ids": [42]}
        request = self.factory.post(
            "/visibility/",
            payload,
            format="json",
        )
        force_authenticate(
            request,
            user=self.user,
        )
        if profile_visit:
            return BusinessProfileVisitView.as_view()(
                request,
                business_id=42,
            )
        return BusinessImpressionBatchView.as_view()(request)

    def test_persistence_failure_returns_retry_after_for_both_endpoints(self):
        for profile_visit in (False, True):
            with self.subTest(profile_visit=profile_visit):
                VisibilityEventService._unavailable_until = 0.0
                self.collection.bulk_write_error = AutoReconnect("Unavailable")
                response = self.request_event(profile_visit=profile_visit)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                )
                self.assertEqual(
                    response.data["code"],
                    "VISIBILITY_TRACKING_UNAVAILABLE",
                )
                self.assertEqual(
                    response.data["retry_after"],
                    30,
                )
                self.assertEqual(
                    response["Retry-After"],
                    "30",
                )
                self.assertFalse(response.data["success"])
                self.assertEqual(
                    response.data["message"],
                    "Visibility tracking is temporarily unavailable.",
                )

    def test_cooldown_reports_remaining_delay_and_recovers_without_duplicates(self):
        self.collection.bulk_write_error = AutoReconnect("Unavailable")
        self.request_event()
        self.clock = 107.25
        response = self.request_event()
        self.assertEqual(
            response.data["retry_after"],
            23,
        )
        self.assertEqual(
            response["Retry-After"],
            "23",
        )
        self.assertEqual(
            self.get_collection.call_count,
            1,
        )

        self.clock = 130.0
        self.collection.bulk_write_error = None
        recovered = self.request_event()
        repeated = self.request_event()
        self.assertEqual(
            recovered.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            recovered.data["data"]["recorded_count"],
            1,
        )
        self.assertEqual(
            repeated.data["data"]["duplicate_count"],
            1,
        )
        self.assertEqual(
            len(self.collection.documents),
            1,
        )
        self.assertNotIn(
            "retry_after",
            recovered.data,
        )
        self.assertNotIn(
            "Retry-After",
            recovered,
        )

    def test_invalid_payload_has_no_retry_metadata_or_persistence_attempt(self):
        response = self.request_event(payload={})
        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )
        self.assertNotIn(
            "retry_after",
            response.data,
        )
        self.assertNotIn(
            "Retry-After",
            response,
        )
        self.get_collection.assert_not_called()


class VisibilityEventViewTests(APITestCase):
    def setUp(self):
        self.explorer = User.objects.create_user(
            email="visibility-view-explorer@example.com",
            password=None,
            USER_FNAME="Visibility",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.other_explorer = User.objects.create_user(
            email="visibility-view-other@example.com",
            password=None,
            USER_FNAME="Other",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.owner = User.objects.create_user(
            email="visibility-view-owner@example.com",
            password=None,
            USER_FNAME="Visibility",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Visibility View Cluster",
            CLUS_DESCRIPTION="Visibility endpoint tests.",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Visibility View Category",
            CTGRY_DESCRIPTION="Visibility endpoint tests.",
            CLUS_ID=self.cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Visibility View Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Visibility View Business",
            BUSN_DESCRIPTION="Visibility endpoint test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        self.impression_url = (
            "/api/explorer/explore/visibility/impressions/"
        )
        self.profile_visit_url = (
            f"/api/explorer/explore/businesses/"
            f"{self.business.BUSN_ID}/profile-visit/"
        )
        self.client.force_authenticate(
            self.explorer,
        )

    def test_impression_endpoint_uses_authenticated_identity(self):
        result = SimpleNamespace(
            event_type=VisibilityEventType.IMPRESSION,
            eligible_business_ids=(
                self.business.BUSN_ID,
            ),
            recorded_count=1,
            duplicate_count=0,
        )

        with patch.object(
            VisibilityEventService,
            "record_impressions",
            return_value=result,
        ) as record_impressions:
            response = self.client.post(
                self.impression_url,
                {
                    "business_ids": [
                        self.business.BUSN_ID,
                    ],
                    "explorer_id": self.other_explorer.USER_ID,
                    "occurred_at": "2000-01-01T00:00:00Z",
                },
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        record_impressions.assert_called_once_with(
            explorer_id=self.explorer.USER_ID,
            business_ids=[
                self.business.BUSN_ID,
            ],
        )
        self.assertEqual(
            response.data["data"]["recorded_count"],
            1,
        )

    def test_impression_endpoint_validates_request_structure(self):
        payloads = [
            {},
            [],
            {"business_ids": "not-a-list"},
            {"business_ids": []},
            {"business_ids": None},
            {"business_ids": [self.business.pk, "invalid"]},
            {"business_ids": [self.business.pk, 0]},
            {"business_ids": [self.business.pk, 1.5]},
        ]
        with patch.object(
            VisibilityEventService,
            "record_impressions",
        ) as record_impressions:
            for payload in payloads:
                with self.subTest(payload=payload):
                    response = self.client.post(
                        self.impression_url,
                        payload,
                        format="json",
                    )
                    self.assertEqual(
                        response.status_code,
                        status.HTTP_400_BAD_REQUEST,
                    )
                    self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                    self.assertNotIn("retry_after", response.data)

        record_impressions.assert_not_called()

    def test_mixed_impression_batch_filters_ineligible_targets_and_deduplicates(self):
        inactive_business = Business.objects.create(
            BUSN_NAME="Inactive batch target",
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
            USER_ID=self.other_explorer,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        owned_business = Business.objects.create(
            BUSN_NAME="Owned batch target",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.explorer,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        payload = {
            "business_ids": [
                self.business.pk,
                inactive_business.pk,
                owned_business.pk,
                999999,
                self.business.pk,
            ],
        }
        collection = FakeVisibilityCollection()
        with (
            patch.object(VisibilityEventService, "_indexes_initialized", False),
            patch.object(VisibilityEventService, "_unavailable_until", 0.0),
            patch.object(
                VisibilityEventService,
                "_get_collection",
                return_value=collection,
            ),
        ):
            first = self.client.post(
                self.impression_url,
                payload,
                format="json",
            )
            repeated = self.client.post(
                self.impression_url,
                payload,
                format="json",
            )

        for response in (first, repeated):
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data["success"])
            self.assertNotIn("retry_after", response.data)
        self.assertEqual(
            first.data["data"],
            {
                "business_ids": [self.business.pk],
                "recorded_count": 1,
                "duplicate_count": 0,
            },
        )
        self.assertEqual(
            repeated.data["data"],
            {
                "business_ids": [self.business.pk],
                "recorded_count": 0,
                "duplicate_count": 1,
            },
        )
        self.assertEqual(len(collection.documents), 1)
        document = next(iter(collection.documents.values()))
        self.assertEqual(document["business_id"], self.business.pk)
        self.assertEqual(document["explorer_id"], self.explorer.pk)

    def test_all_ineligible_impression_targets_succeed_during_mongo_cooldown(self):
        inactive_business = Business.objects.create(
            BUSN_NAME="Inactive batch target",
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
            USER_ID=self.other_explorer,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        self.client.force_authenticate(self.owner)
        with (
            patch.object(VisibilityEventService, "_unavailable_until", 200.0),
            patch.object(
                VisibilityEventService,
                "_get_monotonic_time",
                return_value=100.0,
            ),
            patch.object(VisibilityEventService, "_get_collection") as collection,
        ):
            response = self.client.post(
                self.impression_url,
                {
                    "business_ids": [
                        self.business.pk,
                        inactive_business.pk,
                        999999,
                    ],
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["data"],
            {
                "business_ids": [],
                "recorded_count": 0,
                "duplicate_count": 0,
            },
        )
        self.assertNotIn("retry_after", response.data)
        collection.assert_not_called()

    @override_settings(MONGODB_VISIBILITY_FAILURE_COOLDOWN_SECONDS=30)
    def test_partial_batch_mongo_failure_retains_retry_timing_and_recovery(self):
        collection = FakeVisibilityCollection()
        collection.bulk_write_error = AutoReconnect("Unavailable")
        payload = {"business_ids": [self.business.pk, 999999]}
        with (
            patch.object(VisibilityEventService, "_indexes_initialized", True),
            patch.object(VisibilityEventService, "_unavailable_until", 0.0),
            patch.object(
                VisibilityEventService,
                "_get_monotonic_time",
                return_value=100.0,
            ) as clock,
            patch.object(
                VisibilityEventService,
                "_get_collection",
                return_value=collection,
            ) as get_collection,
        ):
            failed = self.client.post(
                self.impression_url,
                payload,
                format="json",
            )
            cooldown = self.client.post(
                self.impression_url,
                payload,
                format="json",
            )
            self.assertEqual(get_collection.call_count, 1)
            collection.bulk_write_error = None
            clock.return_value = 130.0
            recovered = self.client.post(
                self.impression_url,
                payload,
                format="json",
            )

        for response in (failed, cooldown):
            self.assertEqual(
                response.status_code,
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
            self.assertEqual(
                response.data["code"],
                "VISIBILITY_TRACKING_UNAVAILABLE",
            )
            self.assertEqual(response.data["retry_after"], 30)
            self.assertEqual(response["Retry-After"], "30")
        self.assertEqual(recovered.status_code, status.HTTP_200_OK)
        self.assertEqual(recovered.data["data"]["recorded_count"], 1)
        self.assertEqual(recovered.data["data"]["business_ids"], [self.business.pk])
        self.assertEqual(len(collection.documents), 1)

    def test_profile_visit_endpoint_uses_permission_and_response_conventions(self):
        result = SimpleNamespace(
            event_type=VisibilityEventType.PROFILE_VISIT,
            eligible_business_ids=(
                self.business.BUSN_ID,
            ),
            recorded_count=1,
            duplicate_count=0,
        )

        with patch.object(
            VisibilityEventService,
            "record_profile_visit",
            return_value=result,
        ) as record_profile_visit:
            response = self.client.post(
                self.profile_visit_url,
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(
            response.data["success"],
        )
        self.assertEqual(
            response.data["message"],
            "Business profile visit recorded successfully.",
        )
        record_profile_visit.assert_called_once_with(
            explorer_id=self.explorer.USER_ID,
            business_id=self.business.BUSN_ID,
            discovery_source="UNKNOWN",
        )

    def test_duplicate_profile_visit_is_still_successful(self):
        result = SimpleNamespace(
            event_type=VisibilityEventType.PROFILE_VISIT,
            eligible_business_ids=(
                self.business.BUSN_ID,
            ),
            recorded_count=0,
            duplicate_count=1,
        )

        with patch.object(
            VisibilityEventService,
            "record_profile_visit",
            return_value=result,
        ):
            response = self.client.post(
                self.profile_visit_url,
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertFalse(
            response.data["data"]["recorded"],
        )
        self.assertTrue(
            response.data["data"]["duplicate"],
        )

    def test_tracking_endpoint_reports_controlled_mongo_failure(self):
        with patch.object(
            VisibilityEventService,
            "record_impressions",
            side_effect=VisibilityTrackingUnavailable(),
        ):
            response = self.client.post(
                self.impression_url,
                {
                    "business_ids": [
                        self.business.BUSN_ID,
                    ],
                },
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        self.assertEqual(
            response.data["code"],
            "VISIBILITY_TRACKING_UNAVAILABLE",
        )

    def test_tracking_endpoint_fails_fast_during_mongo_cooldown(self):
        with (
            patch.object(
                VisibilityEventService,
                "_unavailable_until",
                200.0,
            ),
            patch.object(
                VisibilityEventService,
                "_get_monotonic_time",
                return_value=100.0,
            ),
            patch.object(
                MongoDBService,
                "get_database",
            ) as get_database,
        ):
            response = self.client.post(
                self.impression_url,
                {
                    "business_ids": [
                        self.business.BUSN_ID,
                    ],
                },
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        self.assertEqual(
            response.data["code"],
            "VISIBILITY_TRACKING_UNAVAILABLE",
        )
        get_database.assert_not_called()

    def test_owner_requests_are_successful_ignored_observations_without_mongo(self):
        self.client.force_authenticate(self.owner)
        with patch.object(MongoDBService, "get_database") as database:
            impressions = self.client.post(
                self.impression_url,
                {"business_ids": [self.business.pk]},
                format="json",
            )
            profile = self.client.post(
                self.profile_visit_url,
                {},
                format="json",
            )

        self.assertEqual(impressions.status_code, status.HTTP_200_OK)
        self.assertEqual(
            impressions.data["data"],
            {"business_ids": [], "recorded_count": 0, "duplicate_count": 0},
        )
        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(
            profile.data["data"],
            {"business_id": self.business.pk, "recorded": False, "duplicate": False},
        )
        database.assert_not_called()

    def test_tracking_rejects_disallowed_roles_and_inactive_accounts_before_ingestion(self):
        cases = [
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.SUSPENDED),
        ]
        for role, account_status in cases:
            self.explorer.USER_ROLE = role
            self.explorer.USER_STATUS = account_status
            self.client.force_authenticate(self.explorer)
            with self.subTest(role=role, status=account_status):
                with patch.object(MongoDBService, "get_database") as database:
                    impressions = self.client.post(
                        self.impression_url,
                        {"business_ids": [self.business.pk]},
                        format="json",
                    )
                    profile = self.client.post(
                        self.profile_visit_url,
                        {},
                        format="json",
                    )

                self.assertEqual(impressions.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(profile.status_code, status.HTTP_403_FORBIDDEN)
                database.assert_not_called()

    def test_tracking_endpoints_require_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        impression_response = self.client.post(
            self.impression_url,
            {
                "business_ids": [
                    self.business.BUSN_ID,
                ],
            },
            format="json",
        )
        profile_response = self.client.post(
            self.profile_visit_url,
            format="json",
        )

        self.assertEqual(
            impression_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            profile_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
