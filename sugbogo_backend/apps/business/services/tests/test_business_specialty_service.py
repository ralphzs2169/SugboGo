from datetime import timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.business_management.serializers.manage_business_serializers import (
    AdminBusinessDetailSerializer,
    AdminBusinessListSerializer,
)
from apps.admin_operations.business_management.services.manage_business_service import (
    BusinessService as AdminBusinessService,
)
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.business_specialty_service import (
    BusinessSpecialtyService,
)
from apps.business.services.vouch_service import VouchService
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    ExploreBusinessDetailSerializer,
    ExploreBusinessSerializer,
)
from apps.explorer_operations.explore_businesses.services.explore_business_service import (
    ExploreBusinessService,
)
from apps.explorer_operations.explore_businesses.services.new_businesses_service import (
    NewBusinessesService,
)
from apps.users.models import User


class BusinessSpecialtyServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.explorer = User.objects.create_user(
            email="specialty-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.business_owner = User.objects.create_user(
            email="specialty-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
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
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.business_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

        cls.active_tag = SpecialtyTag.objects.create(
            TAG_NAME="Traditional",
            TAG_COLOR="blue",
        )

        cls.inactive_tag = SpecialtyTag.objects.create(
            TAG_NAME="Affordable",
            TAG_COLOR="green",
        )

        cls.active_business_specialty = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.active_tag,
        )

        cls.inactive_business_specialty = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.inactive_tag,
        )

    def setUp(self):
        BusinessSpecialtyTag.objects.filter(
            BST_ID=self.active_business_specialty.BST_ID,
        ).update(
            BST_IS_ACTIVE=True,
            BST_ACTIVATED_AT=timezone.now(),
            BST_DEACTIVATED_AT=None,
        )

        BusinessSpecialtyTag.objects.filter(
            BST_ID=self.inactive_business_specialty.BST_ID,
        ).update(
            BST_IS_ACTIVE=True,
            BST_ACTIVATED_AT=timezone.now(),
            BST_DEACTIVATED_AT=None,
        )

        BusinessVouch.objects.all().delete()

        Business.objects.filter(
            BUSN_ID=self.business.BUSN_ID,
        ).update(
            BUSN_VOUCH_COUNT=0,
        )

    def test_new_business_specialty_is_active(self):
        business_specialty = BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=SpecialtyTag.objects.create(
                TAG_NAME="Family Friendly",
                TAG_COLOR="purple",
            ),
        )

        self.assertTrue(
            business_specialty.BST_IS_ACTIVE,
        )
        self.assertIsNotNone(
            business_specialty.BST_ACTIVATED_AT,
        )
        self.assertIsNone(
            business_specialty.BST_DEACTIVATED_AT,
        )

    def test_deactivate_specialty_preserves_row_and_primary_key(self):
        original_id = self.inactive_business_specialty.BST_ID

        result = BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        self.assertEqual(
            result.BST_ID,
            original_id,
        )
        self.assertFalse(
            result.BST_IS_ACTIVE,
        )
        self.assertIsNotNone(
            result.BST_DEACTIVATED_AT,
        )
        self.assertTrue(
            BusinessSpecialtyTag.objects.filter(
                BST_ID=original_id,
            ).exists(),
        )

    def test_deactivate_specialty_preserves_existing_vouch(self):
        vouch = VouchService.create_vouch(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        self.assertTrue(
            BusinessVouch.objects.filter(
                VOUCH_ID=vouch.VOUCH_ID,
            ).exists(),
        )

    def test_reactivate_specialty_reuses_row_and_updates_timestamps(self):
        previous_activation = timezone.now() - timedelta(days=30)

        BusinessSpecialtyTag.objects.filter(
            BST_ID=self.inactive_business_specialty.BST_ID,
        ).update(
            BST_ACTIVATED_AT=previous_activation,
        )

        deactivated = BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        reactivated = BusinessSpecialtyService.reactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        self.assertEqual(
            reactivated.BST_ID,
            deactivated.BST_ID,
        )
        self.assertTrue(
            reactivated.BST_IS_ACTIVE,
        )
        self.assertIsNone(
            reactivated.BST_DEACTIVATED_AT,
        )
        self.assertGreater(
            reactivated.BST_ACTIVATED_AT,
            previous_activation,
        )
        self.assertEqual(
            BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
                TAG_ID=self.inactive_tag,
            ).count(),
            1,
        )

    def test_lifecycle_operations_raise_not_found_for_missing_pair(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business specialty could not be found.",
        ):
            BusinessSpecialtyService.deactivate_specialty(
                business_id=self.business.BUSN_ID,
                tag_id=999999,
            )

    def test_explorer_list_excludes_inactive_specialty(self):
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        business = NewBusinessesService.list_new_businesses(
            self.explorer,
        ).get(
            BUSN_ID=self.business.BUSN_ID,
        )

        data = ExploreBusinessSerializer(
            business,
        ).data

        specialty_ids = {
            specialty["id"]
            for specialty in data["specialty_tags"]
        }

        self.assertEqual(
            specialty_ids,
            {self.active_tag.TAG_ID},
        )

    def test_explorer_detail_excludes_inactive_specialty(self):
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        business = ExploreBusinessService.get_business_detail(
            business_id=self.business.BUSN_ID,
            user=self.explorer,
        )

        data = ExploreBusinessDetailSerializer(
            business,
        ).data

        specialty_ids = {
            specialty["id"]
            for specialty in data["specialty_tags"]
        }

        self.assertEqual(
            specialty_ids,
            {self.active_tag.TAG_ID},
        )

    def test_admin_list_and_detail_exclude_inactive_specialty(self):
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        list_business = AdminBusinessService.list_businesses().get(
            BUSN_ID=self.business.BUSN_ID,
        )

        list_data = AdminBusinessListSerializer(
            list_business,
        ).data

        detail_business = AdminBusinessService.get_business_detail(
            self.business.BUSN_ID,
        )

        detail_data = AdminBusinessDetailSerializer(
            detail_business,
        ).data

        self.assertEqual(
            {
                specialty["id"]
                for specialty in list_data["specialty_tags"]
            },
            {self.active_tag.TAG_ID},
        )
        self.assertEqual(
            {
                specialty["id"]
                for specialty in detail_data["specialty_tags"]
            },
            {self.active_tag.TAG_ID},
        )

    def test_admin_specialty_filter_ignores_inactive_assignment(self):
        BusinessSpecialtyService.deactivate_specialty(
            business_id=self.business.BUSN_ID,
            tag_id=self.inactive_tag.TAG_ID,
        )

        self.assertFalse(
            AdminBusinessService.list_businesses(
                specialty_tag=self.inactive_tag.TAG_ID,
            ).filter(
                BUSN_ID=self.business.BUSN_ID,
            ).exists(),
        )

