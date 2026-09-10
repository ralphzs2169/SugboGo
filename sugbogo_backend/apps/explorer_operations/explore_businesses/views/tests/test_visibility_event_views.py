from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

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
from apps.users.models import User


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
        missing_response = self.client.post(
            self.impression_url,
            {},
            format="json",
        )
        invalid_response = self.client.post(
            self.impression_url,
            {
                "business_ids": "not-a-list",
            },
            format="json",
        )

        self.assertEqual(
            missing_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn(
            "business_ids",
            missing_response.data["errors"],
        )
        self.assertEqual(
            invalid_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

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
