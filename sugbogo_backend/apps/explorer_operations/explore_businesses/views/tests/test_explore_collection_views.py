from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from urllib.parse import urlencode

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    SpecialtyTag,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
)
from apps.users.models import User, UserCategoryInterest


class ExploreCollectionViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="collections-explorer@example.com",
            password=None,
            USER_FNAME="Collection",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.explorer)
        self.food_cluster = Cluster.objects.create(
            CLUS_NAME="Collection Food",
        )
        self.cafe_category = Category.objects.create(
            CTGRY_NAME="Collection Cafe",
            CLUS_ID=self.food_cluster,
        )
        self.restaurant_category = Category.objects.create(
            CTGRY_NAME="Collection Restaurant",
            CLUS_ID=self.food_cluster,
        )
        self.outdoor_cluster = Cluster.objects.create(
            CLUS_NAME="Collection Outdoor",
        )
        self.trail_category = Category.objects.create(
            CTGRY_NAME="Collection Trail",
            CLUS_ID=self.outdoor_cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Collection Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.coffee_tag = SpecialtyTag.objects.create(
            TAG_NAME="Collection Coffee",
        )
        self.hiking_tag = SpecialtyTag.objects.create(
            TAG_NAME="Collection Hiking",
        )
        self.owner_number = 0

    def _create_business(
        self,
        name,
        category=None,
    ):
        self.owner_number += 1
        owner = User.objects.create_user(
            email=f"collection-owner-{self.owner_number}@example.com",
            password=None,
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_DESCRIPTION="Collection test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=category or self.cafe_category,
            LOCT_ID=self.location,
        )

    @staticmethod
    def _add_score(
        business,
        discovery_score,
        visibility_gap=Decimal("0.50000"),
    ):
        return DiscoveryScore.objects.create(
            BUSN_ID=business,
            DSC_S_SCORE=Decimal("0.50000"),
            DSC_V_SCORE=visibility_gap,
            DSC_D_SCORE=discovery_score,
            DSC_COMPUTED_AT=timezone.now(),
        )

    @staticmethod
    def _add_specialty(
        business,
        tag,
        tag_score,
        is_active=True,
    ):
        return BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=tag,
            BST_TAG_SCORE=tag_score,
            BST_IS_ACTIVE=is_active,
        )

    def _get_collection(
        self,
        collection_type,
        params=None,
    ):
        url = f"/api/explorer/explore/collections/{collection_type}/"

        if isinstance(params, list):
            url = f"{url}?{urlencode(params)}"
            params = None

        return self.client.get(
            url,
            data=params,
        )

    def test_worth_discovering_preserves_discovery_order_under_specialty_filter(
        self,
    ):
        high_discovery = self._create_business("High Discovery")
        high_tag_score = self._create_business("High Tag Score")
        self._add_score(
            high_discovery,
            Decimal("0.90000"),
        )
        self._add_score(
            high_tag_score,
            Decimal("0.10000"),
        )
        self._add_specialty(
            high_discovery,
            self.coffee_tag,
            Decimal("0.10000"),
        )
        self._add_specialty(
            high_tag_score,
            self.coffee_tag,
            Decimal("0.90000"),
        )

        response = self._get_collection(
            "worth-discovering",
            {
                "specialty_tag": self.coffee_tag.TAG_ID,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [high_discovery.BUSN_ID, high_tag_score.BUSN_ID],
        )

    def test_category_multiselect_is_or_and_filter_groups_are_and(self):
        cafe = self._create_business("Cafe Coffee")
        restaurant = self._create_business(
            "Restaurant Coffee",
            self.restaurant_category,
        )
        trail = self._create_business(
            "Trail Coffee",
            self.trail_category,
        )
        cafe_without_tag = self._create_business("Cafe Without Coffee")

        for business in (cafe, restaurant, trail):
            self._add_specialty(
                business,
                self.coffee_tag,
                Decimal("0.50000"),
            )

        response = self._get_collection(
            "worth-discovering",
            [
                ("category", self.cafe_category.CTGRY_ID),
                ("category", self.restaurant_category.CTGRY_ID),
                ("cluster", self.food_cluster.CLUS_ID),
                ("specialty_tag", self.coffee_tag.TAG_ID),
            ],
        )
        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            returned_ids,
            {
                cafe.BUSN_ID,
                restaurant.BUSN_ID,
            },
        )
        self.assertNotIn(trail.BUSN_ID, returned_ids)
        self.assertNotIn(cafe_without_tag.BUSN_ID, returned_ids)

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        return_value=[],
    )
    def test_recommendations_exclude_no_match_and_preserve_ranking(
        self,
        _profile_visits,
    ):
        UserCategoryInterest.objects.create(
            USER_ID=self.explorer,
            CTGRY_ID=self.cafe_category,
        )
        lower_gap = self._create_business("Lower Visibility Gap")
        higher_gap = self._create_business("Higher Visibility Gap")
        no_match = self._create_business(
            "No Match",
            self.trail_category,
        )
        self._add_score(
            lower_gap,
            Decimal("0.90000"),
            visibility_gap=Decimal("0.10000"),
        )
        self._add_score(
            higher_gap,
            Decimal("0.10000"),
            visibility_gap=Decimal("0.90000"),
        )
        self._add_score(
            no_match,
            Decimal("1.00000"),
            visibility_gap=Decimal("1.00000"),
        )

        response = self._get_collection("interests")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [higher_gap.BUSN_ID, lower_gap.BUSN_ID],
        )

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        return_value=[],
    )
    def test_cold_start_discovery_fallback_is_not_a_personalized_collection(
        self,
        _profile_visits,
    ):
        business = self._create_business("Cold Start Discovery")
        self._add_score(
            business,
            Decimal("1.00000"),
        )

        response = self._get_collection("interests")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)

    def test_new_businesses_preserve_chronological_ordering(self):
        older = self._create_business("Older Business")
        newer = self._create_business("Newer Business")
        now = timezone.now()
        Business.objects.filter(
            BUSN_ID=older.BUSN_ID,
        ).update(
            BUSN_CREATED_AT=now - timedelta(days=1),
        )
        Business.objects.filter(
            BUSN_ID=newer.BUSN_ID,
        ).update(
            BUSN_CREATED_AT=now,
        )

        response = self._get_collection("new-businesses")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [newer.BUSN_ID, older.BUSN_ID],
        )

    def test_active_status_is_required_but_verification_is_not(self):
        unverified = self._create_business("Unverified Active")
        verified = self._create_business("Verified Active")
        suspended = self._create_business("Suspended")
        Business.objects.filter(
            BUSN_ID=verified.BUSN_ID,
        ).update(
            BUSN_IS_VERIFIED=True,
        )
        Business.objects.filter(
            BUSN_ID=suspended.BUSN_ID,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )

        response = self._get_collection("worth-discovering")
        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(unverified.BUSN_ID, returned_ids)
        self.assertIn(verified.BUSN_ID, returned_ids)
        self.assertNotIn(suspended.BUSN_ID, returned_ids)

    def test_worth_discovering_page_query_count_does_not_scale_with_items(self):
        for index in range(10):
            business = self._create_business(f"Query Business {index}")
            self._add_specialty(
                business,
                self.coffee_tag,
                Decimal("0.50000"),
            )

        with self.assertNumQueries(3):
            response = self._get_collection("worth-discovering")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]["items"]), 10)

    def test_pagination_preserves_deterministic_discovery_ordering(self):
        now = timezone.now()
        businesses = []

        for index in range(12):
            business = self._create_business(f"Page Business {index}")
            self._add_score(
                business,
                Decimal("0.50000"),
            )
            businesses.append(business)

        Business.objects.filter(
            BUSN_ID__in=[business.BUSN_ID for business in businesses],
        ).update(
            BUSN_CREATED_AT=now,
        )

        returned_ids = []

        for page in (1, 2, 3):
            response = self._get_collection(
                "worth-discovering",
                {
                    "page": page,
                    "page_size": 5,
                },
            )
            returned_ids.extend(
                item["id"]
                for item in response.data["data"]["items"]
            )

        self.assertEqual(
            returned_ids,
            sorted(business.BUSN_ID for business in businesses),
        )
