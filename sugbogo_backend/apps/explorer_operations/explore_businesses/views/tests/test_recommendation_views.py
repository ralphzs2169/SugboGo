from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
)
from apps.shared.services.mongodb_service import MongoDBService
from apps.users.models import User, UserCategoryInterest


class RecommendationViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="recommendation-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Recommendation",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.explorer)
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Recommendation Cluster",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Recommendation Category",
            CLUS_ID=self.cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Recommendation Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.url = "/api/explorer/explore/recommendations/"

    def _create_business(
        self,
        name,
        status_value=Business.BusinessStatus.ACTIVE,
    ):
        owner = User.objects.create_user(
            email=f"{name.lower().replace(' ', '-')}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_DESCRIPTION="Recommendation test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status_value,
            BUSN_IS_VERIFIED=False,
            USER_ID=owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

    def _create_score(
        self,
        business,
        visibility_gap,
        discovery_score,
    ):
        DiscoveryScore.objects.create(
            BUSN_ID=business,
            DSC_S_SCORE=Decimal("0.50000"),
            DSC_V_SCORE=visibility_gap,
            DSC_D_SCORE=discovery_score,
            DSC_COMPUTED_AT=timezone.now(),
        )

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        return_value=[],
    )
    def test_personalized_order_uses_visibility_gap_and_hides_internal_scores(
        self,
        _profile_visits,
    ):
        lower_gap = self._create_business("Lower Gap")
        higher_gap = self._create_business("Higher Gap")
        suspended = self._create_business(
            "Suspended Match",
            Business.BusinessStatus.SUSPENDED,
        )
        self._create_score(
            lower_gap,
            Decimal("0.20000"),
            Decimal("0.90000"),
        )
        self._create_score(
            higher_gap,
            Decimal("0.80000"),
            Decimal("0.10000"),
        )
        self._create_score(
            suspended,
            Decimal("1.00000"),
            Decimal("1.00000"),
        )
        UserCategoryInterest.objects.create(
            USER_ID=self.explorer,
            CTGRY_ID=self.category,
        )

        response = self.client.get(self.url)
        items = response.data["data"]["items"]

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in items],
            [higher_gap.BUSN_ID, lower_gap.BUSN_ID],
        )
        self.assertNotIn("similarity", items[0])
        self.assertNotIn("visibility_gap", items[0])
        self.assertNotIn("relevance_group", items[0])

    def test_authentication_is_required(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mongo_cooldown_preserves_postgresql_recommendations(self):
        business = self._create_business(
            "Mongo Outage Recommendation",
        )
        self._create_score(
            business,
            Decimal("0.50000"),
            Decimal("0.50000"),
        )
        UserCategoryInterest.objects.create(
            USER_ID=self.explorer,
            CTGRY_ID=self.category,
        )

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
            response = self.client.get(
                self.url,
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"]["items"][0]["id"],
            business.BUSN_ID,
        )
        get_database.assert_not_called()

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        return_value=[],
    )
    def test_candidate_count_does_not_create_n_plus_one_queries(
        self,
        _profile_visits,
    ):
        RecommendationAlgorithmConfigurationService.get_current_configuration()
        UserCategoryInterest.objects.create(
            USER_ID=self.explorer,
            CTGRY_ID=self.category,
        )

        for index in range(5):
            self._create_business(f"Query Pattern {index}")

        with self.assertNumQueries(9):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]["items"]), 5)
