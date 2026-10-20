from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.business.models import BusinessPocket
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.business.services.pocket_service import PocketService
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.explorer_operations.explore_businesses.services.recommendation_service import RecommendationService
from apps.shared.services.mongodb_service import MongoDBService

from .pocket_fixtures import PocketFixtures
from .test_visibility_event_service import FakeVisibilityCollection, FakeVisibilityDatabase


class PocketMembershipAnalyticsTests(PocketFixtures, TestCase):
    """Checks new membership operations against real save-event and recommendation code."""

    def setUp(self):
        self.collection = FakeVisibilityCollection()
        patcher = patch.object(
            MongoDBService,
            "get_database",
            return_value=FakeVisibilityDatabase(self.collection),
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        self.original_indexes = VisibilityEventService._indexes_initialized
        self.original_cooldown = VisibilityEventService._unavailable_until
        VisibilityEventService._indexes_initialized = False
        VisibilityEventService._unavailable_until = 0.0
        self.addCleanup(self.restore_visibility_state)

    def restore_visibility_state(self):
        """Restores process-wide analytics availability flags after fake-store tests."""
        VisibilityEventService._indexes_initialized = self.original_indexes
        VisibilityEventService._unavailable_until = self.original_cooldown

    def test_only_new_aggregate_saves_schedule_events_and_unsaves_keep_history(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            PocketService.replace_memberships(
                self.user, self.business.pk, [self.favorites.pk, self.custom.pk],
            )
            self.assertEqual(self.collection.documents, {})
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(len(self.collection.documents), 1)
        original = next(iter(self.collection.documents.values())).copy()
        saved = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            PocketService.replace_memberships(self.user, self.business.pk, [self.custom.pk, self.second.pk])
            PocketService.remove_membership(self.user, self.custom.pk, self.business.pk)
            PocketCollectionService.delete_collection(self.user, self.second.pk)
        self.assertEqual(callbacks, [])
        self.assertEqual(next(iter(self.collection.documents.values())), original)
        self.assertFalse(BusinessPocket.objects.filter(pk=saved.pk).exists())
        self.assertEqual(PocketService.get_current_holder_count(self.business.pk, as_of=timezone.now()), 0)
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            PocketService.create_pocket(self.user, self.business.pk)
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(len(self.collection.documents), 1)

    def test_additional_memberships_do_not_duplicate_recommendation_signals(self):
        configuration = SimpleNamespace(RAC_POCKET_STRENGTH=Decimal("0.7"))
        with (
            patch.object(VisibilityEventService, "get_profile_visit_business_ids", return_value=[]),
            patch.object(
                RecommendationService,
                "build_business_feature_map",
                return_value={("category", self.category.pk): Decimal("1")},
            ),
        ):
            PocketService.replace_memberships(self.user, self.business.pk, [self.favorites.pk])
            first = RecommendationService.build_explorer_feature_map(self.user, [self.business], configuration)
            PocketService.replace_memberships(
                self.user, self.business.pk, [self.favorites.pk, self.custom.pk, self.second.pk],
            )
            after = RecommendationService.build_explorer_feature_map(self.user, [self.business], configuration)
            self.assertEqual(first, {("category", self.category.pk): Decimal("0.7")})
            self.assertEqual(after, first)
            PocketService.replace_memberships(self.user, self.business.pk, [])
            self.assertEqual(
                RecommendationService.build_explorer_feature_map(self.user, [self.business], configuration),
                {},
            )
