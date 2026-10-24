from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.serializers import (
    DiscoveryAlgorithmConfigurationSerializer,
)
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    DiscoveryScore,
    SpecialtyTag,
)

from ..discovery_feed_service import DiscoveryFeedService
from ..map_discovery_service import MapDiscoveryService
from .map_discovery_test_mixin import MapDiscoveryTestMixin


class HiddenGemEligibilityTests(MapDiscoveryTestMixin, TestCase):
    def candidate(
        self,
        specialty,
        gap,
        provisional=False,
    ):
        discovery_score = (
            Decimal("0.8") * Decimal(specialty)
            + Decimal("0.2") * Decimal(gap)
        )
        business = self.create_business(
            score=str(discovery_score),
        )
        if provisional:
            computed_at = None
        else:
            computed_at = timezone.now()
        DiscoveryScore.objects.filter(
            BUSN_ID=business,
        ).update(
            DSC_S_SCORE=Decimal(specialty),
            DSC_V_SCORE=Decimal(gap),
            DSC_IS_PROVISIONAL=provisional,
            DSC_COMPUTED_AT=computed_at,
        )
        return business

    def test_thresholds_exclude_exposed_weak_missing_and_provisional_businesses(self):
        strong = self.candidate("0.50", "0.80")
        boundary = self.candidate("0.10", "0.50")
        exposed = self.candidate("0.90", "0.20")
        weak = self.candidate("0.09", "1.00")
        new = self.candidate("0", "1", provisional=True)
        provisional = self.candidate("0.90", "0.90", provisional=True)
        missing = self.create_business()
        suspended = self.candidate("0.90", "0.90")
        Business.objects.filter(
            pk=suspended.pk,
        ).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        # Normal reads must use defaults without creating configuration.
        DiscoveryAlgorithmConfiguration.objects.all().delete()

        self.assertEqual(
            list(DiscoveryFeedService.list_global_hidden_gem_ids()),
            [strong.pk, boundary.pk],
        )
        self.assertEqual(
            list(DiscoveryFeedService.list_hidden_gems(self.explorer)),
            [strong, boundary],
        )
        general_ids = set(
            DiscoveryFeedService.list_ranked_businesses().values_list(
                "pk",
                flat=True,
            ),
        )
        for business in (exposed, weak, new, provisional, missing):
            self.assertIn(business.pk, general_ids)
        self.assertNotIn(suspended.pk, general_ids)
        self.assertFalse(DiscoveryAlgorithmConfiguration.objects.exists())
        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=missing,
            ).exists(),
        )

        markers = list(
            MapDiscoveryService.list_viewport_businesses(
                **self.bounds,
            ),
        )
        self.assertSetEqual(
            {
                business.pk
                for business in markers
                if business.is_hidden_gem
            },
            {strong.pk, boundary.pk},
        )

    def test_zero_eligible_is_empty_on_collection_and_map(self):
        self.candidate("0.90", "0.20")
        self.candidate("0", "1", provisional=True)
        self.create_business()
        self.assertEqual(
            list(DiscoveryFeedService.list_global_hidden_gem_ids()),
            [],
        )
        client = APIClient()
        client.force_authenticate(self.explorer)
        response = client.get("/api/explorer/explore/collections/hidden-gems/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertFalse(
            any(
                business.is_hidden_gem
                for business in MapDiscoveryService.list_directory_businesses()
            ),
        )

    def test_collection_filters_eligible_businesses_and_can_exceed_global_ten(self):
        eligible = [
            self.candidate("0.50", "0.80")
            for _ in range(12)
        ]
        ineligible = self.candidate("0.90", "0.20")
        Business.objects.all().update(
            BUSN_CREATED_AT=timezone.now(),
        )
        tag = SpecialtyTag.objects.create(TAG_NAME="Eligibility Coffee")
        for business in (eligible[-1], ineligible):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=tag,
            )
        client = APIClient()
        client.force_authenticate(self.explorer)
        homepage = client.get("/api/explorer/explore/collections/hidden-gems/")
        homepage_ids = [
            item["id"]
            for item in homepage.data["data"]["items"]
        ]
        self.assertEqual(
            homepage_ids,
            [
                business.pk
                for business in eligible[:10]
            ],
        )
        self.assertEqual(
            homepage_ids,
            list(DiscoveryFeedService.list_global_hidden_gem_ids()),
        )
        self.assertEqual(homepage.data["data"]["pagination"]["total_items"], 12)
        filtered = client.get(
            "/api/explorer/explore/collections/hidden-gems/",
            {"specialty_tag": tag.pk},
        )
        self.assertEqual(
            [
                item["id"]
                for item in filtered.data["data"]["items"]
            ],
            [eligible[-1].pk],
        )
        self.assertNotIn(eligible[-1].pk, homepage_ids)

    def test_configured_thresholds_and_validation_are_independent_of_weights(self):
        low = self.candidate("0.10", "0.50")
        high = self.candidate("0.40", "0.80")
        configuration = DiscoveryAlgorithmConfiguration.objects.get(pk=1)
        serializer = DiscoveryAlgorithmConfigurationSerializer(
            configuration,
            data={
                "hidden_gem_minimum_specialty_score": "0.40",
                "hidden_gem_minimum_visibility_gap": "0.80",
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertEqual(
            list(DiscoveryFeedService.list_global_hidden_gem_ids()),
            [high.pk],
        )
        self.assertIn(low, DiscoveryFeedService.list_ranked_businesses())
        configuration.refresh_from_db()
        self.assertEqual(
            configuration.DAC_SPECIALTY_SCORE_WEIGHT,
            Decimal("0.80"),
        )
        self.assertEqual(
            configuration.DAC_VISIBILITY_GAP_WEIGHT,
            Decimal("0.20"),
        )
        for field in (
            "hidden_gem_minimum_specialty_score",
            "hidden_gem_minimum_visibility_gap",
        ):
            for value in ("-0.00001", "1.00001"):
                with self.subTest(field=field, value=value):
                    invalid = DiscoveryAlgorithmConfigurationSerializer(
                        configuration,
                        data={field: value},
                        partial=True,
                    )
                    self.assertFalse(invalid.is_valid())
                    self.assertIn(field, invalid.errors)
