from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services import (
    RecommendationAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    SpecialtyTag,
)
from apps.business.services.discovery_score_service import (
    DiscoveryScoreService,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
)
from ..recommendation_service import (
    RecommendationService,
)
from ..similar_business_service import (
    SimilarBusinessService,
)
from ..taxonomy_similarity import (
    build_business_feature_map,
)
from apps.users.models import User


class SimilarBusinessServiceTests(TestCase):
    def setUp(self):
        self.explorer = User.objects.create_user(
            email="similar-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Similar",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Cafe",
            CLUS_ID=self.cluster,
        )
        self.other_category = Category.objects.create(
            CTGRY_NAME="Restaurant",
            CLUS_ID=self.cluster,
        )
        self.other_cluster = Cluster.objects.create(
            CLUS_NAME="Outdoors",
        )
        self.unrelated_category = Category.objects.create(
            CTGRY_NAME="Trail",
            CLUS_ID=self.other_cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Similar Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.tag = SpecialtyTag.objects.create(
            TAG_NAME="Coffee",
        )
        self.current = self._create_business(
            "Current Cafe",
            self.category,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.current,
            TAG_ID=self.tag,
        )

    def _create_business(
        self,
        name,
        category,
        status_value=Business.BusinessStatus.ACTIVE,
        is_verified=False,
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
            BUSN_DESCRIPTION="Similarity test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status_value,
            BUSN_IS_VERIFIED=is_verified,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=self.location,
        )

    def _add_tag(
        self,
        business,
        tag=None,
        is_active=True,
    ):
        return BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=tag or self.tag,
            BST_IS_ACTIVE=is_active,
        )

    @staticmethod
    def _add_score(
        business,
        score,
    ):
        return DiscoveryScore.objects.create(
            BUSN_ID=business,
            DSC_S_SCORE=Decimal("0.50000"),
            DSC_V_SCORE=Decimal("0.50000"),
            DSC_D_SCORE=score,
            DSC_COMPUTED_AT=timezone.now(),
        )

    def test_shared_business_vector_preserves_recommendation_weights(self):
        configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )
        business = SimilarBusinessService._business_queryset(
            self.explorer,
        ).get(
            BUSN_ID=self.current.BUSN_ID,
        )

        shared_features = build_business_feature_map(
            business,
            configuration,
        )

        self.assertEqual(
            shared_features,
            RecommendationService.build_business_feature_map(
                business,
                configuration,
            ),
        )
        self.assertEqual(
            shared_features,
            {
                ("cluster", self.cluster.CLUS_ID): Decimal("1.00000"),
                ("category", self.category.CTGRY_ID): Decimal("2.00000"),
                ("tag", self.tag.TAG_ID): Decimal("3.00000"),
            },
        )

    def test_eligibility_similarity_ranking_and_deterministic_ties(self):
        identical_low_score = self._create_business(
            "Identical Low Score",
            self.category,
            is_verified=False,
        )
        identical_high_id = self._create_business(
            "Identical High ID",
            self.category,
            is_verified=True,
        )
        identical_low_id = self._create_business(
            "Identical Low ID",
            self.category,
            is_verified=False,
        )
        weaker = self._create_business(
            "Weaker Category Match",
            self.category,
        )
        suspended = self._create_business(
            "Suspended Match",
            self.category,
            status_value=Business.BusinessStatus.SUSPENDED,
        )
        below_threshold = self._create_business(
            "Cluster Only",
            self.other_category,
        )

        self._add_tag(identical_low_score)
        self._add_tag(identical_high_id)
        self._add_tag(identical_low_id)
        self._add_tag(suspended)
        self._add_score(
            identical_low_score,
            Decimal("0.10000"),
        )
        self._add_score(
            identical_high_id,
            Decimal("0.90000"),
        )
        self._add_score(
            identical_low_id,
            Decimal("0.90000"),
        )

        result = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )

        self.assertEqual(
            [business.BUSN_ID for business in result],
            [
                identical_high_id.BUSN_ID,
                identical_low_id.BUSN_ID,
                identical_low_score.BUSN_ID,
                weaker.BUSN_ID,
            ],
        )
        self.assertNotIn(self.current, result)
        self.assertNotIn(suspended, result)
        self.assertNotIn(below_threshold, result)
        self.assertEqual(len(result), 4)

    def test_missing_discovery_score_is_eligible_and_results_are_not_padded(self):
        match = self._create_business(
            "No Score Match",
            self.category,
        )
        DiscoveryAlgorithmConfiguration.objects.filter(
            pk=1,
        ).delete()

        result = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )

        self.assertEqual(result, [match])
        self.assertEqual(
            result[0].similar_discovery_score,
            Decimal("0.20000"),
        )
        self.assertFalse(
            DiscoveryAlgorithmConfiguration.objects.exists(),
        )
        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=match,
            ).exists(),
        )

    def test_missing_and_provisional_scores_tie_and_persisted_scores_override(self):
        missing = self._create_business(
            "Missing Score Candidate",
            self.category,
        )
        provisional = self._create_business(
            "Provisional Candidate",
            self.category,
        )
        higher = self._create_business(
            "Higher Persisted Score",
            self.category,
        )
        zero = self._create_business(
            "Persisted Zero Score",
            self.category,
        )
        DiscoveryScore.objects.create(
            BUSN_ID=provisional,
            DSC_S_SCORE=Decimal("0.00000"),
            DSC_V_SCORE=Decimal("1.00000"),
            DSC_D_SCORE=Decimal("0.20000"),
            DSC_IS_PROVISIONAL=True,
        )
        self._add_score(
            higher,
            Decimal("0.90000"),
        )
        self._add_score(
            zero,
            Decimal("0.00000"),
        )

        result = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )

        self.assertEqual(
            [
                business.BUSN_ID
                for business in result
            ],
            [
                higher.BUSN_ID,
                missing.BUSN_ID,
                provisional.BUSN_ID,
                zero.BUSN_ID,
            ],
        )
        self.assertEqual(
            result[1].similar_discovery_score,
            result[2].similar_discovery_score,
        )
        self.assertEqual(
            result[3].similar_discovery_score,
            Decimal("0.00000"),
        )

    def test_missing_score_tracks_configured_visibility_weight(self):
        configuration, _ = (
            DiscoveryAlgorithmConfiguration.objects.update_or_create(
                pk=1,
                defaults={
                    "DAC_SPECIALTY_SCORE_WEIGHT": Decimal("0.80"),
                    "DAC_VISIBILITY_GAP_WEIGHT": Decimal("0.20"),
                },
            )
        )
        match = self._create_business(
            "Configured Missing Score",
            self.category,
        )
        initial = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )
        self.assertEqual(
            initial[0].similar_discovery_score,
            Decimal("0.20000"),
        )

        configuration.DAC_SPECIALTY_SCORE_WEIGHT = Decimal("0.75")
        configuration.DAC_VISIBILITY_GAP_WEIGHT = Decimal("0.25")
        configuration.save(
            update_fields=[
                "DAC_SPECIALTY_SCORE_WEIGHT",
                "DAC_VISIBILITY_GAP_WEIGHT",
            ],
        )
        updated = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )

        self.assertEqual(updated, [match])
        self.assertEqual(
            updated[0].similar_discovery_score,
            Decimal("0.25000"),
        )
        self.assertEqual(
            DiscoveryAlgorithmConfiguration.objects.count(),
            1,
        )
        self.assertFalse(
            DiscoveryScore.objects.filter(
                BUSN_ID=match,
            ).exists(),
        )

    def test_higher_similarity_precedes_higher_discovery_score(self):
        stronger = self._create_business(
            "Stronger Similarity",
            self.category,
        )
        weaker = self._create_business(
            "Weaker Similarity Higher Score",
            self.category,
        )
        self._add_tag(stronger)
        self._add_score(
            stronger,
            Decimal("0.00000"),
        )
        self._add_score(
            weaker,
            Decimal("1.00000"),
        )

        result = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )

        self.assertEqual(
            [
                business.BUSN_ID
                for business in result
            ],
            [stronger.BUSN_ID, weaker.BUSN_ID],
        )

    def test_no_meaningful_match_returns_empty_list(self):
        self._create_business(
            "Unrelated Business",
            self.unrelated_category,
        )

        result = SimilarBusinessService.list_similar_businesses(
            self.current.BUSN_ID,
            self.explorer,
        )

        self.assertEqual(result, [])

    def test_missing_or_suspended_current_business_raises_controlled_not_found(self):
        suspended = self._create_business(
            "Suspended Current",
            self.category,
            status_value=Business.BusinessStatus.SUSPENDED,
        )

        for business_id in (999999, suspended.BUSN_ID):
            with self.subTest(business_id=business_id):
                with self.assertRaisesMessage(
                    NotFound,
                    "The business could not be found.",
                ):
                    SimilarBusinessService.list_similar_businesses(
                        business_id,
                        self.explorer,
                    )

    @patch.object(
        DiscoveryScoreService,
        "recompute_business_scores",
    )
    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
    )
    def test_uses_fixed_postgresql_queries_without_recomputation_or_mongodb(
        self,
        profile_visits,
        recompute_scores,
    ):
        for index in range(5):
            business = self._create_business(
                f"Query Match {index}",
                self.category,
            )
            self._add_tag(business)

        RecommendationAlgorithmConfigurationService.get_current_configuration()

        with self.assertNumQueries(7):
            result = SimilarBusinessService.list_similar_businesses(
                self.current.BUSN_ID,
                self.explorer,
            )

        self.assertEqual(len(result), 4)
        profile_visits.assert_not_called()
        recompute_scores.assert_not_called()
