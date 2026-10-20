from unittest.mock import patch

from apps.business.models import BusinessVouch
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.merchant_operations.merchant_analytics.services.tests.fixtures import (
    MerchantAnalyticsFixtures,
)


class RecentActivityFixtures(MerchantAnalyticsFixtures):
    """Provide two owners and a controlled optional save source for dashboard reads."""

    def setUp(self):
        """Freeze the reference clock and keep Mongo access out of SQL feature tests."""
        super().setUp()
        clock = patch(
            "apps.merchant_operations.dashboard.services.recent_activity_service.timezone.now",
            return_value=self.NOW,
        )
        clock.start()
        self.addCleanup(clock.stop)
        saves = patch.object(
            VisibilityEventService,
            "get_recent_save_days",
            return_value=[],
        )
        self.save_days = saves.start()
        self.addCleanup(saves.stop)

    def vouch(
        self,
        created_at,
        *,
        author=None,
        tag=None,
        valid=True,
    ):
        """Create timestamped evidence without creating a notification."""
        if author is None:
            author = self.supporter_a
        if tag is None:
            tag = self.tags[0]
        vouch = BusinessVouch.objects.create(
            BUSN_ID=self.business_a,
            USER_ID=author,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=author.USER_REPUTATION,
            VOUCH_EVIDENCE_IS_VALID=valid,
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_CREATED_AT=created_at,
        )
        return vouch
