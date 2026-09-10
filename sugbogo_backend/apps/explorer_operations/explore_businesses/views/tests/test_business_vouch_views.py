from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.vouch_service import VouchService
from apps.users.models import User


class BusinessVouchViewTests(APITestCase):
    """Tests for Explorer business specialty vouch API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="explorer-vouch@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_user = User.objects.create_user(
            email="explorer-vouch-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.business_owner = User.objects.create_user(
            email="merchant-vouch-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(self.user)

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.business_owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.spicy_tag = SpecialtyTag.objects.create(
            TAG_NAME="Spicy",
            TAG_COLOR="red",
        )

        self.traditional_tag = SpecialtyTag.objects.create(
            TAG_NAME="Traditional",
            TAG_COLOR="blue",
        )

        self.unrelated_tag = SpecialtyTag.objects.create(
            TAG_NAME="Eco Friendly",
            TAG_COLOR="green",
        )

        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=self.spicy_tag,
        )

        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=self.traditional_tag,
        )

        self.url = (
            f"/api/explorer/explore/businesses/"
            f"{self.business.BUSN_ID}/vouch/"
        )

    def test_create_vouch_successfully(self):
        payload = {
            "tag_id": self.spicy_tag.TAG_ID,
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            self.business.vouches.filter(
                USER_ID=self.user,
                TAG_ID=self.spicy_tag,
            ).exists()
        )

        vouch = self.business.vouches.get(
            USER_ID=self.user,
            TAG_ID=self.spicy_tag,
        )

        self.assertEqual(
            vouch.VOUCH_DEVICE_ID,
            "test-device-001",
        )

        self.assertEqual(
            response.data["message"],
            "Vouch added successfully.",
        )

        self.assertTrue(
            response.data["data"]["is_vouched"],
        )

        self.assertEqual(
            response.data["data"]["business_id"],
            self.business.BUSN_ID,
        )

        self.assertEqual(
            response.data["data"]["tag_id"],
            self.spicy_tag.TAG_ID,
        )

    def test_create_vouch_rejects_invalid_tag(self):
        payload = {
            "tag_id": self.unrelated_tag.TAG_ID,
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "This specialty is not associated with the business.",
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertFalse(
            self.business.vouches.exists(),
        )

    def test_create_vouch_rejects_missing_tag_id(self):
        payload = {
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "tag_id",
            response.data["errors"],
        )

    def test_create_vouch_rejects_invalid_tag_id(self):
        payload = {
            "tag_id": "invalid",
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "tag_id",
            response.data["errors"],
        )

    def test_create_vouch_rejects_duplicate_vouch(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        payload = {
            "tag_id": self.spicy_tag.TAG_ID,
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "You have already vouched for this specialty.",
        )

        self.assertEqual(
            self.business.vouches.filter(
                USER_ID=self.user,
                TAG_ID=self.spicy_tag,
            ).count(),
            1,
        )

    def test_remove_vouch_successfully(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        response = self.client.delete(
            self.url,
            {
                "tag_id": self.spicy_tag.TAG_ID,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            self.business.vouches.filter(
                USER_ID=self.user,
                TAG_ID=self.spicy_tag,
            ).exists()
        )

        self.assertEqual(
            response.data["message"],
            "Vouch removed successfully.",
        )

        self.assertFalse(
            response.data["data"]["is_vouched"],
        )

    def test_remove_vouch_rejects_nonexistent_vouch(self):
        response = self.client.delete(
            self.url,
            {
                "tag_id": self.spicy_tag.TAG_ID,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "Your vouch could not be found.",
        )

    def test_unauthenticated_user_cannot_create_vouch(self):
        self.client.force_authenticate(user=None)

        payload = {
            "tag_id": self.spicy_tag.TAG_ID,
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            self.business.vouches.exists(),
        )

    def test_unauthenticated_user_cannot_remove_vouch(self):
        self.client.force_authenticate(user=None)

        response = self.client.delete(
            self.url,
            {
                "tag_id": self.spicy_tag.TAG_ID,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_different_users_can_vouch_for_same_specialty(self):
        first_response = self.client.post(
            self.url,
            {
                "tag_id": self.spicy_tag.TAG_ID,
                "device_id": "test-device-001",
            },
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(self.second_user)

        second_response = self.client.post(
            self.url,
            {
                "tag_id": self.spicy_tag.TAG_ID,
                "device_id": "test-device-002",
            },
            format="json",
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            self.business.vouches.filter(
                TAG_ID=self.spicy_tag,
            ).count(),
            2,
        )
