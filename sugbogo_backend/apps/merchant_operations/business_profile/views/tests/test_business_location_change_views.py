from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.db import IntegrityError, close_old_connections, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.business.models import (
    Business,
    BusinessLandmark,
    Category,
    Cluster,
    Location,
    ServiceableBoundary,
)
from apps.merchant_application.models import MerchantApplication
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessLocationLandmarkSnapshot,
    BusinessNameChangeRequest,
)
from apps.merchant_operations.business_profile.services.business_location_change_service import (
    BusinessLocationChangeService,
)
from apps.users.models import User


class BusinessLocationChangeViewTests(TestCase):
    """Exercise owner and Admin location request contracts and atomic decisions."""

    @classmethod
    def setUpTestData(cls):
        """Create service area, two merchants, and an approved live business."""
        cls.merchant = cls._user("location-owner@example.com", User.UserRole.MERCHANT)
        cls.other_merchant = cls._user(
            "location-other@example.com",
            User.UserRole.MERCHANT,
        )
        cls.admin = cls._user("location-admin@example.com", User.UserRole.ADMIN)
        cls.super_admin = cls._user(
            "location-super@example.com",
            User.UserRole.SUPER_ADMIN,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=cluster,
        )
        cls.boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Cebu test area",
            SBND_BOUNDARY=cls._polygon(123.87, 10.30, 123.92, 10.34),
            SBND_IS_ACTIVE=True,
        )
        cls.old_location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue, Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
            LOCT_POSTAL_CODE="6000",
        )
        cls.business = cls._business(cls.merchant, cls.old_location)
        cls.old_landmark = BusinessLandmark.objects.create(
            LOCT_ID=cls.old_location,
            BLMK_NAME="Old landmark",
            BLMK_ADDRESS="Old address",
            BLMK_POINT=Point(123.886, 10.316, srid=4326),
            BLMK_SOURCE=BusinessLandmark.LandmarkSource.GOOGLE,
            BLMK_PLACE_ID="old-place",
        )
        cls.application = MerchantApplication.objects.create(
            USER_ID=cls.merchant,
            BUSN_ID=cls.business,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        other_location = Location.objects.create(
            LOCT_POINT=Point(123.89, 10.32, srid=4326),
            LOCT_ADDRESS="Other address",
        )
        cls.other_business = cls._business(cls.other_merchant, other_location)

    @staticmethod
    def _user(
        email,
        role,
    ):
        """Create a user for role-bound API tests."""
        return User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Test",
            USER_LNAME="User",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    @staticmethod
    def _polygon(
        west,
        south,
        east,
        north,
    ):
        """Build a rectangular serviceable multipolygon."""
        return MultiPolygon(
            Polygon(
                (
                    (west, south),
                    (east, south),
                    (east, north),
                    (west, north),
                    (west, south),
                ),
                srid=4326,
            ),
        )

    @classmethod
    def _business(
        cls,
        owner,
        location,
    ):
        """Create an active merchant-owned business."""
        return Business.objects.create(
            BUSN_NAME="Test business",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=cls.category,
            LOCT_ID=location,
        )

    def setUp(self):
        """Authenticate as the owner for each independent test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.merchant)
        self.merchant_url = "/api/merchant/business-profile/update-requests/location/"
        self.admin_url = "/api/admin/businesses/update-requests/location/"

    def _payload(

        self,

        landmarks=None,

    ):
        """Build a complete flat-address proposal."""
        if landmarks is None:
            landmarks = [{
                "name": "New landmark",
                "address": "New landmark address",
                "latitude": 10.322,
                "longitude": 123.892,
                "source": "google",
                "place_id": "new-place",
            }]
        return {
            "proposed_location": {
                "latitude": 10.321,
                "longitude": 123.891,
                "address": "New flat address",
                "city": "Cebu City",
                "province": "Cebu",
                "postal_code": "6000",
            },
            "proposed_landmarks": landmarks,
        }

    def _submit(

        self,

        payload=None,

    ):
        """Submit one complete proposal as the merchant."""
        return self.client.post(
            self.merchant_url,
            payload if payload is not None else self._payload(),
            format="json",
        )

    def _approve(

        self,

        request_id,

    ):
        """Approve as an Admin through the public API."""
        self.client.force_authenticate(user=self.admin)
        return self.client.post(f"{self.admin_url}{request_id}/approve/")

    def _assert_live_old(self):
        """Assert a pending or failed decision has not touched live data."""
        self.business.refresh_from_db()
        self.old_location.refresh_from_db()
        self.assertEqual(self.business.LOCT_ID_id, self.old_location.LOCT_ID)
        self.assertEqual(self.old_location.LOCT_POINT.x, 123.8854)
        self.assertEqual(self.old_location.LOCT_ADDRESS, "Gorordo Avenue, Cebu City")
        self.assertTrue(BusinessLandmark.objects.filter(pk=self.old_landmark.pk).exists())

    def test_decision_notifications_reach_only_request_submitter(self):
        from apps.notifications.models import Notification

        for outcome in ("rejected", "approved"):
            response = self._submit()
            self.assertEqual(response.status_code, 201, response.data)
            request = BusinessLocationChangeRequest.objects.order_by("-pk").first()
            self.assertEqual(Notification.objects.count(), int(outcome == "approved"))
            if outcome == "approved":
                BusinessLocationChangeService.approve(request.pk, self.admin)
            else:
                BusinessLocationChangeService.reject(request.pk, self.admin, "Private rejection reason.")
            notification = Notification.objects.get(
                NOTF_DEDUP_KEY=f"business_location_change:{request.pk}:resolved",
            )
            self.assertEqual(notification.USER_ID_id, self.merchant.pk)
            self.assertEqual(notification.NOTF_TYPE, f"business_location_change_{outcome}")
            self.assertEqual(notification.NOTF_TARGET_ID, request.pk)
            self.assertEqual(notification.NOTF_TARGET_TYPE, "business_location_change")
            self.assertNotIn("Private rejection reason", notification.NOTF_BODY)
        self.assertEqual(Notification.objects.count(), 2)

    def test_notification_failure_rolls_back_both_request_decisions(self):
        from apps.notifications.models import Notification

        response = self._submit()
        self.assertEqual(response.status_code, 201, response.data)
        request = BusinessLocationChangeRequest.objects.get()
        previous_business = dict(type(self.business).objects.values().get(pk=self.business.pk))
        for outcome in ("approved", "rejected"):
            with self.subTest(outcome=outcome):
                with patch(
                    "apps.notifications.services.notification_event_service.NotificationService.create",
                    side_effect=RuntimeError("Inbox storage unavailable"),
                ):
                    with self.assertRaises(RuntimeError):
                        if outcome == "approved":
                            BusinessLocationChangeService.approve(request.pk, self.admin)
                        else:
                            BusinessLocationChangeService.reject(request.pk, self.admin, "Private rejection reason.")
                request.refresh_from_db()
                self.assertEqual(request.BLCR_STATUS, "pending")
                self.assertIsNone(request.REVIEWER_ID_id)
                self.assertEqual(
                    dict(type(self.business).objects.values().get(pk=self.business.pk)),
                    previous_business,
                )
                self._assert_live_old()
                self.assertFalse(Notification.objects.exists())

    def test_submit_snapshots_both_sides_and_leaves_live_and_application(self):
        """Submission freezes coordinates, flat address, and landmark values."""
        response = self._submit()
        self.assertEqual(response.status_code, 201)
        data = response.data["data"]
        self.assertEqual(data["request_type"], "location")
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["previous"]["location"]["id"], self.old_location.pk)
        self.assertEqual(data["previous"]["landmarks"][0]["id"], self.old_landmark.pk)
        self.assertEqual(data["proposed"]["location"]["longitude"], 123.891)
        self.assertEqual(data["proposed"]["landmarks"][0]["place_id"], "new-place")
        self.assertEqual(BusinessLocationLandmarkSnapshot.objects.count(), 2)
        self._assert_live_old()
        self.assertEqual(BusinessLandmark.objects.filter(LOCT_ID=self.old_location).count(), 1)
        self.application.refresh_from_db()
        self.assertEqual(self.application.BUSN_ID_id, self.business.pk)

    def test_zero_and_five_landmarks_are_allowed(self):
        """The complete desired set may contain zero through five landmarks."""
        response = self._submit(self._payload(landmarks=[]))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["proposed"]["landmarks"], [])
        request_id = response.data["data"]["id"]
        self.client.post(f"{self.merchant_url}{request_id}/withdraw/")
        landmarks = [
            {
                "name": f"Custom {index}",
                "latitude": 10.322,
                "longitude": 123.892,
                "source": "custom",
            }
            for index in range(5)
        ]
        response = self._submit(self._payload(landmarks=landmarks))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["data"]["proposed"]["landmarks"]), 5)

    def test_six_landmarks_and_invalid_source_are_rejected(self):
        """Keep the Registration landmark count and source choices."""
        landmarks = [
            {
                "name": f"Custom {index}",
                "latitude": 10.322,
                "longitude": 123.892,
                "source": "custom",
            }
            for index in range(6)
        ]
        self.assertEqual(
            self._submit(self._payload(landmarks=landmarks)).status_code,
            400,
        )
        payload = self._payload()
        payload["proposed_landmarks"][0]["source"] = "unknown"
        self.assertEqual(self._submit(payload).status_code, 400)

    def test_landmark_order_does_not_create_a_change(self):
        """Compare landmark collections as unordered persisted values."""
        BusinessLandmark.objects.create(
            LOCT_ID=self.old_location,
            BLMK_NAME="Second landmark",
            BLMK_ADDRESS="Second address",
            BLMK_POINT=Point(123.887, 10.317, srid=4326),
            BLMK_SOURCE="custom",
        )
        payload = self._payload(landmarks=[
            {
                "name": "Second landmark",
                "address": "Second address",
                "latitude": 10.317,
                "longitude": 123.887,
                "source": "custom",
            },
            {
                "name": "Old landmark",
                "address": "Old address",
                "latitude": 10.316,
                "longitude": 123.886,
                "source": "google",
                "place_id": "old-place",
            },
        ])
        payload["proposed_location"] = {
            "latitude": 10.3157,
            "longitude": 123.8854,
            "address": "Gorordo Avenue, Cebu City",
            "city": "Cebu City",
            "province": "Cebu",
            "postal_code": "6000",
        }
        self.assertEqual(self._submit(payload).status_code, 400)

    def test_invalid_and_unchanged_proposals_are_rejected(self):
        """Reject invalid coordinates, service area, and unchanged state."""
        payload = self._payload()
        payload["proposed_location"]["latitude"] = 91
        self.assertEqual(self._submit(payload).status_code, 400)
        payload = self._payload()
        payload["proposed_location"]["latitude"] = 10.5
        self.assertEqual(self._submit(payload).status_code, 400)
        payload = self._payload()
        payload["proposed_landmarks"][0]["latitude"] = 10.5
        self.assertEqual(self._submit(payload).status_code, 400)
        payload = self._payload()
        payload["proposed_landmarks"][0]["longitude"] = 181
        self.assertEqual(self._submit(payload).status_code, 400)
        payload = self._payload()
        payload["proposed_landmarks"][0]["address"] = ""
        self.assertEqual(self._submit(payload).status_code, 400)
        payload = self._payload()
        payload["proposed_location"] = {
            "latitude": 10.3157,
            "longitude": 123.8854,
            "address": "Gorordo Avenue, Cebu City",
            "city": "Cebu City",
            "province": "Cebu",
            "postal_code": "6000",
        }
        payload["proposed_landmarks"] = [{
            "name": "Old landmark",
            "address": "Old address",
            "latitude": 10.316,
            "longitude": 123.886,
            "source": "google",
            "place_id": "old-place",
        }]
        self.assertEqual(self._submit(payload).status_code, 400)
        self.assertEqual(BusinessLocationChangeRequest.objects.count(), 0)

    def test_suspended_missing_business_and_duplicate_pending(self):
        """Require an active owner and one pending request per business."""
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])
        self.assertEqual(self._submit().status_code, 403)
        self.business.BUSN_STATUS = Business.BusinessStatus.ACTIVE
        self.business.save(update_fields=["BUSN_STATUS"])
        missing_owner = self._user("missing-location@example.com", User.UserRole.MERCHANT)
        self.client.force_authenticate(user=missing_owner)
        self.assertEqual(self._submit().status_code, 404)
        self.client.force_authenticate(user=self.merchant)
        self.assertEqual(self._submit().status_code, 201)
        self.assertEqual(self._submit().status_code, 400)
        request = BusinessLocationChangeRequest.objects.get()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BusinessLocationChangeRequest.objects.create(
                    BUSN_ID=self.business,
                    USER_ID=self.merchant,
                    BLCR_PREVIOUS_LOCT_ID=self.old_location.pk,
                    BLCR_PREVIOUS_POINT=self.old_location.LOCT_POINT,
                    BLCR_PREVIOUS_ADDRESS=self.old_location.LOCT_ADDRESS,
                    BLCR_PREVIOUS_CITY=self.old_location.LOCT_CITY,
                    BLCR_PREVIOUS_PROVINCE=self.old_location.LOCT_PROVINCE,
                    BLCR_PROPOSED_POINT=request.BLCR_PROPOSED_POINT,
                    BLCR_PROPOSED_ADDRESS=request.BLCR_PROPOSED_ADDRESS,
                    BLCR_PROPOSED_CITY=request.BLCR_PROPOSED_CITY,
                    BLCR_PROPOSED_PROVINCE=request.BLCR_PROPOSED_PROVINCE,
                    BLCR_SUBMITTED_AT=timezone.now(),
                )

    def test_name_and_classification_requests_can_coexist(self):
        """Pending location requests have an independent uniqueness domain."""
        BusinessNameChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            BNCR_PREVIOUS_BUSINESS_NAME=self.business.BUSN_NAME,
            BNCR_PROPOSED_BUSINESS_NAME="Another name",
            BNCR_SUBMITTED_AT=timezone.now(),
        )
        BusinessClassificationChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            PREVIOUS_CTGRY_ID=self.category,
            PROPOSED_CTGRY_ID=self.category,
            BCCR_PREVIOUS_CATEGORY_NAME=self.category.CTGRY_NAME,
            BCCR_PREVIOUS_CLUSTER_ID=self.category.CLUS_ID_id,
            BCCR_PREVIOUS_CLUSTER_NAME=self.category.CLUS_ID.CLUS_NAME,
            BCCR_PROPOSED_CATEGORY_NAME=self.category.CTGRY_NAME,
            BCCR_PROPOSED_CLUSTER_ID=self.category.CLUS_ID_id,
            BCCR_PROPOSED_CLUSTER_NAME=self.category.CLUS_ID.CLUS_NAME,
            BCCR_SUBMITTED_AT=timezone.now(),
        )
        self.assertEqual(self._submit().status_code, 201)

    def test_history_detail_foreign_access_and_withdraw(self):
        """Keep terminal history and hide foreign detail and withdrawal."""
        first_id = self._submit().data["data"]["id"]
        response = self.client.post(f"{self.merchant_url}{first_id}/withdraw/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["status"], "withdrawn")
        self.assertEqual(
            self.client.post(f"{self.merchant_url}{first_id}/withdraw/").status_code,
            400,
        )
        second_id = self._submit().data["data"]["id"]
        listed = self.client.get(self.merchant_url)
        self.assertEqual(
            [item["id"] for item in listed.data["data"]["items"]],
            [second_id, first_id],
        )
        self.assertEqual(
            self.client.get(f"{self.merchant_url}{first_id}/").status_code,
            200,
        )
        self.client.force_authenticate(user=self.other_merchant)
        self.assertEqual(self.client.get(self.merchant_url).data["data"]["items"], [])
        self.assertEqual(
            self.client.get(f"{self.merchant_url}{first_id}/").status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f"{self.merchant_url}{second_id}/withdraw/").status_code,
            404,
        )
        self._assert_live_old()

    def test_admin_approval_repoints_and_cleans_unreferenced_location(self):
        """Approval creates a new location and preserves application evidence."""
        request_id = self._submit().data["data"]["id"]
        response = self._approve(request_id)
        self.assertEqual(response.status_code, 200)
        self.business.refresh_from_db()
        self.assertNotEqual(self.business.LOCT_ID_id, self.old_location.pk)
        self.assertEqual(self.business.LOCT_ID.LOCT_POINT.x, 123.891)
        self.assertEqual(self.business.LOCT_ID.LOCT_ADDRESS, "New flat address")
        landmarks = list(BusinessLandmark.objects.filter(LOCT_ID=self.business.LOCT_ID))
        self.assertEqual(len(landmarks), 1)
        self.assertEqual(landmarks[0].BLMK_PLACE_ID, "new-place")
        self.assertFalse(Location.objects.filter(pk=self.old_location.pk).exists())
        request = BusinessLocationChangeRequest.objects.get(pk=request_id)
        self.assertEqual(request.BLCR_STATUS, "approved")
        self.assertEqual(request.REVIEWER_ID, self.admin)
        self.assertIsNotNone(request.BLCR_RESOLVED_AT)
        self.application.refresh_from_db()
        self.assertEqual(self.application.BUSN_ID_id, self.business.pk)
        self.assertEqual(self._approve(request_id).status_code, 400)

    def test_shared_old_location_is_retained_and_zero_landmarks_applied(self):
        """Approval never mutates or deletes a location used by another business."""
        self.other_business.LOCT_ID = self.old_location
        self.other_business.save(update_fields=["LOCT_ID"])
        request_id = self._submit(self._payload(landmarks=[])).data["data"]["id"]
        self.assertEqual(self._approve(request_id).status_code, 200)
        self.other_business.refresh_from_db()
        self.business.refresh_from_db()
        self.assertEqual(self.other_business.LOCT_ID_id, self.old_location.pk)
        self.assertTrue(Location.objects.filter(pk=self.old_location.pk).exists())
        self.assertEqual(BusinessLandmark.objects.filter(LOCT_ID=self.old_location).count(), 1)
        self.assertEqual(BusinessLandmark.objects.filter(LOCT_ID=self.business.LOCT_ID).count(), 0)

    def test_stale_baselines_block_approval_without_orphans(self):
        """Detect location identity, point, address, and landmark changes."""
        mutations = (
            "location_id",
            "point",
            "address",
            "landmarks",
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                request_id = self._submit().data["data"]["id"]
                if mutation == "location_id":
                    replacement = Location.objects.create(
                        LOCT_POINT=Point(123.89, 10.32, srid=4326),
                        LOCT_ADDRESS="Replacement",
                    )
                    self.business.LOCT_ID = replacement
                    self.business.save(update_fields=["LOCT_ID"])
                elif mutation == "point":
                    self.old_location.LOCT_POINT = Point(123.887, 10.317, srid=4326)
                    self.old_location.save(update_fields=["LOCT_POINT"])
                elif mutation == "address":
                    self.old_location.LOCT_ADDRESS = "Changed address"
                    self.old_location.save(update_fields=["LOCT_ADDRESS"])
                else:
                    self.old_landmark.BLMK_NAME = "Changed landmark"
                    self.old_landmark.save(update_fields=["BLMK_NAME"])
                count = Location.objects.count()
                self.assertEqual(self._approve(request_id).status_code, 400)
                self.assertEqual(Location.objects.count(), count)
                self.assertEqual(
                    BusinessLocationChangeRequest.objects.get(pk=request_id).BLCR_STATUS,
                    "pending",
                )
                self.client.force_authenticate(user=self.merchant)
                BusinessLocationChangeRequest.objects.filter(pk=request_id).update(
                    BLCR_STATUS="withdrawn",
                )
                if mutation == "location_id":
                    self.business.LOCT_ID = self.old_location
                    self.business.save(update_fields=["LOCT_ID"])
                    replacement.delete()
                elif mutation == "point":
                    self.old_location.LOCT_POINT = Point(123.8854, 10.3157, srid=4326)
                    self.old_location.save(update_fields=["LOCT_POINT"])
                elif mutation == "address":
                    self.old_location.LOCT_ADDRESS = "Gorordo Avenue, Cebu City"
                    self.old_location.save(update_fields=["LOCT_ADDRESS"])
                else:
                    self.old_landmark.BLMK_NAME = "Old landmark"
                    self.old_landmark.save(update_fields=["BLMK_NAME"])

    def test_replacing_landmark_with_same_values_is_stale(self):
        """A different live landmark identity invalidates the captured baseline."""
        request_id = self._submit().data["data"]["id"]
        self.old_landmark.delete()
        BusinessLandmark.objects.create(
            LOCT_ID=self.old_location,
            BLMK_NAME="Old landmark",
            BLMK_ADDRESS="Old address",
            BLMK_POINT=Point(123.886, 10.316, srid=4326),
            BLMK_SOURCE="google",
            BLMK_PLACE_ID="old-place",
        )
        count = Location.objects.count()
        self.assertEqual(self._approve(request_id).status_code, 400)
        self.assertEqual(Location.objects.count(), count)
        self.assertEqual(
            BusinessLocationChangeRequest.objects.get(pk=request_id).BLCR_STATUS,
            "pending",
        )

    def test_boundary_revalidated_for_location_and_landmarks(self):
        """A boundary change blocks approval after valid submission."""
        for proposed_landmarks in ([], self._payload()["proposed_landmarks"]):
            with self.subTest(landmarks=bool(proposed_landmarks)):
                request_id = self._submit(
                    self._payload(landmarks=proposed_landmarks)
                ).data["data"]["id"]
                if proposed_landmarks:
                    boundary = self._polygon(123.87, 10.30, 123.8915, 10.3215)
                else:
                    boundary = self._polygon(123.87, 10.30, 123.89, 10.32)
                self.boundary.SBND_BOUNDARY = boundary
                self.boundary.save(update_fields=["SBND_BOUNDARY"])
                self.assertEqual(self._approve(request_id).status_code, 400)
                self._assert_live_old()
                self.assertEqual(
                    BusinessLocationChangeRequest.objects.get(pk=request_id).BLCR_STATUS,
                    "pending",
                )
                self.client.force_authenticate(user=self.merchant)
                BusinessLocationChangeRequest.objects.filter(pk=request_id).update(
                    BLCR_STATUS="withdrawn",
                )
                self.boundary.SBND_BOUNDARY = self._polygon(
                    123.87, 10.30, 123.92, 10.34
                )
                self.boundary.save(update_fields=["SBND_BOUNDARY"])

    def test_failed_writes_rollback_every_live_change(self):
        """Failures at each write stage leave no proposed location or landmark."""
        request_id = self._submit().data["data"]["id"]
        patches = (
            "apps.merchant_operations.business_profile.services.business_location_change_service.Location.objects.create",
            "apps.merchant_operations.business_profile.services.business_location_change_service.BusinessLandmark.objects.create",
            "apps.merchant_operations.business_profile.services.business_location_change_service.Business.save",
            "apps.merchant_operations.business_profile.services.business_location_change_service.BusinessLocationChangeRequest.save",
        )
        for target in patches:
            with self.subTest(target=target):
                count = Location.objects.count()
                with patch(target, side_effect=RuntimeError("write failed")):
                    with self.assertRaises(RuntimeError):
                        self._approve(request_id)
                self.assertEqual(Location.objects.count(), count)
                self._assert_live_old()
                self.assertEqual(
                    BusinessLocationChangeRequest.objects.get(pk=request_id).BLCR_STATUS,
                    "pending",
                )

    def test_reject_and_owner_profile_landmark_fields(self):
        """Rejection preserves live state and owner profile supports editor prefill."""
        request_id = self._submit().data["data"]["id"]
        self.client.force_authenticate(user=self.super_admin)
        detail = self.client.get(f"{self.admin_url}{request_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["data"]["current"]["location"]["id"], self.old_location.pk)
        rejected = self.client.post(
            f"{self.admin_url}{request_id}/reject/",
            {"rejection_reason": "Please select a clearer pin."},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["data"]["status"], "rejected")
        self._assert_live_old()
        self.client.force_authenticate(user=self.merchant)
        profile = self.client.get("/api/merchant/business-profile/")
        self.assertEqual(profile.status_code, 200)
        landmark = profile.data["data"]["location"]["landmarks"][0]
        self.assertEqual(landmark["name"], "Old landmark")
        self.assertEqual(landmark["address"], "Old address")
        self.assertEqual(landmark["latitude"], 10.316)
        self.assertEqual(landmark["longitude"], 123.886)
        self.assertEqual(landmark["source"], "google")
        self.assertEqual(landmark["place_id"], "old-place")
        self.assertNotIn("provider", landmark)


class BusinessLocationChangeConcurrencyTests(TransactionTestCase):
    """Verify two Admin decisions cannot apply the same request twice."""

    def setUp(self):
        """Create committed rows visible to independent database connections."""
        self.merchant = BusinessLocationChangeViewTests._user(
            "concurrent-location-owner@example.com",
            User.UserRole.MERCHANT,
        )
        self.admin = BusinessLocationChangeViewTests._user(
            "concurrent-location-admin@example.com",
            User.UserRole.ADMIN,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Concurrent Cluster")
        category = Category.objects.create(
            CTGRY_NAME="Concurrent Category",
            CLUS_ID=cluster,
        )
        ServiceableBoundary.objects.create(
            SBND_NAME="Concurrent service area",
            SBND_BOUNDARY=BusinessLocationChangeViewTests._polygon(
                123.87, 10.30, 123.92, 10.34
            ),
            SBND_IS_ACTIVE=True,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Old address",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Concurrent Business",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        request = BusinessLocationChangeService.submit(
            user=self.merchant,
            proposed_location={
                "latitude": 10.321,
                "longitude": 123.891,
                "address": "New address",
                "city": "Cebu City",
                "province": "Cebu",
            },
            proposed_landmarks=[],
        )
        self.request_id = request.pk

    def test_parallel_admin_decisions_apply_once(self):
        """Serialize competing decisions on the request row lock."""
        barrier = Barrier(2)

        def approve():
            """Approve from a separate connection after simultaneous start."""
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                try:
                    BusinessLocationChangeService.approve(
                        self.request_id,
                        self.admin,
                    )
                    return "approved"
                except ValidationError:
                    return "rejected"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = [
                future.result(timeout=20)
                for future in (executor.submit(approve), executor.submit(approve))
            ]

        self.assertCountEqual(results, ["approved", "rejected"])
        self.assertEqual(Location.objects.count(), 1)
        self.assertEqual(
            BusinessLocationChangeRequest.objects.get(pk=self.request_id).BLCR_STATUS,
            "approved",
        )
