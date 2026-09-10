from decimal import Decimal
from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.explorer_operations.explore_businesses.services.recommendation_service import (
    RelevanceGroup,
    classify_relevance,
    cosine_similarity,
    recommendation_sort_key,
)


class CosineSimilarityTests(SimpleTestCase):
    def test_identical_sparse_maps_equal_one(self):
        features = {
            ("cluster", 1): Decimal("1"),
            ("tag", 90): Decimal("3"),
        }

        self.assertAlmostEqual(
            cosine_similarity(features, features),
            1.0,
        )

    def test_disjoint_and_empty_maps_equal_zero(self):
        self.assertEqual(
            cosine_similarity(
                {("tag", 1): Decimal("3")},
                {("tag", 2): Decimal("3")},
            ),
            0.0,
        )
        self.assertEqual(
            cosine_similarity({}, {("tag", 1): Decimal("3")}),
            0.0,
        )
        self.assertEqual(
            cosine_similarity({("tag", 1): Decimal("3")}, {}),
            0.0,
        )

    def test_partial_dynamic_maps_are_symmetric_and_deterministic(self):
        first = {
            ("category", 812): Decimal("2"),
            ("tag", 9123): Decimal("3"),
        }
        second = {
            ("cluster", 42): Decimal("1"),
            ("tag", 9123): Decimal("3"),
        }

        result = cosine_similarity(first, second)

        self.assertGreater(result, 0)
        self.assertLess(result, 1)
        self.assertEqual(result, cosine_similarity(second, first))
        self.assertEqual(result, cosine_similarity(first, second))


class RelevanceGroupTests(SimpleTestCase):
    def setUp(self):
        self.configuration = SimpleNamespace(
            RAC_HIGH_MATCH_THRESHOLD=Decimal("0.70000"),
            RAC_MODERATE_MATCH_THRESHOLD=Decimal("0.40000"),
        )

    def test_default_boundaries(self):
        cases = (
            (0.70, RelevanceGroup.HIGH),
            (0.71, RelevanceGroup.HIGH),
            (0.40, RelevanceGroup.MODERATE),
            (0.69999, RelevanceGroup.MODERATE),
            (0.01, RelevanceGroup.LOW),
            (0.0, RelevanceGroup.NO_MATCH),
        )

        for similarity, expected_group in cases:
            with self.subTest(similarity=similarity):
                self.assertEqual(
                    classify_relevance(
                        similarity,
                        self.configuration,
                    ),
                    expected_group,
                )

    def test_configured_boundaries_are_used(self):
        configuration = SimpleNamespace(
            RAC_HIGH_MATCH_THRESHOLD=Decimal("0.80000"),
            RAC_MODERATE_MATCH_THRESHOLD=Decimal("0.20000"),
        )

        self.assertEqual(
            classify_relevance(0.70, configuration),
            RelevanceGroup.MODERATE,
        )


class RecommendationRankingTests(SimpleTestCase):
    @staticmethod
    def _item(
        business_id,
        group,
        visibility_gap,
        similarity,
        discovery_score,
    ):
        business = SimpleNamespace(
            BUSN_ID=business_id,
            recommendation_visibility_gap=Decimal(visibility_gap),
            recommendation_discovery_score=Decimal(discovery_score),
        )

        return (
            business,
            group,
            similarity,
        )

    def test_group_precedes_visibility_gap(self):
        high = self._item(
            1,
            RelevanceGroup.HIGH,
            "0.10000",
            0.70,
            "0.10000",
        )
        moderate = self._item(
            2,
            RelevanceGroup.MODERATE,
            "1.00000",
            0.69,
            "1.00000",
        )
        low = self._item(
            3,
            RelevanceGroup.LOW,
            "1.00000",
            0.39,
            "1.00000",
        )

        ranked = sorted(
            [low, moderate, high],
            key=recommendation_sort_key,
        )

        self.assertEqual(
            [item[0].BUSN_ID for item in ranked],
            [1, 2, 3],
        )

    def test_all_tie_breakers_are_applied_in_order(self):
        items = [
            self._item(5, RelevanceGroup.HIGH, "0.8", 0.8, "0.8"),
            self._item(4, RelevanceGroup.HIGH, "0.8", 0.8, "0.8"),
            self._item(3, RelevanceGroup.HIGH, "0.8", 0.8, "0.9"),
            self._item(2, RelevanceGroup.HIGH, "0.8", 0.9, "0.1"),
            self._item(1, RelevanceGroup.HIGH, "0.9", 0.7, "0.1"),
        ]

        ranked = sorted(
            items,
            key=recommendation_sort_key,
        )

        self.assertEqual(
            [item[0].BUSN_ID for item in ranked],
            [1, 2, 3, 4, 5],
        )
