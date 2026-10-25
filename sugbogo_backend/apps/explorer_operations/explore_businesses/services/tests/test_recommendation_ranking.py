from decimal import Decimal
from math import ceil
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import connection
from django.db.models import DecimalField, Value
from django.db.models.functions import Coalesce
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)
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
from apps.business.services.discovery_score_refresh_service import (
    DiscoveryScoreRefreshService,
)
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    RecommendationBusinessSerializer,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.explorer_operations.explore_businesses.services.recommendation_service import (
    RecommendationService,
    RelevanceGroup,
    classify_relevance,
    cosine_similarity,
)
from apps.explorer_operations.explore_businesses.services.taxonomy_filter_service import (
    business_matches_taxonomy,
)
from apps.users.models import User, UserCategoryInterest, UserSpecialtyTagInterest


@patch.object(
    VisibilityEventService,
    "get_profile_visit_business_ids",
    return_value=[],
)
class RecommendationRankingRegressionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.explorer = cls._create_user("explorer")
        cls.other_explorer = cls._create_user("other-explorer")
        cls.food = Cluster.objects.create(CLUS_NAME="Ranking Food")
        cls.outdoors = Cluster.objects.create(CLUS_NAME="Ranking Outdoors")
        cls.cafe = Category.objects.create(
            CTGRY_NAME="Ranking Cafe",
            CLUS_ID=cls.food,
        )
        cls.restaurant = Category.objects.create(
            CTGRY_NAME="Ranking Restaurant",
            CLUS_ID=cls.food,
        )
        cls.trail = Category.objects.create(
            CTGRY_NAME="Ranking Trail",
            CLUS_ID=cls.outdoors,
        )
        cls.coffee = SpecialtyTag.objects.create(TAG_NAME="Ranking Coffee")
        cls.hiking = SpecialtyTag.objects.create(TAG_NAME="Ranking Hiking")
        cls.location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Ranking Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )
        cls.businesses = {}
        specifications = [
            ("tie-first", cls.cafe, [cls.coffee], "0.8", "0.6"),
            ("tie-second", cls.cafe, [cls.coffee], "0.8", "0.6"),
            ("higher-gap", cls.cafe, [cls.coffee], "0.9", "0.1"),
            ("higher-score", cls.cafe, [cls.coffee], "0.8", "0.9"),
            ("category-only", cls.cafe, [], None, None),
            ("extra-tag", cls.cafe, [cls.coffee, cls.hiking], "0.5", "0.5"),
            ("cluster-only", cls.restaurant, [], "0.5", "0.5"),
            ("other-category", cls.restaurant, [cls.coffee], "0.5", "0.5"),
            ("other-cluster", cls.trail, [cls.coffee], "0.5", "0.5"),
            ("no-match", cls.trail, [cls.hiking], "1.0", "1.0"),
            ("missing-score", cls.cafe, [cls.coffee], None, None),
            ("zero-score", cls.cafe, [cls.coffee], "0.0", "0.0"),
            ("provisional", cls.cafe, [cls.coffee], "1.0", "0.2"),
            ("suspended", cls.cafe, [cls.coffee], "1.0", "1.0"),
        ]
        for name, category, tags, visibility_gap, discovery_score in specifications:
            owner = cls._create_user(
                name,
                role=User.UserRole.MERCHANT,
            )
            business = Business.objects.create(
                BUSN_NAME=name,
                BUSN_DESCRIPTION="Recommendation ranking regression fixture.",
                BUSN_CONTACT_NUMBER="09171234567",
                USER_ID=owner,
                CTGRY_ID=category,
                LOCT_ID=cls.location,
            )
            cls.businesses[name] = business
            for tag in tags:
                BusinessSpecialtyTag.objects.create(
                    BUSN_ID=business,
                    TAG_ID=tag,
                )
            if discovery_score is not None:
                DiscoveryScore.objects.create(
                    BUSN_ID=business,
                    DSC_S_SCORE=Decimal("0.50000"),
                    DSC_V_SCORE=Decimal(visibility_gap),
                    DSC_D_SCORE=Decimal(discovery_score),
                    DSC_IS_PROVISIONAL=name == "provisional",
                    DSC_COMPUTED_AT=timezone.now(),
                )
        Business.objects.filter(
            pk=cls.businesses["suspended"].pk,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.businesses["category-only"],
            TAG_ID=cls.coffee,
            BST_IS_ACTIVE=False,
        )

    @staticmethod
    def _create_user(
        name,
        role=User.UserRole.EXPLORER,
    ):
        return User.objects.create_user(
            email=f"ranking-{name}@example.com",
            password=None,
            USER_FNAME="Ranking",
            USER_LNAME="Fixture",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _set_interests(
        self,
        categories,
        tags,
        user=None,
    ):
        if user is None:
            user = self.explorer
        UserCategoryInterest.objects.filter(USER_ID=user).delete()
        UserSpecialtyTagInterest.objects.filter(USER_ID=user).delete()
        for category in categories:
            UserCategoryInterest.objects.create(
                USER_ID=user,
                CTGRY_ID=category,
            )
        for tag in tags:
            UserSpecialtyTagInterest.objects.create(
                USER_ID=user,
                TAG_ID=tag,
            )

    def _reference_recommendations(self):
        # Preserve the pre-optimization full-hydration, score, sort, reason path.
        configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )
        candidates = list(
            RecommendationService._candidate_queryset(self.explorer)
            .select_related("discovery_score")
            .annotate(
                recommendation_visibility_gap=Coalesce(
                    "discovery_score__DSC_V_SCORE",
                    Value(Decimal("1.00000")),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
                recommendation_discovery_score=Coalesce(
                    "discovery_score__DSC_D_SCORE",
                    DiscoveryScoreRefreshService.missing_score_expression(),
                    output_field=DecimalField(
                        max_digits=6,
                        decimal_places=5,
                    ),
                ),
            ),
        )
        features = RecommendationService.build_explorer_feature_map(
            self.explorer,
            candidates,
            configuration,
        )
        ranked = []
        for business in candidates:
            business_features = RecommendationService.build_business_feature_map(
                business,
                configuration,
            )
            similarity = cosine_similarity(features, business_features)
            group = classify_relevance(similarity, configuration)
            if group == RelevanceGroup.NO_MATCH:
                continue
            business.recommendation_reason = (
                RecommendationService.build_recommendation_reason(
                    features,
                    business,
                    business_features,
                )
            )
            ranked.append((business, group, similarity))
        ranked.sort(
            key=lambda item: (
                -int(item[1]),
                -item[2],
                -item[0].recommendation_visibility_gap,
                -item[0].recommendation_discovery_score,
                item[0].BUSN_ID,
            ),
        )
        return [
            business
            for business, _, _ in ranked
        ]

    def _assert_reference_matches(self):
        expected = self._reference_recommendations()
        actual = RecommendationService.list_recommendations(self.explorer)
        self.assertEqual(
            RecommendationBusinessSerializer(actual, many=True).data,
            RecommendationBusinessSerializer(expected, many=True).data,
        )
        return actual

    def test_exact_ranking_and_response_match_original_for_interest_combinations(
        self,
        _visits,
    ):
        combinations = [
            ([self.cafe], []),
            ([], [self.coffee]),
            ([self.cafe], [self.coffee]),
            ([self.cafe, self.trail], [self.coffee, self.hiking]),
        ]
        for categories, tags in combinations:
            with self.subTest(categories=categories, tags=tags):
                self._set_interests(categories, tags)
                actual = self._assert_reference_matches()
                self.assertNotIn(self.businesses["suspended"], actual)

        self._set_interests([self.cafe], [self.coffee])
        ranked = self._assert_reference_matches()
        self.assertEqual(
            [business.BUSN_NAME for business in ranked],
            [
                "missing-score",
                "provisional",
                "higher-gap",
                "higher-score",
                "tie-first",
                "tie-second",
                "zero-score",
                "extra-tag",
                "other-category",
                "other-cluster",
                "category-only",
                "cluster-only",
            ],
        )

    def test_interactions_and_repeated_visits_preserve_weighting_and_exclusions(
        self,
        visits,
    ):
        BusinessPocket.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.businesses["other-cluster"],
        )
        BusinessPocket.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.businesses["suspended"],
        )
        for name, valid, withdrawn in [
            ("no-match", True, None),
            ("extra-tag", False, None),
            ("suspended", True, timezone.now()),
        ]:
            BusinessVouch.objects.create(
                USER_ID=self.explorer,
                BUSN_ID=self.businesses[name],
                TAG_ID=self.hiking,
                VOUCH_EVIDENCE_IS_VALID=valid,
                VOUCH_WITHDRAWN_AT=withdrawn,
                VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
            )
        visits.return_value = [
            self.businesses["tie-first"].pk,
            self.businesses["tie-first"].pk,
            self.businesses["suspended"].pk,
            99999999,
        ]
        ranking = RecommendationService.get_recommendation_ranking(self.explorer)
        self.assertEqual(
            ranking.explorer_features,
            {
                ("cluster", self.outdoors.pk): Decimal("3.00000"),
                ("category", self.trail.pk): Decimal("6.00000"),
                ("tag", self.coffee.pk): Decimal("15.00000"),
                ("tag", self.hiking.pk): Decimal("9.00000"),
                ("cluster", self.food.pk): Decimal("2.00000"),
                ("category", self.cafe.pk): Decimal("4.00000"),
            },
        )
        self._assert_reference_matches()
        visits.assert_called_with(explorer_id=self.explorer.pk)

    def test_configured_missing_score_fallback_and_zero_weights_match_original(
        self,
        _visits,
    ):
        self._set_interests([self.cafe], [self.coffee])
        DiscoveryAlgorithmConfiguration.objects.update_or_create(
            pk=1,
            defaults={
                "DAC_SPECIALTY_SCORE_WEIGHT": Decimal("0.75000"),
                "DAC_VISIBILITY_GAP_WEIGHT": Decimal("0.25000"),
            },
        )
        actual = self._assert_reference_matches()
        self.assertEqual(actual[0].BUSN_NAME, "missing-score")
        self.assertEqual(
            actual[0].recommendation_discovery_score,
            Decimal("0.25000"),
        )
        self.configuration.RAC_CLUSTER_WEIGHT = Decimal("0.00000")
        self.configuration.RAC_SPECIALTY_TAG_WEIGHT = Decimal("0.00000")
        self.configuration.save()
        self._assert_reference_matches()

    def test_lightweight_ranking_and_page_hydration_have_bounded_query_work(
        self,
        _visits,
    ):
        self._set_interests([self.cafe], [self.coffee])
        original_from_db = Business.from_db
        full_hydration_ids = []

        def capture_hydration(
            db,
            field_names,
            values,
        ):
            business = original_from_db(db, field_names, values)
            if "BUSN_NAME" in field_names:
                full_hydration_ids.append(business.BUSN_ID)
            return business

        with (
            patch.object(Business, "from_db", side_effect=capture_hydration),
            CaptureQueriesContext(connection) as original_queries,
        ):
            expected = self._reference_recommendations()
        self.assertEqual(len(full_hydration_ids), 13)
        self.assertEqual(len(original_queries), 9)
        full_hydration_ids.clear()

        with (
            patch.object(Business, "from_db", side_effect=capture_hydration),
            CaptureQueriesContext(connection) as optimized_queries,
        ):
            ranking = RecommendationService.get_recommendation_ranking(self.explorer)
            self.assertEqual(full_hydration_ids, [])
            selected = ranking.businesses[3:6]
            page = RecommendationService.hydrate_recommendations(
                user=self.explorer,
                businesses=selected,
                ranking=ranking,
            )
        self.assertEqual(len(optimized_queries), 11)
        self.assertCountEqual(
            full_hydration_ids,
            [business.pk for business in expected[3:6]],
        )
        self.assertEqual(
            [business.pk for business in page],
            [business.pk for business in expected[3:6]],
        )
        for candidate in ranking.businesses:
            self.assertIn("BUSN_NAME", candidate.get_deferred_fields())
            self.assertIn("CTGRY_NAME", candidate.CTGRY_ID.get_deferred_fields())
            self.assertNotIn("LOCT_ID", candidate._state.fields_cache)
            self.assertNotIn("review_summary", candidate._state.fields_cache)
            self.assertFalse(hasattr(candidate, "is_pocketed"))
            for link in candidate.active_specialty_tag_links:
                self.assertNotIn("TAG_ID", link._state.fields_cache)
                self.assertFalse(hasattr(link, "is_vouched"))
        # Serialization adds the existing one-per-response Hidden Gem lookup only.
        with self.assertNumQueries(1):
            payload = RecommendationBusinessSerializer(page, many=True).data
        self.assertEqual(len(payload), 3)

    def test_reason_uses_current_page_tags_if_taxonomy_changes_after_ranking(
        self,
        _visits,
    ):
        self._set_interests([self.cafe], [self.coffee])
        ranking = RecommendationService.get_recommendation_ranking(self.explorer)
        selected = [
            business
            for business in ranking.businesses
            if business.pk == self.businesses["tie-first"].pk
        ]
        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.businesses["tie-first"],
            TAG_ID=self.coffee,
        ).update(BST_IS_ACTIVE=False)

        page = RecommendationService.hydrate_recommendations(
            user=self.explorer,
            businesses=selected,
            ranking=ranking,
        )

        self.assertEqual(
            page[0].recommendation_reason,
            {
                "type": "category",
                "id": self.cafe.pk,
                "label": self.cafe.CTGRY_NAME,
            },
        )
        self.assertEqual(page[0].active_specialty_tag_links, [])

    def test_first_middle_final_pages_match_global_order_and_metadata(
        self,
        _visits,
    ):
        self._set_interests([self.cafe], [self.coffee])
        expected = self._reference_recommendations()
        expected_items = RecommendationBusinessSerializer(expected, many=True).data
        client = APIClient()
        client.force_authenticate(self.explorer)
        page_size = 5
        total_pages = ceil(len(expected) / page_size)
        all_ids = []
        for page_number in range(1, total_pages + 1):
            start = (page_number - 1) * page_size
            with patch.object(
                RecommendationService,
                "hydrate_recommendations",
                wraps=RecommendationService.hydrate_recommendations,
            ) as hydrate:
                response = client.get(
                    "/api/explorer/explore/recommendations/",
                    {"page": page_number, "page_size": page_size},
                )
            self.assertEqual(response.status_code, 200)
            data = response.data["data"]
            self.assertEqual(data["items"], expected_items[start:start + page_size])
            self.assertIs(data["is_personalized"], True)
            self.assertEqual(
                data["pagination"],
                {
                    "page": page_number,
                    "page_size": page_size,
                    "total_items": len(expected),
                    "total_pages": total_pages,
                    "has_next": page_number < total_pages,
                    "has_previous": page_number > 1,
                },
            )
            self.assertEqual(
                [business.pk for business in hydrate.call_args.kwargs["businesses"]],
                [business.pk for business in expected[start:start + page_size]],
            )
            all_ids.extend(item["id"] for item in data["items"])
        self.assertEqual(all_ids, [business.pk for business in expected])
        self.assertEqual(len(set(all_ids)), len(expected))
        with patch.object(RecommendationService, "hydrate_recommendations") as hydrate:
            response = client.get(
                "/api/explorer/explore/recommendations/",
                {"page": total_pages + 1, "page_size": page_size},
            )
        self.assertEqual(response.status_code, 404)
        hydrate.assert_not_called()

    def test_page_flags_are_account_specific_and_serialization_has_no_n_plus_one(
        self,
        _visits,
    ):
        self._set_interests([self.cafe], [self.coffee])
        self._set_interests([self.cafe], [self.coffee], user=self.other_explorer)
        business = self.businesses["tie-first"]
        BusinessPocket.objects.create(USER_ID=self.explorer, BUSN_ID=business)
        BusinessVouch.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=business,
            TAG_ID=self.coffee,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
        )
        for user, expected_flag in [
            (self.explorer, True),
            (self.other_explorer, False),
        ]:
            ranking = RecommendationService.get_recommendation_ranking(user)
            for page_size in [1, len(ranking.businesses)]:
                selected = ranking.businesses[:page_size]
                with self.assertNumQueries(2):
                    page = RecommendationService.hydrate_recommendations(
                        user=user,
                        businesses=selected,
                        ranking=ranking,
                    )
                with self.assertNumQueries(1):
                    items = RecommendationBusinessSerializer(page, many=True).data
                for item in items:
                    is_users_business = item["id"] == business.pk
                    expected = expected_flag and is_users_business
                    self.assertIs(item["is_pocketed"], expected)
                    for tag in item["specialty_tags"]:
                        self.assertIs(tag["is_vouched"], expected)

    def test_filtered_interests_page_retains_full_personalization_inputs(
        self,
        visits,
    ):
        self._set_interests([self.cafe], [self.coffee])
        # This learned signal must still count outside the requested category.
        visits.return_value = [self.businesses["other-cluster"].pk] * 3
        expected = [
            business
            for business in self._reference_recommendations()
            if business_matches_taxonomy(
                business,
                category_ids=[self.cafe.pk],
                cluster_id=self.food.pk,
                specialty_tag_id=self.coffee.pk,
            )
        ]
        client = APIClient()
        client.force_authenticate(self.explorer)
        with patch.object(
            RecommendationService,
            "hydrate_recommendations",
            wraps=RecommendationService.hydrate_recommendations,
        ) as hydrate:
            response = client.get(
                "/api/explorer/explore/collections/interests/",
                {
                    "category": self.cafe.pk,
                    "cluster": self.food.pk,
                    "specialty_tag": self.coffee.pk,
                    "page": 2,
                    "page_size": 2,
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [business.pk for business in expected[2:4]],
        )
        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            len(expected),
        )
        self.assertEqual(len(hydrate.call_args.kwargs["businesses"]), 2)
        self.assertEqual(
            RecommendationService.list_recommendation_collection(
                user=self.explorer,
                category_ids=[self.cafe.pk],
                cluster_id=self.food.pk,
                specialty_tag_id=self.coffee.pk,
            ),
            expected,
        )

    def test_cold_start_keeps_discovery_pagination_and_empty_matches_stay_personalized(
        self,
        _visits,
    ):
        client = APIClient()
        client.force_authenticate(self.explorer)
        expected = list(DiscoveryFeedService.list_discovery_businesses(self.explorer))
        response = client.get(
            "/api/explorer/explore/recommendations/",
            {"page": 2, "page_size": 5},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.data["data"]["is_personalized"], False)
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [business.pk for business in expected[5:10]],
        )
        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            len(expected),
        )
        self._set_interests([], [SpecialtyTag.objects.create(TAG_NAME="Unmatched")])
        with patch.object(RecommendationService, "_candidate_queryset") as hydrate:
            response = client.get("/api/explorer/explore/recommendations/")
        hydrate.assert_not_called()
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.data["data"]["is_personalized"], True)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
        self.assertEqual(response.data["data"]["pagination"]["total_pages"], 0)
