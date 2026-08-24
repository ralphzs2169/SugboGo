from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessPocket,
    Category,
    Cluster,
    Location,
)
from apps.business.services.pocket_service import PocketService
from apps.users.models import User


class BusinessPocketServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.second_user = User.objects.create_user(
            email="explorer2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cls.cluster,
        )

        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.user,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

    def test_create_pocket(self):
        pocket = PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        self.assertEqual(
            pocket.BUSN_ID_id,
            self.business.BUSN_ID,
        )
        self.assertEqual(
            pocket.USER_ID_id,
            self.user.pk,
        )

        self.assertTrue(
            BusinessPocket.objects.filter(
                PCKT_ID=pocket.PCKT_ID,
            ).exists()
        )

    def test_create_pocket_rejects_duplicate(self):
        PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already added this business to your pocket.",
        ):
            PocketService.create_pocket(
                user=self.user,
                business_id=self.business.BUSN_ID,
            )

    def test_create_pocket_rejects_nonexistent_business(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            PocketService.create_pocket(
                user=self.user,
                business_id=999999,
            )

    def test_remove_pocket(self):
        pocket = PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        PocketService.remove_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        self.assertFalse(
            BusinessPocket.objects.filter(
                PCKT_ID=pocket.PCKT_ID,
            ).exists()
        )

    def test_remove_pocket_rejects_nonexistent_pocket(self):
        with self.assertRaisesMessage(
            NotFound,
            "This business is not in your pocket.",
        ):
            PocketService.remove_pocket(
                user=self.user,
                business_id=self.business.BUSN_ID,
            )

    def test_has_pocketed_returns_true_when_pocket_exists(self):
        PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        self.assertTrue(
            PocketService.has_pocketed(
                user=self.user,
                business_id=self.business.BUSN_ID,
            )
        )

    def test_has_pocketed_returns_false_when_pocket_does_not_exist(self):
        self.assertFalse(
            PocketService.has_pocketed(
                user=self.user,
                business_id=self.business.BUSN_ID,
            )
        )

    def test_different_users_can_pocket_same_business(self):
        first_pocket = PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        second_pocket = PocketService.create_pocket(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
        )

        self.assertNotEqual(
            first_pocket.PCKT_ID,
            second_pocket.PCKT_ID,
        )

        self.assertEqual(
            BusinessPocket.objects.filter(
                BUSN_ID=self.business,
            ).count(),
            2,
        )

    def test_user_can_pocket_multiple_businesses(self):
        second_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9000,
                10.3200,
                srid=4326,
            ),
            LOCT_ADDRESS="Colon Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        second_business = Business.objects.create(
            BUSN_NAME="Second Bistro",
            BUSN_DESCRIPTION="Another Cebu-based restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.second_user,
            CTGRY_ID=self.category,
            LOCT_ID=second_location,
        )

        first_pocket = PocketService.create_pocket(
            user=self.user,
            business_id=self.business.BUSN_ID,
        )

        second_pocket = PocketService.create_pocket(
            user=self.user,
            business_id=second_business.BUSN_ID,
        )

        self.assertNotEqual(
            first_pocket.PCKT_ID,
            second_pocket.PCKT_ID,
        )

        self.assertEqual(
            BusinessPocket.objects.filter(
                USER_ID=self.user,
            ).count(),
            2,
        )