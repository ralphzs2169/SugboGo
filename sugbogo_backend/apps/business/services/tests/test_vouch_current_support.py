from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.admin_operations.analytics.services.business_attention_service import (
    BusinessAttentionService,
)
from apps.admin_operations.system_configuration.models import RecommendationAlgorithmConfiguration
from apps.admin_operations.user_management.activity_service import UserActivityService
from apps.admin_operations.user_management.services import UserManagementService
from apps.business.services.discovery_score_service import DiscoveryScoreService
from apps.business.services.tests import test_discovery_score_service as discovery_fixtures
from apps.business.services.tests.test_vouch_lifecycle import VouchLifecycleFixtures
from apps.business.services.visibility_gap_service import VisibilityGapService
from apps.business.services.vouch_service import VouchService
from apps.explorer_operations.explore_businesses.services.activity_timeline_service import (
    ActivityTimelineService,
)
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.explorer_operations.explore_businesses.services.explore_business_service import (
    ExploreBusinessService,
)
from apps.explorer_operations.explore_businesses.services.new_businesses_service import (
    NewBusinessesService,
)
from apps.explorer_operations.explore_businesses.services.recommendation_service import (
    RecommendationService,
)
from apps.explorer_operations.explore_businesses.services.similar_business_service import (
    SimilarBusinessService,
)
from apps.explorer_operations.explore_businesses.services.vouch_history_service import (
    VouchHistoryService,
)
from apps.merchant_operations.merchant_analytics.services.peer_analytics_service import (
    PeerAnalyticsService,
)
from apps.reviews.models import Review
from apps.reviews.services.community_review_service import CommunityReviewService
from apps.reviews.services.review_service import ReviewService


class CurrentVouchSupportTests(VouchLifecycleFixtures, TestCase):
    """Exercise current-support consumers against retained withdrawn identities."""

    def test_all_business_card_queries_ignore_withdrawn_support(self):
        self._create()
        loaders = [
            lambda: ExploreBusinessService.get_business_detail(
                self.business.pk,
                self.user,
            ),
            lambda: NewBusinessesService.list_new_businesses(self.user).get(
                pk=self.business.pk,
            ),
            lambda: DiscoveryFeedService.list_discovery_businesses(self.user).get(
                pk=self.business.pk,
            ),
            lambda: SimilarBusinessService._business_queryset(self.user).get(
                pk=self.business.pk,
            ),
            lambda: RecommendationService._candidate_queryset(self.user).get(
                pk=self.business.pk,
            ),
        ]
        for endorsed in [True, False, True]:
            for index, load in enumerate(loaders):
                with self.subTest(endorsed=endorsed, consumer=index):
                    business = load()
                    tag = next(
                        tag
                        for tag in business.active_specialty_tag_links
                        if tag.TAG_ID_id == self.spicy_tag.pk
                    )
                    self.assertEqual(tag.is_vouched, endorsed)
                    self.assertEqual(tag.BST_VOUCH_COUNT, int(endorsed))
            if endorsed and VouchService.has_vouched(
                self.user,
                self.business.pk,
                self.spicy_tag.pk,
            ):
                self._withdraw()
            else:
                self._create()

    def test_history_and_timeline_hide_withdrawn_identity(self):
        vouch = self._create()
        self._withdraw()
        self.assertEqual(
            VouchHistoryService.get_summary(self.user),
            {"total_businesses": 0, "total_specialty_vouches": 0},
        )
        self.assertFalse(VouchHistoryService.list_vouches(self.user).exists())
        self.assertFalse(
            ActivityTimelineService.list_activity(
                self.user,
                activity_type="vouches",
            ).exists(),
        )
        self._create()
        activity = ActivityTimelineService.list_activity(
            self.user,
            activity_type="vouches",
        ).get()
        self.assertEqual(activity["source_id"], vouch.pk)
        self.assertEqual(activity["occurred_at"], vouch.VOUCH_CREATED_AT)

    def test_recommendation_interests_exclude_withdrawn_endorsements(self):
        self._create()
        configuration = RecommendationAlgorithmConfiguration()
        with patch(
            "apps.explorer_operations.explore_businesses.services."
            "recommendation_service.VisibilityEventService.get_profile_visit_business_ids",
            return_value={},
        ):
            before = RecommendationService.build_explorer_feature_map(
                self.user,
                [],
                configuration,
            )
            self._withdraw()
            after = RecommendationService.build_explorer_feature_map(
                self.user,
                [],
                configuration,
            )

        self.assertIn(("tag", self.spicy_tag.pk), before)
        self.assertNotIn(("tag", self.spicy_tag.pk), after)

    def test_review_badges_and_community_filter_exclude_withdrawn_endorsements(self):
        self._create()
        review = Review.objects.create(
            USER_ID=self.user,
            BUSN_ID=self.business,
            REVW_TEXT="An existing published review.",
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_SHOW_IN_COMMUNITY=True,
        )
        for endorsed in [True, False]:
            ReviewService._attach_vouched_specialties([review])
            self.assertEqual(len(review.vouched_specialties), int(endorsed))
            matching = CommunityReviewService.list_reviews_queryset(
                self.user,
                specialty_tag_id=self.spicy_tag.pk,
            )
            self.assertEqual(matching.exists(), endorsed)
            if endorsed:
                self._withdraw()

    def test_analytics_and_admin_current_support_exclude_withdrawn_endorsements(self):
        self._create()
        now = timezone.now()
        period = SimpleNamespace(
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            generated_at=now,
        )
        for expected in [1, 0]:
            self.assertEqual(
                VouchService.get_retained_vouches(
                    self.business.pk,
                    as_of=now,
                ).count(),
                expected,
            )
            support = VouchService.get_current_specialty_support(
                self.business.pk,
                as_of=now,
            )
            self.assertEqual(sum(row["valid_vouches"] for row in support), expected)
            peer = PeerAnalyticsService.specialty_counts([self.business.pk], period)
            self.assertEqual(peer[self.business.pk], expected)
            attention = BusinessAttentionService.specialty_support([self.business.pk])
            self.assertEqual(bool(attention), bool(expected))
            user = UserManagementService.get_user_detail(self.user.pk)
            self.assertEqual(user.admin_vouch_count, expected)
            activity = UserActivityService.list_recent_activity(
                user=self.user,
                limit=10,
            )
            self.assertEqual(
                len([
                    item
                    for item in activity
                    if item["type"] == "business_vouched"
                ]),
                expected,
            )
            if expected:
                self._withdraw()

    def test_persisted_discovery_score_follows_withdrawal_and_reinstatement(self):
        vouch = self._create()
        reference_time = timezone.now()
        visibility = discovery_fixtures.DiscoveryScoreServiceTests._visibility_result(
            SimpleNamespace(
                business=self.business,
                REFERENCE_TIME=reference_time,
            ),
            visibility_gap=Decimal("1"),
        )
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            return_value=visibility,
        ):
            before = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.pk,
                reference_time=reference_time,
            )
            self._withdraw()
            withdrawn = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.pk,
                reference_time=reference_time + timedelta(microseconds=1),
            )
            self._create()
            restored = DiscoveryScoreService.recompute_business_score(
                business_id=self.business.pk,
                reference_time=reference_time + timedelta(microseconds=2),
            )

        self.assertLess(withdrawn.discovery_score, before.discovery_score)
        self.assertEqual(withdrawn.specialty_score, 0)
        self.assertEqual(restored.discovery_score, before.discovery_score)
        self.assertEqual(restored.specialty_score, before.specialty_score)
        self.assertEqual(restored.discovery_score_id, before.discovery_score_id)
        vouch.refresh_from_db()
        self.assertIsNone(vouch.VOUCH_WITHDRAWN_AT)
