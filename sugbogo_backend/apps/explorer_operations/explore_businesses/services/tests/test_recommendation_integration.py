from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase

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
    Location,
    SpecialtyTag,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.explorer_operations.explore_businesses.services.recommendation_service import (
    RecommendationService,
)
from apps.users.models import (
    User,
    UserCategoryInterest,
    UserSpecialtyTagInterest,
)


class RecommendationIntegrationTests(TestCase):
    def setUp(self):
        self.explorer = User.objects.create_user(
            email="recommendation-signals@example.com",
            password="StrongPassword123!",
            USER_FNAME="Signal",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.cluster = Cluster.objects.create(CLUS_NAME="Signal Cluster")
        self.category = Category.objects.create(
            CTGRY_NAME="Signal Category",
            CLUS_ID=self.cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Signal Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.tag = SpecialtyTag.objects.create(TAG_NAME="Signal Tag")
        self.other_tag = SpecialtyTag.objects.create(TAG_NAME="Ignored Tag")
        self.business = self._create_business("Signal Business")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=self.tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=self.other_tag,
            BST_IS_ACTIVE=False,
        )
        self.configuration = (
            RecommendationAlgorithmConfigurationService
            .get_current_configuration()
        )

    def _create_business(
        self,
        name,
        category=None,
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
            BUSN_DESCRIPTION="Signal test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=category or self.category,
            LOCT_ID=self.location,
        )

    def _candidate_businesses(self):
        return list(
            RecommendationService._candidate_queryset(self.explorer),
        )

    def test_business_features_are_dynamic_identities_and_exclude_inactive_tags(
        self,
    ):
        business = self._candidate_businesses()[0]
        original = RecommendationService.build_business_feature_map(
            business,
            self.configuration,
        )
        self.category.CTGRY_NAME = "Renamed Signal Category"
        self.category.save(update_fields=["CTGRY_NAME"])
        self.tag.TAG_NAME = "Renamed Signal Tag"
        self.tag.save(update_fields=["TAG_NAME"])
        renamed = RecommendationService.build_business_feature_map(
            business,
            self.configuration,
        )

        self.assertEqual(original, renamed)
        self.assertEqual(
            original,
            {
                ("cluster", self.cluster.CLUS_ID): Decimal("1.00000"),
                ("category", self.category.CTGRY_ID): Decimal("2.00000"),
                ("tag", self.tag.TAG_ID): Decimal("3.00000"),
            },
        )
        self.assertNotIn(("tag", self.other_tag.TAG_ID), original)

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
    )
    def test_explicit_and_learned_signals_accumulate(
        self,
        profile_visits,
    ):
        profile_visits.return_value = [
            self.business.BUSN_ID,
            self.business.BUSN_ID,
        ]
        UserCategoryInterest.objects.create(
            USER_ID=self.explorer,
            CTGRY_ID=self.category,
        )
        UserSpecialtyTagInterest.objects.create(
            USER_ID=self.explorer,
            TAG_ID=self.tag,
        )
        BusinessPocket.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
        )
        BusinessVouch.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            TAG_ID=self.tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
        )
        BusinessVouch.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            TAG_ID=self.other_tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
            VOUCH_EVIDENCE_IS_VALID=False,
        )

        features = RecommendationService.build_explorer_feature_map(
            self.explorer,
            self._candidate_businesses(),
            self.configuration,
        )

        self.assertEqual(
            features[("cluster", self.cluster.CLUS_ID)],
            Decimal("6.00000"),
        )
        self.assertEqual(
            features[("category", self.category.CTGRY_ID)],
            Decimal("12.00000"),
        )
        self.assertEqual(
            features[("tag", self.tag.TAG_ID)],
            Decimal("27.00000"),
        )
        self.assertNotIn(("tag", self.other_tag.TAG_ID), features)

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        side_effect=VisibilityTrackingUnavailable(),
    )
    def test_mongo_unavailability_preserves_postgresql_signals(
        self,
        _profile_visits,
    ):
        UserSpecialtyTagInterest.objects.create(
            USER_ID=self.explorer,
            TAG_ID=self.tag,
        )

        features = RecommendationService.build_explorer_feature_map(
            self.explorer,
            self._candidate_businesses(),
            self.configuration,
        )

        self.assertEqual(
            features[("tag", self.tag.TAG_ID)],
            Decimal("3.00000"),
        )

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        side_effect=RuntimeError("programming error"),
    )
    def test_unexpected_mongo_helper_errors_are_not_hidden(
        self,
        _profile_visits,
    ):
        with self.assertRaises(RuntimeError):
            RecommendationService.build_explorer_feature_map(
                self.explorer,
                self._candidate_businesses(),
                self.configuration,
            )

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        return_value=[],
    )
    @patch.object(DiscoveryFeedService, "list_discovery_businesses")
    def test_no_signals_delegate_to_discovery_fallback(
        self,
        discovery_feed,
        _profile_visits,
    ):
        sentinel = object()
        discovery_feed.return_value = sentinel

        result = RecommendationService.list_recommendations(self.explorer)

        self.assertIs(result, sentinel)
        discovery_feed.assert_called_once_with(self.explorer)

    @patch.object(
        VisibilityEventService,
        "get_profile_visit_business_ids",
        return_value=[],
    )
    def test_meaningful_profile_with_no_match_returns_empty_result(
        self,
        _profile_visits,
    ):
        other_cluster = Cluster.objects.create(CLUS_NAME="No Match Cluster")
        other_category = Category.objects.create(
            CTGRY_NAME="No Match Category",
            CLUS_ID=other_cluster,
        )
        UserCategoryInterest.objects.create(
            USER_ID=self.explorer,
            CTGRY_ID=other_category,
        )

        result = RecommendationService.list_recommendations(self.explorer)

        self.assertEqual(result, [])
