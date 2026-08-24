from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

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


class BusinessVouchServiceTests(TestCase):
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

        cls.spicy_tag = SpecialtyTag.objects.create(
            TAG_NAME="Spicy",
            TAG_COLOR="red",
        )

        cls.traditional_tag = SpecialtyTag.objects.create(
            TAG_NAME="Traditional",
            TAG_COLOR="blue",
        )

        cls.unrelated_tag = SpecialtyTag.objects.create(
            TAG_NAME="Eco Friendly",
            TAG_COLOR="green",
        )

        BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.spicy_tag,
        )

        BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.traditional_tag,
        )

    def test_create_vouch(self):
        vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        self.assertEqual(
            vouch.BUSN_ID_id,
            self.business.BUSN_ID,
        )
        self.assertEqual(
            vouch.USER_ID_id,
            self.user.pk,
        )
        self.assertEqual(
            vouch.TAG_ID_id,
            self.spicy_tag.TAG_ID,
        )
        self.assertEqual(
            vouch.VOUCH_DEVICE_ID,
            "test-device-001",
        )
        self.assertFalse(
            vouch.VOUCH_FLAG_SUSPICIOUS,
        )

    def test_create_vouch_rejects_duplicate(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already vouched for this specialty.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
                device_id="test-device-001",
            )

    def test_create_vouch_rejects_specialty_not_associated_with_business(self):
        with self.assertRaisesMessage(
            ValidationError,
            "This specialty is not associated with the business.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.unrelated_tag.TAG_ID,
                device_id="test-device-001",
            )

    def test_create_vouch_rejects_nonexistent_business(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=999999,
                tag_id=self.spicy_tag.TAG_ID,
                device_id="test-device-001",
            )

    def test_create_vouch_rejects_nonexistent_specialty_tag(self):
        with self.assertRaisesMessage(
            NotFound,
            "The specialty tag could not be found.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=999999,
                device_id="test-device-001",
            )

    def test_remove_vouch(self):
        vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        VouchService.remove_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        self.assertFalse(
            Business.objects.get(
                BUSN_ID=self.business.BUSN_ID,
            )
            .vouches.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            )
            .exists()
        )

    def test_remove_vouch_rejects_nonexistent_vouch(self):
        with self.assertRaisesMessage(
            NotFound,
            "Your vouch could not be found.",
        ):
            VouchService.remove_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
            )

    def test_has_vouched_returns_true_when_vouch_exists(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        self.assertTrue(
            VouchService.has_vouched(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
            )
        )

    def test_has_vouched_returns_false_when_vouch_does_not_exist(self):
        self.assertFalse(
            VouchService.has_vouched(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
            )
        )

    def test_different_users_can_vouch_for_same_business_and_tag(self):
        first_vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        second_vouch = VouchService.create_vouch(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-002",
        )

        self.assertNotEqual(
            first_vouch.VOUCH_ID,
            second_vouch.VOUCH_ID,
        )

        self.assertEqual(
            self.business.vouches.filter(
                TAG_ID=self.spicy_tag,
            ).count(),
            2,
        )

    def test_user_can_vouch_for_multiple_specialties_of_same_business(self):
        spicy_vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            device_id="test-device-001",
        )

        traditional_vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.traditional_tag.TAG_ID,
            device_id="test-device-001",
        )

        self.assertNotEqual(
            spicy_vouch.VOUCH_ID,
            traditional_vouch.VOUCH_ID,
        )

        self.assertEqual(
            self.business.vouches.filter(
                USER_ID=self.user,
            ).count(),
            2,
        )