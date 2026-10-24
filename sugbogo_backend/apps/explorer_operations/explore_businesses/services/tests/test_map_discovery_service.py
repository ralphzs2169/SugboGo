from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.business.models import Business, Category, DiscoveryScore
from apps.business.services.discovery_score_service import DiscoveryScoreService

from ..discovery_feed_service import DiscoveryFeedService
from ..map_discovery_service import MapDiscoveryService
from .map_discovery_test_mixin import MapDiscoveryTestMixin


class MapDiscoveryServiceTests(MapDiscoveryTestMixin, TestCase):
    """Exercise real PostGIS filtering and persisted global gem selection."""

    def test_registered_points_inside_viewport_are_returned_without_radius(self):
        near = self.create_business()
        far = self.create_business(
            longitude=123.99,
        )

        businesses = MapDiscoveryService.list_viewport_businesses(
            **self.bounds,
        )

        self.assertCountEqual(
            [business.BUSN_ID for business in businesses],
            [near.BUSN_ID, far.BUSN_ID],
        )

    def test_points_outside_each_viewport_edge_are_excluded(self):
        for latitude, longitude in (
            (10.41, 123.9),
            (10.19, 123.9),
            (10.3, 124.01),
            (10.3, 123.79),
        ):
            self.create_business(
                latitude=latitude,
                longitude=longitude,
            )

        self.assertFalse(
            MapDiscoveryService.list_viewport_businesses(
                **self.bounds,
            ).exists(),
        )

    def test_points_on_viewport_edges_and_corners_are_included(self):
        expected_ids = []
        for latitude, longitude in (
            (10.4, 123.9),
            (10.2, 123.9),
            (10.3, 124.0),
            (10.3, 123.8),
            (10.4, 124.0),
            (10.2, 123.8),
        ):
            business = self.create_business(
                latitude=latitude,
                longitude=longitude,
            )
            expected_ids.append(business.BUSN_ID)

        businesses = MapDiscoveryService.list_viewport_businesses(
            **self.bounds,
        )

        self.assertCountEqual(
            [business.BUSN_ID for business in businesses],
            expected_ids,
        )

    def test_active_unverified_businesses_are_eligible_and_suspended_are_not(self):
        active = self.create_business()
        self.create_business(
            status_value=Business.BusinessStatus.SUSPENDED,
            score="1.00000",
        )

        businesses = list(
            MapDiscoveryService.list_viewport_businesses(
                **self.bounds,
            ),
        )

        self.assertEqual(len(businesses), 1)
        self.assertEqual(businesses[0].BUSN_ID, active.BUSN_ID)
        self.assertTrue(businesses[0].is_hidden_gem)
        self.assertFalse(active.BUSN_IS_VERIFIED)

    def test_global_top_ten_matches_homepage_including_both_tie_breakers(self):
        businesses = []
        for index in range(12):
            business = self.create_business(
                score="0.50000",
            )
            businesses.append(business)

        now = timezone.now()
        Business.objects.filter(
            BUSN_ID__in=[business.BUSN_ID for business in businesses],
        ).update(
            BUSN_CREATED_AT=now,
        )
        Business.objects.filter(
            BUSN_ID=businesses[-1].BUSN_ID,
        ).update(
            BUSN_CREATED_AT=now + timedelta(seconds=1),
        )
        expected_ids = [
            businesses[-1].BUSN_ID,
            *[business.BUSN_ID for business in businesses[:9]],
        ]
        homepage_ids = list(
            DiscoveryFeedService.list_discovery_businesses(
                user=self.explorer,
            ).values_list(
                "BUSN_ID",
                flat=True,
            )[:10],
        )

        self.assertEqual(homepage_ids, expected_ids)
        self.assertEqual(
            list(DiscoveryFeedService.list_global_hidden_gem_ids()),
            expected_ids,
        )
        map_businesses = list(
            MapDiscoveryService.list_viewport_businesses(
                **self.bounds,
            ),
        )
        self.assertCountEqual(
            [
                business.BUSN_ID
                for business in map_businesses
                if business.is_hidden_gem
            ],
            expected_ids,
        )
        self.assertEqual(
            [
                business.BUSN_ID
                for business in map_businesses
                if not business.is_hidden_gem
            ],
            [businesses[9].BUSN_ID, businesses[10].BUSN_ID],
        )

    def test_missing_scores_use_default_baseline_above_persisted_low_and_zero_scores(self):
        """Rank missing scores at the configured baseline while preserving stored zero."""
        scored = self.create_business(
            score="0.10000",
        )
        missing = self.create_business()
        zero = self.create_business(
            score="0.00000",
        )
        DiscoveryAlgorithmConfiguration.objects.update_or_create(
            pk=1,
            defaults={
                "DAC_SPECIALTY_SCORE_WEIGHT": Decimal("0.80"),
                "DAC_VISIBILITY_GAP_WEIGHT": Decimal("0.20"),
            },
        )
        now = timezone.now()
        Business.objects.all().update(
            BUSN_CREATED_AT=now,
        )

        self.assertEqual(
            list(DiscoveryFeedService.list_global_hidden_gem_ids()),
            [missing.BUSN_ID, scored.BUSN_ID, zero.BUSN_ID],
        )
        self.assertEqual(
            list(
                DiscoveryFeedService.list_ranked_businesses().values_list(
                    "discovery_rank_score",
                    flat=True,
                ),
            ),
            [Decimal("0.20"), Decimal("0.10"), Decimal("0.00")],
        )

    def test_configured_missing_score_changes_global_gem_membership_not_viewport_order(self):
        """Apply configured fallback to global membership and retain gem-first ID order."""
        leaders = [
            self.create_business(
                score="0.90000",
            )
            for _ in range(9)
        ]
        persisted = self.create_business(
            score="0.22000",
        )
        missing = self.create_business()
        for visibility_weight, specialty_weight, last_gem in (
            ("0.20", "0.80", persisted),
            ("0.25", "0.75", missing),
        ):
            with self.subTest(visibility_weight=visibility_weight):
                DiscoveryAlgorithmConfiguration.objects.update_or_create(
                    pk=1,
                    defaults={
                        "DAC_SPECIALTY_SCORE_WEIGHT": Decimal(specialty_weight),
                        "DAC_VISIBILITY_GAP_WEIGHT": Decimal(visibility_weight),
                    },
                )
                expected_gems = {
                    business.BUSN_ID
                    for business in leaders
                }
                expected_gems.add(last_gem.BUSN_ID)
                self.assertSetEqual(
                    set(DiscoveryFeedService.list_global_hidden_gem_ids()),
                    expected_gems,
                )
                markers = list(
                    MapDiscoveryService.list_viewport_businesses(
                        **self.bounds,
                    ),
                )
                self.assertEqual(
                    [
                        business.BUSN_ID
                        for business in markers
                    ],
                    sorted(expected_gems) + sorted(
                        {
                            persisted.BUSN_ID,
                            missing.BUSN_ID,
                        } - expected_gems,
                    ),
                )
                self.assertSetEqual(
                    {
                        business.BUSN_ID
                        for business in markers
                        if business.is_hidden_gem
                    },
                    expected_gems,
                )
        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=missing,
            ).exists(),
        )

    def test_geographic_and_future_outer_filters_do_not_promote_local_businesses(self):
        for index in range(10):
            self.create_business(
                latitude=10.39,
                score=str(Decimal("1.0") - Decimal(index) / 100),
            )

        local = self.create_business(
            latitude=10.25,
            score="0.01000",
        )
        local_category = Category.objects.create(
            CTGRY_NAME="Local Only",
            CLUS_ID=self.cluster,
        )
        Business.objects.filter(
            BUSN_ID=local.BUSN_ID,
        ).update(
            CTGRY_ID=local_category,
        )

        for north in (10.3, 10.4):
            with self.subTest(north=north):
                businesses = list(
                    MapDiscoveryService.list_viewport_businesses(
                        **{
                            **self.bounds,
                            "north": north,
                        },
                    ).filter(
                        CTGRY_ID=local_category,
                        BUSN_NAME__icontains="Map",
                    ),
                )
                self.assertEqual(len(businesses), 1)
                self.assertEqual(businesses[0].BUSN_ID, local.BUSN_ID)
                self.assertFalse(businesses[0].is_hidden_gem)

    def test_map_requests_never_recompute_or_write_discovery_scores(self):
        self.create_business(
            score="0.50000",
        )
        before = list(DiscoveryScore.objects.values())

        with patch.object(
            DiscoveryScoreService,
            "recompute_business_scores",
        ) as recompute_batch, patch.object(
            DiscoveryScoreService,
            "recompute_business_score",
        ) as recompute_single:
            list(
                MapDiscoveryService.list_viewport_businesses(
                    **self.bounds,
                ),
            )

        recompute_batch.assert_not_called()
        recompute_single.assert_not_called()
        self.assertEqual(list(DiscoveryScore.objects.values()), before)
