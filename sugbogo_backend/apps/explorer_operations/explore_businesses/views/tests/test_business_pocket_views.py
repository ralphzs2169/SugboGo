from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessPocket,
    Category,
    Cluster,
    Location,
)
from apps.business.services.pocket_service import PocketService
from apps.users.models import User


class BusinessPocketViewTests(APITestCase):
    """Tests for Explorer business pocket API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="explorer-pocket@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_user = User.objects.create_user(
            email="explorer-pocket-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
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
            USER_ID=self.user,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.url = (
            f"/api/explorer/explore/businesses/"
            f"{self.business.BUSN_ID}/pocket/"
        )

    def test_create_pocket_successfully(self):
        response = self.client.post(
            self.url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            BusinessPocket.objects.filter(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).exists()
        )

        pocket = BusinessPocket.objects.get(
            USER_ID=self.user,
            BUSN_ID=self.business,
        )

        self.assertEqual(
            response.data["message"],
            "Business added to your pocket successfully.",
        )

        self.assertEqual(
            response.data["data"]["id"],
            pocket.PCKT_ID,
        )

        self.assertEqual(
            response.data["data"]["business_id"],
            self.business.BUSN_ID,
        )

        self.assertTrue(
            response.data["data"]["is_pocketed"],
        )

    def test_create_pocket_rejects_duplicate_pocket(self):
        PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        response = self.client.post(
            self.url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "You have already added this business to your pocket.",
        )

        self.assertEqual(
            BusinessPocket.objects.filter(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).count(),
            1,
        )

    def test_create_pocket_rejects_nonexistent_business(self):
        url = "/api/explorer/explore/businesses/999999/pocket/"

        response = self.client.post(
            url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The business could not be found.",
        )

    def test_remove_pocket_successfully(self):
        PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        response = self.client.delete(
            self.url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            BusinessPocket.objects.filter(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).exists()
        )

        self.assertEqual(
            response.data["message"],
            "Business removed from your pocket successfully.",
        )

        self.assertEqual(
            response.data["data"]["business_id"],
            self.business.BUSN_ID,
        )

        self.assertFalse(
            response.data["data"]["is_pocketed"],
        )

    def test_remove_pocket_rejects_nonexistent_pocket(self):
        response = self.client.delete(
            self.url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "This business is not in your pocket.",
        )

    def test_unauthenticated_user_cannot_create_pocket(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            BusinessPocket.objects.filter(
                BUSN_ID=self.business,
            ).exists()
        )

    def test_unauthenticated_user_cannot_remove_pocket(self):
        self.client.force_authenticate(user=None)

        response = self.client.delete(
            self.url,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_different_users_can_pocket_same_business(self):
        first_response = self.client.post(
            self.url,
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(self.second_user)

        second_response = self.client.post(
            self.url,
            format="json",
        )

        self.assertEqual(
            second_response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            BusinessPocket.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            2,
        )