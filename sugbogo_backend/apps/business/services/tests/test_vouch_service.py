from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

from django.contrib.gis.geos import Point
from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.models.business_vouch_models import BusinessVouch
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

        cls.business_owner = User.objects.create_user(
            email="business-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
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
            USER_ID=cls.business_owner,
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

        cls.spicy_business_tag = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.spicy_tag,
        )

        cls.traditional_business_tag = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.traditional_tag,
        )

    def test_create_vouch(self):
        vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
            installation_id="test-device-001",
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
            vouch.VOUCH_INSTALLATION_ID,
            "test-device-001",
        )
        self.assertFalse(
            vouch.VOUCH_FLAG_SUSPICIOUS,
        )
        self.assertEqual(
            vouch.VOUCH_REPUTATION_SNAPSHOT,
            Decimal("0.20"),
        )
        self.assertTrue(
            vouch.VOUCH_EVIDENCE_IS_VALID,
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            1,
        )

        self.spicy_business_tag.refresh_from_db()

        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            1,
        )

    def test_create_vouch_increments_business_and_specialty_counts(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()
        self.traditional_business_tag.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            1,
        )
        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            1,
        )
        self.assertEqual(
            self.traditional_business_tag.BST_VOUCH_COUNT,
            0,
        )

    def test_create_vouch_rejects_duplicate_without_changing_counts(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You have already vouched for this specialty.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
            )

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            1,
        )
        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            1,
        )

    def test_merchant_cannot_vouch_for_own_business(self):
        self.business.USER_ID = self.user
        self.business.save(
            update_fields=["USER_ID"],
        )

        tag = self.business.SPECIALTY_TAGS.first()

        with self.assertRaisesMessage(
            ValidationError,
            "You cannot vouch for your own business.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=tag.TAG_ID,
            )

        self.assertFalse(
            BusinessVouch.objects.filter(
                BUSN_ID=self.business,
                USER_ID=self.user,
                TAG_ID=tag,
            ).exists(),
        )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            0,
        )

        self.spicy_business_tag.refresh_from_db()

        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            0,
        )

    def test_create_vouch_rejects_specialty_not_associated_with_business(
        self,
    ):
        with self.assertRaisesMessage(
            ValidationError,
            "This specialty is not associated with the business.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.unrelated_tag.TAG_ID,
            )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            0,
        )

    def test_create_vouch_rejects_inactive_specialty(self):
        self.spicy_business_tag.BST_IS_ACTIVE = False
        self.spicy_business_tag.BST_DEACTIVATED_AT = timezone.now()
        self.spicy_business_tag.save(
            update_fields=[
                "BST_IS_ACTIVE",
                "BST_DEACTIVATED_AT",
                "BST_UPDATED_AT",
            ],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "This specialty is not associated with the business.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
            )

        self.assertFalse(
            BusinessVouch.objects.filter(
                BUSN_ID=self.business,
                USER_ID=self.user,
                TAG_ID=self.spicy_tag,
            ).exists(),
        )

    def test_create_vouch_rejects_suspended_business(self):
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(
            update_fields=["BUSN_STATUS"],
        )

        with self.assertRaisesMessage(
            ValidationError,
            "You cannot vouch for an inactive business.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=self.business.BUSN_ID,
                tag_id=self.spicy_tag.TAG_ID,
            )

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()

        self.assertFalse(BusinessVouch.objects.exists())
        self.assertEqual(self.business.BUSN_VOUCH_COUNT, 0)
        self.assertEqual(self.spicy_business_tag.BST_VOUCH_COUNT, 0)

    def test_create_vouch_rejects_nonexistent_business(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            VouchService.create_vouch(
                user=self.user,
                business_id=999999,
                tag_id=self.spicy_tag.TAG_ID,
            )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            0,
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
            )

        self.business.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            0,
        )

    def test_remove_vouch(self):
        vouch = VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        VouchService.remove_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        self.assertFalse(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            0,
        )
        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            0,
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

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            0,
        )
        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            0,
        )

    def test_has_vouched_returns_true_when_vouch_exists(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
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
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        VouchService.create_vouch(
            user=self.second_user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        self.assertEqual(
            self.business.vouches.filter(
                TAG_ID=self.spicy_tag,
            ).count(),
            2,
        )

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            2,
        )
        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            2,
        )

    def test_user_can_vouch_for_multiple_specialties_of_same_business(self):
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.spicy_tag.TAG_ID,
        )

        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.traditional_tag.TAG_ID,
        )

        self.assertEqual(
            self.business.vouches.filter(
                USER_ID=self.user,
            ).count(),
            2,
        )

        self.business.refresh_from_db()
        self.spicy_business_tag.refresh_from_db()
        self.traditional_business_tag.refresh_from_db()

        self.assertEqual(
            self.business.BUSN_VOUCH_COUNT,
            2,
        )
        self.assertEqual(
            self.spicy_business_tag.BST_VOUCH_COUNT,
            1,
        )
        self.assertEqual(
            self.traditional_business_tag.BST_VOUCH_COUNT,
            1,
        )


class ConcurrentVouchRemovalTests(TransactionTestCase):
    """Verify competing removals cannot decrement vouch counts twice."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="concurrent-vouch@example.com",
            password="StrongPassword123!",
            USER_FNAME="Concurrent",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        owner = User.objects.create_user(
            email="concurrent-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(
            CLUS_NAME="Concurrent Food",
            CLUS_DESCRIPTION="Food businesses",
        )
        category = Category.objects.create(
            CTGRY_NAME="Concurrent Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Concurrent Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        self.tag = SpecialtyTag.objects.create(
            TAG_NAME="Concurrent Spicy",
            TAG_COLOR="red",
        )
        self.business_tag = BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=self.tag,
        )
        VouchService.create_vouch(
            user=self.user,
            business_id=self.business.BUSN_ID,
            tag_id=self.tag.TAG_ID,
        )

    def test_competing_removals_decrement_counts_once(self):
        if connection.vendor != "postgresql":
            self.skipTest("Row-lock concurrency requires PostgreSQL.")

        barrier = Barrier(2)

        def remove_concurrently():
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                VouchService.remove_vouch(
                    user=self.user,
                    business_id=self.business.BUSN_ID,
                    tag_id=self.tag.TAG_ID,
                )
                return "removed"
            except NotFound:
                return "not_found"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(remove_concurrently)
                for _ in range(2)
            ]
            results = [
                future.result()
                for future in futures
            ]

        self.assertCountEqual(results, ["removed", "not_found"])
        self.assertFalse(BusinessVouch.objects.exists())
        self.business.refresh_from_db()
        self.business_tag.refresh_from_db()
        self.assertEqual(self.business.BUSN_VOUCH_COUNT, 0)
        self.assertEqual(self.business_tag.BST_VOUCH_COUNT, 0)
