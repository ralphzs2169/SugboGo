"""Focused checks for the persisted coverage consumed by Dashboard score health."""

from datetime import timedelta
from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase

from apps.admin_operations.analytics.services.discovery_score_monitoring_service import (
    DiscoveryScoreMonitoringService,
)
from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import Business, DiscoveryScore
from apps.business.services.discovery_score_refresh_service import (
    DiscoveryScoreRefreshService,
)
from apps.users.models import User


class DashboardDiscoveryHealthTests(DashboardFixtures, TestCase):
    """Verify active inventory, reference-time freshness, and unavailable-source behavior."""

    def score(
        self,
        computed_at,
        status=Business.BusinessStatus.ACTIVE,
        provisional=False,
        error="",
        pending=False,
    ):
        """Create persisted score state without running scoring or dispatching tasks."""
        business = self.create_business(
            status=status,
            owner_status=User.UserStatus.SUSPENDED,
        )
        requested_at = None
        if pending:
            requested_at = self.NOW
        return DiscoveryScore.objects.create(
            BUSN_ID=business,
            DSC_S_SCORE=0,
            DSC_V_SCORE=0,
            DSC_D_SCORE=0,
            DSC_COMPUTED_AT=computed_at,
            DSC_IS_PROVISIONAL=provisional,
            DSC_LAST_ERROR=error,
            DSC_REFRESH_REQUESTED_AT=requested_at,
        )

    def test_coverage_uses_active_inventory_and_existing_reference_time_policy(self):
        cutoff = self.NOW - DiscoveryScoreRefreshService.MAX_SCORE_AGE
        old = self.score(
            cutoff - timedelta(microseconds=1),
            error="HistoricalFailure",
            pending=True,
        )
        self.score(self.NOW - timedelta(hours=1))
        self.score(cutoff)
        self.score(
            self.NOW + timedelta(days=1),
            provisional=True,
        )
        self.score(None)
        self.create_business()
        self.score(
            self.NOW + timedelta(days=2),
            status=Business.BusinessStatus.SUSPENDED,
            error="ExcludedSuspendedFailure",
        )

        with self.assertNumQueries(2):
            coverage = DiscoveryScoreMonitoringService.coverage()

        self.assertEqual(coverage["active_businesses"], 6)
        self.assertEqual(coverage["failed"], 1)
        self.assertEqual(coverage["stale"], 1)
        self.assertEqual(coverage["computed"], 3)
        self.assertEqual(coverage["missing"], 1)
        self.assertEqual(coverage["provisional"], 1)
        self.assertEqual(coverage["pending"], 1)
        self.assertEqual(coverage["max_score_age_hours"], 26)
        self.assertEqual(
            coverage["last_successful_computation"],
            self.NOW - timedelta(hours=1),
        )
        self.assertEqual(coverage["snapshot_at"], self.NOW)
        old.refresh_from_db()
        self.assertEqual(old.DSC_LAST_ERROR, "HistoricalFailure")

    def test_missing_scores_do_not_invent_a_successful_refresh(self):
        self.create_business()

        coverage = DiscoveryScoreMonitoringService.coverage()

        self.assertEqual(coverage["failed"], 0)
        self.assertEqual(coverage["stale"], 0)
        self.assertEqual(coverage["missing"], 1)
        self.assertIsNone(coverage["last_successful_computation"])

    def test_coverage_failure_is_not_converted_to_zero(self):
        with patch.object(
            Business.objects,
            "filter",
            side_effect=DatabaseError("Score coverage unavailable"),
        ):
            with self.assertRaises(DatabaseError):
                DiscoveryScoreMonitoringService.coverage()
