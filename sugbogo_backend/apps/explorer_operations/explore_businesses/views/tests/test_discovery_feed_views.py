from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    SpecialtyTag,
)
from apps.business.services.discovery_score_service import DiscoveryScoreService
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.explorer_operations.explore_businesses.services.new_businesses_service import (
    NewBusinessesService,
)
from apps.users.models import User


class DiscoveryFeedTests(TestCase):
    """Tests the PostgreSQL-ranked Explorer discovery feed."""

    def setUp(self):
        """Creates the shared taxonomy, location, and authenticated explorer."""

        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="discovery-feed-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Discovery",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(
            self.explorer,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Discovery Feed Cluster",
            CLUS_DESCRIPTION="Primary discovery feed cluster.",
        )
        self.other_cluster = Cluster.objects.create(
            CLUS_NAME="Other Discovery Feed Cluster",
            CLUS_DESCRIPTION="Secondary discovery feed cluster.",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Discovery Feed Category",
            CTGRY_DESCRIPTION="Primary discovery feed category.",
            CLUS_ID=self.cluster,
        )
        self.other_category = Category.objects.create(
            CTGRY_NAME="Other Discovery Feed Category",
            CTGRY_DESCRIPTION="Secondary discovery feed category.",
            CLUS_ID=self.other_cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Discovery Feed Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.active_tag = SpecialtyTag.objects.create(
            TAG_NAME="Discovery Active Tag",
            TAG_COLOR="blue",
        )
        self.inactive_tag = SpecialtyTag.objects.create(
            TAG_NAME="Discovery Inactive Tag",
            TAG_COLOR="green",
        )
        self.url = "/api/explorer/explore/discovery/"

    def _create_business(
        self,
        name,
        status=Business.BusinessStatus.ACTIVE,
        is_verified=False,
        category=None,
        created_at=None,
    ):
        """Creates a business with its own merchant account for a feed test."""

        owner = User.objects.create_user(
            email=f"owner-{name.lower().replace(' ', '-')}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        business = Business.objects.create(
            BUSN_NAME=name,
            BUSN_DESCRIPTION="A business used by the discovery feed tests.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status,
            BUSN_IS_VERIFIED=is_verified,
            USER_ID=owner,
            CTGRY_ID=category or self.category,
            LOCT_ID=self.location,
        )

        if created_at is not None:
            Business.objects.filter(
                BUSN_ID=business.BUSN_ID,
            ).update(
                BUSN_CREATED_AT=created_at,
            )
            business.BUSN_CREATED_AT = created_at

        return business

    def _create_score(
        self,
        business,
        discovery_score,
    ):
        """Creates the current aggregate score used by feed ordering."""

        return DiscoveryScore.objects.create(
            BUSN_ID=business,
            DSC_S_SCORE=discovery_score,
            DSC_V_SCORE=Decimal("0.00000"),
            DSC_D_SCORE=discovery_score,
            DSC_COMPUTED_AT=timezone.now(),
        )

    def _response_ids(self, response):
        """Returns business IDs from a paginated discovery response."""

        return [
            item["id"]
            for item in response.data["data"]["items"]
        ]

    def test_feed_only_returns_active_businesses_and_ignores_verification(self):
        """Active unverified businesses remain eligible while inactive ones do not."""

        active_unverified = self._create_business(
            "Active Unverified",
            is_verified=False,
        )
        inactive = self._create_business(
            "Inactive High Score",
            status=Business.BusinessStatus.SUSPENDED,
            is_verified=True,
        )
        self._create_score(
            inactive,
            Decimal("1.00000"),
        )

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self._response_ids(response),
            [active_unverified.BUSN_ID],
        )

    def test_feed_orders_positive_scores_and_keeps_missing_scores(self):
        """Missing scores use zero without removing the business from the feed."""

        high = self._create_business(
            "High Score",
        )
        missing = self._create_business(
            "Missing Score",
        )
        medium = self._create_business(
            "Medium Score",
        )
        self._create_score(
            high,
            Decimal("0.80000"),
        )
        self._create_score(
            medium,
            Decimal("0.30000"),
        )

        response = self.client.get(
            self.url,
        )

        self.assertEqual(
            self._response_ids(response),
            [
                high.BUSN_ID,
                medium.BUSN_ID,
                missing.BUSN_ID,
            ],
        )
        self.assertEqual(
            DiscoveryScore.objects.count(),
            2,
        )

    def test_equal_scores_use_creation_time_then_business_id(self):
        """Equal scores use the documented stable ordering tie-breakers."""

        older_time = timezone.now() - timedelta(days=2)
        shared_newer_time = timezone.now() - timedelta(days=1)
        older = self._create_business(
            "Older Equal Score",
            created_at=older_time,
        )
        first_id = self._create_business(
            "First Equal ID",
            created_at=shared_newer_time,
        )
        second_id = self._create_business(
            "Second Equal ID",
            created_at=shared_newer_time,
        )

        for business in (
            older,
            first_id,
            second_id,
        ):
            self._create_score(
                business,
                Decimal("0.50000"),
            )

        queryset = DiscoveryFeedService.list_discovery_businesses(
            user=self.explorer,
        )

        self.assertEqual(
            list(
                queryset.values_list(
                    "BUSN_ID",
                    flat=True,
                )
            ),
            [
                first_id.BUSN_ID,
                second_id.BUSN_ID,
                older.BUSN_ID,
            ],
        )

    def test_new_businesses_remains_newest_first_instead_of_score_order(self):
        """The chronological New Businesses contract remains unchanged."""

        older_high_score = self._create_business(
            "Older High Score",
            created_at=timezone.now() - timedelta(days=3),
        )
        newer_low_score = self._create_business(
            "Newer Low Score",
            created_at=timezone.now() - timedelta(days=1),
        )
        self._create_score(
            older_high_score,
            Decimal("0.90000"),
        )
        self._create_score(
            newer_low_score,
            Decimal("0.10000"),
        )

        new_business_ids = list(
            NewBusinessesService.list_new_businesses(
                self.explorer,
            ).values_list(
                "BUSN_ID",
                flat=True,
            )
        )
        discovery_ids = list(
            DiscoveryFeedService.list_discovery_businesses(
                self.explorer,
            ).values_list(
                "BUSN_ID",
                flat=True,
            )
        )

        self.assertEqual(
            new_business_ids,
            [
                newer_low_score.BUSN_ID,
                older_high_score.BUSN_ID,
            ],
        )
        self.assertEqual(
            discovery_ids,
            [
                older_high_score.BUSN_ID,
                newer_low_score.BUSN_ID,
            ],
        )

    def test_feed_serializes_only_active_specialties_and_interaction_state(self):
        """Feed cards preserve active specialties, Pocket, and vouch annotations."""

        business = self._create_business(
            "Interaction State",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=self.active_tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=self.inactive_tag,
            BST_IS_ACTIVE=False,
            BST_DEACTIVATED_AT=timezone.now(),
        )
        BusinessPocket.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=business,
        )
        BusinessVouch.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=business,
            TAG_ID=self.active_tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
        )

        response = self.client.get(
            self.url,
        )
        item = response.data["data"]["items"][0]

        self.assertTrue(
            item["is_pocketed"],
        )
        self.assertEqual(
            [
                specialty["id"]
                for specialty in item["specialty_tags"]
            ],
            [self.active_tag.TAG_ID],
        )
        self.assertTrue(
            item["specialty_tags"][0]["is_vouched"],
        )

    def test_category_and_cluster_filters_are_applied(self):
        """Category and cluster parameters restrict candidates before ordering."""

        primary = self._create_business(
            "Primary Taxonomy",
        )
        other = self._create_business(
            "Other Taxonomy",
            category=self.other_category,
        )

        category_response = self.client.get(
            self.url,
            {
                "category": self.category.CTGRY_ID,
            },
        )
        cluster_response = self.client.get(
            self.url,
            {
                "cluster": self.other_cluster.CLUS_ID,
            },
        )

        self.assertEqual(
            self._response_ids(category_response),
            [primary.BUSN_ID],
        )
        self.assertEqual(
            self._response_ids(cluster_response),
            [other.BUSN_ID],
        )

    def test_specialty_filter_only_matches_active_assignments(self):
        """Inactive specialty assignments never satisfy the feed filter."""

        active_match = self._create_business(
            "Active Specialty Match",
        )
        inactive_match = self._create_business(
            "Inactive Specialty Match",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=active_match,
            TAG_ID=self.active_tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=inactive_match,
            TAG_ID=self.active_tag,
            BST_IS_ACTIVE=False,
            BST_DEACTIVATED_AT=timezone.now(),
        )

        response = self.client.get(
            self.url,
            {
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [active_match.BUSN_ID],
        )

    def test_query_parameters_are_validated(self):
        """Invalid taxonomy identifiers return the standard validation response."""

        response = self.client.get(
            self.url,
            {
                "category": 0,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn(
            "category",
            response.data["errors"],
        )

    def test_pagination_uses_page_size_and_stable_order(self):
        """Standard pagination keeps deterministic results across feed pages."""

        shared_time = timezone.now() - timedelta(days=1)
        businesses = [
            self._create_business(
                f"Paginated Business {index}",
                created_at=shared_time,
            )
            for index in range(4)
        ]
        for business in businesses:
            self._create_score(
                business,
                Decimal("0.50000"),
            )

        first_response = self.client.get(
            self.url,
            {
                "page": 1,
                "page_size": 2,
            },
        )
        second_response = self.client.get(
            self.url,
            {
                "page": 2,
                "page_size": 2,
            },
        )

        expected_ids = [
            business.BUSN_ID
            for business in businesses
        ]
        actual_ids = (
            self._response_ids(first_response)
            + self._response_ids(second_response)
        )

        self.assertEqual(
            actual_ids,
            expected_ids,
        )
        self.assertEqual(
            first_response.data["data"]["pagination"]["page_size"],
            2,
        )
        self.assertEqual(
            first_response.data["data"]["pagination"]["total_items"],
            4,
        )

    def test_feed_does_not_use_mongo_or_recompute_scores(self):
        """A feed request only reads the current PostgreSQL score."""

        self._create_business(
            "Read Only Ranking",
        )

        with (
            patch.object(
                VisibilityEventService,
                "get_recent_visibility_metrics",
            ) as visibility_metrics,
            patch.object(
                DiscoveryScoreService,
                "recompute_business_scores",
            ) as recompute_scores,
        ):
            response = self.client.get(
                self.url,
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        visibility_metrics.assert_not_called()
        recompute_scores.assert_not_called()

    def test_feed_has_no_n_plus_one_query_regression(self):
        """Pagination, business rows, and specialties use three queries total."""

        for index in range(5):
            business = self._create_business(
                f"Query Count Business {index}",
            )
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
            )

        with self.assertNumQueries(3):
            response = self.client.get(
                self.url,
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            len(response.data["data"]["items"]),
            5,
        )
