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
        self.assertEqual(
            item["specialty_tags"][0]["icon"],
            self.active_tag.TAG_ICON,
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

    def test_search_trims_whitespace_and_whitespace_only_is_absent(self):
        """Search is normalized before matching and blank input keeps the feed."""

        match = self._create_business(
            "Coffee Corner",
        )
        other = self._create_business(
            "Island Crafts",
        )

        trimmed_response = self.client.get(
            self.url,
            {
                "search": "  Coffee  ",
            },
        )
        blank_response = self.client.get(
            self.url,
            {
                "search": "   ",
            },
        )

        self.assertEqual(
            self._response_ids(trimmed_response),
            [match.BUSN_ID],
        )
        self.assertCountEqual(
            self._response_ids(blank_response),
            [
                match.BUSN_ID,
                other.BUSN_ID,
            ],
        )

    def test_search_orders_exact_prefix_contains_then_taxonomy(self):
        """PostgreSQL relevance tiers precede all score-based ordering."""

        taxonomy_category = Category.objects.create(
            CTGRY_NAME="Coffee Experiences",
            CLUS_ID=self.cluster,
        )
        exact = self._create_business(
            "Coffee",
        )
        prefix = self._create_business(
            "Coffee Corner",
        )
        contains = self._create_business(
            "Local Coffee House",
        )
        taxonomy = self._create_business(
            "Morning Place",
            category=taxonomy_category,
        )

        response = self.client.get(
            self.url,
            {
                "search": "coffee",
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                exact.BUSN_ID,
                prefix.BUSN_ID,
                contains.BUSN_ID,
                taxonomy.BUSN_ID,
            ],
        )

    def test_search_matches_cluster_and_active_specialty_but_not_inactive(self):
        """Taxonomy search includes only active specialty assignments."""

        cluster_match = self._create_business(
            "Cluster Result",
            category=self.other_category,
        )
        specialty_match = self._create_business(
            "Specialty Result",
        )
        inactive_match = self._create_business(
            "Inactive Result",
        )
        search_tag = SpecialtyTag.objects.create(
            TAG_NAME="Needlework",
            TAG_COLOR="purple",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=specialty_match,
            TAG_ID=search_tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=inactive_match,
            TAG_ID=search_tag,
            BST_IS_ACTIVE=False,
            BST_DEACTIVATED_AT=timezone.now(),
        )

        cluster_response = self.client.get(
            self.url,
            {
                "search": "Other Discovery Feed Cluster",
            },
        )
        specialty_response = self.client.get(
            self.url,
            {
                "search": "Needlework",
            },
        )

        self.assertEqual(
            self._response_ids(cluster_response),
            [cluster_match.BUSN_ID],
        )
        self.assertEqual(
            self._response_ids(specialty_response),
            [specialty_match.BUSN_ID],
        )

    def test_discovery_score_orders_businesses_within_equal_search_tier(self):
        """Discovery score is the secondary key within a relevance tier."""

        low = self._create_business(
            "Coffee Low",
        )
        high = self._create_business(
            "Coffee High",
        )
        self._create_score(
            low,
            Decimal("0.10000"),
        )
        self._create_score(
            high,
            Decimal("0.90000"),
        )

        response = self.client.get(
            self.url,
            {
                "search": "Coffee",
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                high.BUSN_ID,
                low.BUSN_ID,
            ],
        )

    def test_multiple_categories_use_or_and_combine_with_cluster(self):
        """Repeated categories use OR while the cluster group uses AND."""

        same_cluster_category = Category.objects.create(
            CTGRY_NAME="Second Category",
            CLUS_ID=self.cluster,
        )
        first = self._create_business(
            "First Category Result",
        )
        second = self._create_business(
            "Second Category Result",
            category=same_cluster_category,
        )
        outside_cluster = self._create_business(
            "Outside Cluster Result",
            category=self.other_category,
        )

        response = self.client.get(
            self.url,
            [
                ("category", self.category.CTGRY_ID),
                ("category", same_cluster_category.CTGRY_ID),
                ("category", self.other_category.CTGRY_ID),
                ("cluster", self.cluster.CLUS_ID),
            ],
        )

        self.assertCountEqual(
            self._response_ids(response),
            [
                first.BUSN_ID,
                second.BUSN_ID,
            ],
        )
        self.assertNotIn(
            outside_cluster.BUSN_ID,
            self._response_ids(response),
        )

    def test_selected_specialty_uses_exact_tag_score_and_keeps_zero(self):
        """An explicitly selected tag ranks its active links including zero."""

        high = self._create_business(
            "High Tag Score",
        )
        zero = self._create_business(
            "Zero Tag Score",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=high,
            TAG_ID=self.active_tag,
            BST_TAG_SCORE=Decimal("0.80000"),
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=zero,
            TAG_ID=self.active_tag,
        )
        self._create_score(
            zero,
            Decimal("1.00000"),
        )

        response = self.client.get(
            self.url,
            {
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                high.BUSN_ID,
                zero.BUSN_ID,
            ],
        )

    def test_equal_selected_tag_score_uses_discovery_score(self):
        """Discovery score breaks ties for the explicitly selected tag."""

        low_discovery = self._create_business(
            "Equal Tag Low Discovery",
        )
        high_discovery = self._create_business(
            "Equal Tag High Discovery",
        )
        for business in (
            low_discovery,
            high_discovery,
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=Decimal("0.50000"),
            )
        self._create_score(
            low_discovery,
            Decimal("0.10000"),
        )
        self._create_score(
            high_discovery,
            Decimal("0.90000"),
        )

        response = self.client.get(
            self.url,
            {
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                high_discovery.BUSN_ID,
                low_discovery.BUSN_ID,
            ],
        )

    def test_equal_specialty_and_discovery_scores_use_created_at(self):
        """Newer businesses break equal selected-tag and discovery scores."""

        newer = self._create_business(
            "Equal Scores Newer",
            created_at=timezone.now(),
        )
        older = self._create_business(
            "Equal Scores Older",
            created_at=timezone.now() - timedelta(days=1),
        )
        for business in (
            newer,
            older,
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=Decimal("0.50000"),
            )
            self._create_score(
                business,
                Decimal("0.50000"),
            )

        response = self.client.get(
            self.url,
            {
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                newer.BUSN_ID,
                older.BUSN_ID,
            ],
        )

    def test_equal_specialty_discovery_and_created_at_use_lower_id(self):
        """Lower business ID is the final deterministic specialty tie-break."""

        shared_time = timezone.now() - timedelta(days=1)
        lower_id = self._create_business(
            "Equal Everything Lower ID",
            created_at=shared_time,
        )
        higher_id = self._create_business(
            "Equal Everything Higher ID",
            created_at=shared_time,
        )
        for business in (
            lower_id,
            higher_id,
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=Decimal("0.50000"),
            )
            self._create_score(
                business,
                Decimal("0.50000"),
            )

        response = self.client.get(
            self.url,
            {
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                lower_id.BUSN_ID,
                higher_id.BUSN_ID,
            ],
        )

    def test_search_and_specialty_order_relevance_before_tag_score(self):
        """Combined intent ranks relevance, exact tag score, then discovery."""

        exact = self._create_business(
            "Coffee",
        )
        prefix = self._create_business(
            "Coffee Roasters",
        )
        for business, score in (
            (exact, Decimal("0.10000")),
            (prefix, Decimal("0.90000")),
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=score,
            )

        response = self.client.get(
            self.url,
            {
                "search": "Coffee",
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                exact.BUSN_ID,
                prefix.BUSN_ID,
            ],
        )

    def test_equal_search_relevance_uses_tag_score_before_discovery(self):
        """Selected TagScore precedes discovery within one relevance tier."""

        high_discovery = self._create_business(
            "Coffee High Discovery",
        )
        high_tag = self._create_business(
            "Coffee High Tag",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=high_discovery,
            TAG_ID=self.active_tag,
            BST_TAG_SCORE=Decimal("0.10000"),
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=high_tag,
            TAG_ID=self.active_tag,
            BST_TAG_SCORE=Decimal("0.90000"),
        )
        self._create_score(
            high_discovery,
            Decimal("0.90000"),
        )
        self._create_score(
            high_tag,
            Decimal("0.10000"),
        )

        response = self.client.get(
            self.url,
            {
                "search": "Coffee",
                "specialty_tag": self.active_tag.TAG_ID,
            },
        )

        self.assertEqual(
            self._response_ids(response),
            [
                high_tag.BUSN_ID,
                high_discovery.BUSN_ID,
            ],
        )

    def test_normal_matches_never_expand_to_fuzzy_candidates(self):
        """Exact, prefix, substring, and taxonomy hits bypass fuzzy scoring entirely."""

        category = Category.objects.create(
            CTGRY_NAME="Coffee Roastery",
            CLUS_ID=self.cluster,
        )
        normal_businesses = [
            self._create_business("Coffee"),
            self._create_business("Coffee Corner"),
            self._create_business("Local Coffee House"),
            self._create_business("Morning Place", category=category),
        ]
        self._create_business("Cofee Garden")

        for query in ("Coffee", "Coffe", "offee", "Roastery"):
            with (
                self.subTest(query=query),
                patch.object(
                    DiscoveryFeedService,
                    "_fuzzy_search_businesses",
                ) as fuzzy_search,
            ):
                response = self.client.get(
                    self.url,
                    {"search": query},
                )

                expected = normal_businesses

                if query == "Roastery":
                    expected = [normal_businesses[-1]]

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertCountEqual(
                    self._response_ids(response),
                    [business.BUSN_ID for business in expected],
                )
                fuzzy_search.assert_not_called()

    def test_fuzzy_fallback_recovers_misspellings_inside_long_business_names(self):
        """Word-aware similarity recovers typos inside longer business names."""

        examples = (
            ("cofee", "Cebu Coffee Collective"),
            ("barbrshop", "Neighborhood Barbershop Studio"),
            ("restarant", "Family Restaurant Kitchen"),
            ("lechonn", "Traditional Lechon House"),
        )
        businesses = {
            query: self._create_business(name)
            for query, name in examples
        }

        for query, business in businesses.items():
            with self.subTest(query=query):
                response = self.client.get(
                    self.url,
                    {"search": f"  {query}  "},
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    self._response_ids(response),
                    [business.BUSN_ID],
                )

    def test_short_queries_do_not_attempt_fuzzy_fallback(self):
        """Queries below four characters retain the existing literal search behavior."""

        self._create_business("Coffee")

        for query in ("c", "co", "cfe"):
            with (
                self.subTest(query=query),
                patch.object(
                    DiscoveryFeedService,
                    "_fuzzy_search_businesses",
                ) as fuzzy_search,
            ):
                response = self.client.get(
                    self.url,
                    {"search": query},
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                fuzzy_search.assert_not_called()

                if query == "cfe":
                    self.assertEqual(self._response_ids(response), [])

    def test_four_character_fallback_rejects_low_confidence_matches(self):
        """Four-character typos require stronger similarity than longer queries."""

        self._create_business("Coffee")
        queryset = DiscoveryFeedService.list_discovery_businesses(
            user=self.explorer,
            search="cofe",
        )

        self.assertIn("search_similarity", queryset.query.annotations)
        self.assertEqual(list(queryset), [])

    def test_weak_unrelated_queries_return_no_businesses(self):
        """Weak queries do not return arbitrary popular businesses."""

        business = self._create_business("Cebu Coffee House")
        self._create_business("Lechon Kitchen")
        self._create_score(business, Decimal("1.00000"))

        for query in ("zzzzzz", "copper", "qwerty"):
            with self.subTest(query=query):
                response = self.client.get(
                    self.url,
                    {"search": query},
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(self._response_ids(response), [])

    def test_fuzzy_fallback_preserves_eligibility_and_each_taxonomy_filter(self):
        """Out-of-scope normal hits cannot block or escape a filtered fuzzy search."""

        intended = self._create_business("Central Coffee Collective")
        self._create_business(
            "Outside Coffee House",
            category=self.other_category,
        )
        self._create_business(
            "Cofee Literal Outside",
            category=self.other_category,
        )
        self._create_business(
            "Cofee Suspended",
            status=Business.BusinessStatus.SUSPENDED,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=intended,
            TAG_ID=self.active_tag,
        )

        filters = (
            {"category": self.category.CTGRY_ID},
            {"cluster": self.cluster.CLUS_ID},
            {"specialty_tag": self.active_tag.TAG_ID},
        )

        for criteria in filters:
            with self.subTest(criteria=criteria):
                response = self.client.get(
                    self.url,
                    {"search": "cofee", **criteria},
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    self._response_ids(response),
                    [intended.BUSN_ID],
                )

    def test_fuzzy_taxonomy_uses_category_and_only_active_specialty_labels(self):
        """Active taxonomy labels match without duplicating business results."""

        category = Category.objects.create(
            CTGRY_NAME="Coffee Roastery",
            CLUS_ID=self.cluster,
        )
        category_match = self._create_business(
            "Morning Kitchen",
            category=category,
        )
        specialty_match = self._create_business("Neighborhood Gathering")
        inactive_match = self._create_business("Retired Workshop")

        for name in ("Coffee Tasting", "Coffee Brewing"):
            tag = SpecialtyTag.objects.create(TAG_NAME=name)
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=specialty_match,
                TAG_ID=tag,
            )
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=inactive_match,
                TAG_ID=tag,
                BST_IS_ACTIVE=False,
                BST_DEACTIVATED_AT=timezone.now(),
            )

        response = self.client.get(self.url, {"search": "cofee"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertCountEqual(
            self._response_ids(response),
            [category_match.BUSN_ID, specialty_match.BUSN_ID],
        )
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 2)

    def test_fuzzy_search_ignores_cluster_names_and_descriptions(self):
        """Broad clusters and descriptive fields never expand fuzzy candidates."""

        cluster = Cluster.objects.create(CLUS_NAME="Coffee District")
        category = Category.objects.create(
            CTGRY_NAME="Hardware",
            CTGRY_DESCRIPTION="Coffee",
            CLUS_ID=cluster,
        )
        business = self._create_business("Tools Workshop", category=category)
        Business.objects.filter(
            pk=business.pk,
        ).update(
            BUSN_DESCRIPTION="Coffee",
        )

        response = self.client.get(self.url, {"search": "cofee"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._response_ids(response), [])

    def test_fuzzy_similarity_precedes_selected_tag_and_discovery_scores(self):
        """Stronger text similarity precedes specialty and discovery scores."""

        stronger = self._create_business("Central Coffee")
        weaker = self._create_business("Central Cofe")

        for business, score in (
            (stronger, Decimal("0.10000")),
            (weaker, Decimal("0.90000")),
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=score,
            )
            self._create_score(business, score)

        similarities = dict(
            DiscoveryFeedService.list_discovery_businesses(
                user=self.explorer,
                search="cofee",
                specialty_tag_id=self.active_tag.TAG_ID,
            ).values_list(
                "BUSN_ID",
                "search_similarity",
            ),
        )
        self.assertGreater(
            similarities[stronger.BUSN_ID],
            similarities[weaker.BUSN_ID],
        )

        response = self.client.get(
            self.url,
            {"search": "cofee", "specialty_tag": self.active_tag.TAG_ID},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._response_ids(response),
            [stronger.BUSN_ID, weaker.BUSN_ID],
        )

    def test_equal_fuzzy_similarity_orders_tag_score_then_discovery(self):
        """Equal text confidence retains tag-score then Discovery Score ordering."""

        high_tag = self._create_business("North Coffee")
        high_discovery = self._create_business("South Coffee")
        low_discovery = self._create_business("East Coffee")

        for business, tag_score, discovery_score in (
            (high_tag, Decimal("0.90000"), Decimal("0.10000")),
            (high_discovery, Decimal("0.50000"), Decimal("0.90000")),
            (low_discovery, Decimal("0.50000"), Decimal("0.10000")),
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=tag_score,
            )
            self._create_score(business, discovery_score)

        response = self.client.get(
            self.url,
            {"search": "cofee", "specialty_tag": self.active_tag.TAG_ID},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._response_ids(response),
            [high_tag.BUSN_ID, high_discovery.BUSN_ID, low_discovery.BUSN_ID],
        )

    def test_equal_fuzzy_similarity_without_specialty_uses_discovery_score(self):
        """Discovery Score breaks similarity ties without a selected specialty."""

        low = self._create_business("North Coffee")
        high = self._create_business("South Coffee")
        self._create_score(low, Decimal("0.10000"))
        self._create_score(high, Decimal("0.90000"))

        response = self.client.get(self.url, {"search": "cofee"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._response_ids(response), [high.BUSN_ID, low.BUSN_ID])

    def test_fuzzy_ordering_retains_creation_time_and_id_tie_breakers(self):
        """Equal fuzzy and numeric scores retain newest-first and lower-ID ordering."""

        shared_time = timezone.now() - timedelta(days=1)
        older_low_id = self._create_business(
            "North Coffee",
            created_at=shared_time,
        )
        older_high_id = self._create_business(
            "South Coffee",
            created_at=shared_time,
        )
        newer = self._create_business(
            "East Coffee",
            created_at=timezone.now(),
        )

        for business in (older_low_id, older_high_id, newer):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=self.active_tag,
                BST_TAG_SCORE=Decimal("0.50000"),
            )
            self._create_score(business, Decimal("0.50000"))

        response = self.client.get(
            self.url,
            {"search": "cofee", "specialty_tag": self.active_tag.TAG_ID},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._response_ids(response),
            [newer.BUSN_ID, older_low_id.BUSN_ID, older_high_id.BUSN_ID],
        )

    def test_normal_match_decision_is_independent_of_requested_page(self):
        """A later or invalid page cannot activate fuzzy expansion of normal results."""

        self._create_business("Coffee North")
        self._create_business("Coffee South")
        self._create_business("Cofee Garden")

        with patch.object(
            DiscoveryFeedService,
            "_fuzzy_search_businesses",
        ) as fuzzy_search:
            second_page = self.client.get(
                self.url,
                {"search": "Coffee", "page_size": 1, "page": 2},
            )
            missing_page = self.client.get(
                self.url,
                {"search": "Coffee", "page_size": 1, "page": 3},
            )

        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        self.assertEqual(second_page.data["data"]["pagination"]["total_items"], 2)
        self.assertEqual(missing_page.status_code, status.HTTP_404_NOT_FOUND)
        fuzzy_search.assert_not_called()

    def test_fuzzy_results_paginate_without_changing_membership(self):
        """Each fallback page uses the same eligible candidate set and stable order."""

        businesses = [
            self._create_business("North Coffee"),
            self._create_business("South Coffee"),
            self._create_business("East Coffee"),
        ]
        actual_ids = []

        for page in (1, 2, 3):
            response = self.client.get(
                self.url,
                {"search": "cofee", "page_size": 1, "page": page},
            )

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 3)
            actual_ids.extend(self._response_ids(response))

        self.assertEqual(
            actual_ids,
            [business.BUSN_ID for business in reversed(businesses)],
        )

    def test_filter_options_returns_authoritative_taxonomy(self):
        """The Explorer filter endpoint exposes shared taxonomy identifiers."""

        response = self.client.get(
            "/api/explorer/explore/filter-options/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertIn(
            {
                "id": self.cluster.CLUS_ID,
                "name": self.cluster.CLUS_NAME,
                "icon": self.cluster.CLUS_ICON,
            },
            response.data["data"]["clusters"],
        )
        self.assertIn(
            {
                "id": self.category.CTGRY_ID,
                "name": self.category.CTGRY_NAME,
                "cluster_id": self.cluster.CLUS_ID,
            },
            response.data["data"]["categories"],
        )
        self.assertTrue(
            any(
                specialty["id"] == self.active_tag.TAG_ID
                for specialty in response.data["data"]["specialty_tags"]
            ),
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
