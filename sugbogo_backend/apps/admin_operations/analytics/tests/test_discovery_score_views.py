"""API coverage for administrator Discovery Score monitoring."""

from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.contrib.gis.geos import Point
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    SpecialtyTag,
)
from apps.users.models import User
from apps.admin_operations.system_configuration.models import DiscoveryAlgorithmConfiguration
from apps.admin_operations.analytics.services.discovery_score_monitoring_service import (
    DiscoveryScoreMonitoringService,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.business.services.visibility_gap_service import (
    VisibilityComparisonLevel,
    VisibilityGapResult,
    VisibilityGapService,
)


class DiscoveryScoreMonitoringViewTests(APITestCase):
    """Verify score list identity, permissions, and batch delegation."""

    @classmethod
    def setUpTestData(cls):
        """Create a scored business with one inactive specialty."""

        cls.admin = User.objects.create_user(
            email="score-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Score",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.owner = User.objects.create_user(
            email="score-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Score",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Food & Culinary")
        category = Category.objects.create(
            CTGRY_NAME="Coffee Shop",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Cebu City",
        )
        cls.business = Business.objects.create(
            BUSN_NAME="Cebu Brew House",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_COVER_PHOTO_URL="https://example.com/cover.jpg",
            USER_ID=cls.owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        active_tag = SpecialtyTag.objects.create(TAG_NAME="Local Coffee")
        inactive_tag = SpecialtyTag.objects.create(TAG_NAME="Old Tag")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=active_tag,
            BST_IS_ACTIVE=True,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=inactive_tag,
            BST_IS_ACTIVE=False,
        )
        DiscoveryScore.objects.create(
            BUSN_ID=cls.business,
            DSC_S_SCORE=Decimal("0.72000"),
            DSC_V_SCORE=Decimal("0.61000"),
            DSC_D_SCORE=Decimal("0.69800"),
            DSC_COMPUTED_AT=timezone.now(),
        )

    def test_admin_list_returns_persisted_scores_and_business_identity(self):
        """Return classification, cover, and active tags in one row."""

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("discovery-score-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        row = response.data["data"]["items"][0]
        self.assertEqual(row["specialty_score"], "0.72000")
        self.assertEqual(row["visibility_gap"], "0.61000")
        self.assertEqual(row["discovery_score"], "0.69800")
        self.assertIsNotNone(row["computed_at"])
        self.assertEqual(row["business"]["business_name"], "Cebu Brew House")
        self.assertEqual(
            row["business"]["cover_photo_url"],
            "https://example.com/cover.jpg",
        )
        self.assertEqual(row["business"]["cluster_name"], "Food & Culinary")
        self.assertEqual(row["business"]["category_name"], "Coffee Shop")
        self.assertEqual(
            [tag["name"] for tag in row["business"]["specialty_tags"]],
            ["Local Coffee"],
        )

    def diagnostic_url(self):
        """Return the single-business diagnostic route."""
        return reverse(
            "discovery-score-visibility-diagnostics",
            kwargs={"business_id": self.business.pk},
        )

    def test_visibility_diagnostic_exposes_existing_result_and_configuration(self):
        """Delegate every visibility value and retain the calculation's reference time."""
        reference_time = timezone.now()
        configuration, _ = DiscoveryAlgorithmConfiguration.objects.update_or_create(
            pk=1,
            defaults={
                "DAC_VISIBILITY_WINDOW_DAYS": 14,
                "DAC_IMPRESSION_WEIGHT": Decimal("0.5"),
                "DAC_PROFILE_VISIT_WEIGHT": Decimal("0.3"),
                "DAC_SAVE_WEIGHT": Decimal("0.2"),
            },
        )
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_CREATED_AT=reference_time - timedelta(days=8),
        )
        result = VisibilityGapResult(
            business_id=self.business.pk,
            comparison_group_level=VisibilityComparisonLevel.CLUSTER,
            comparison_group_size=7,
            window_start=reference_time - timedelta(days=14),
            window_end=reference_time,
            impression_count=10,
            profile_visit_count=4,
            unique_saver_count=2,
            maximum_impression_count=20,
            maximum_profile_visit_count=16,
            maximum_unique_saver_count=10,
            normalized_impressions=Decimal("0.5"),
            normalized_profile_visits=Decimal("0.25"),
            normalized_saves=Decimal("0.2"),
            traction=Decimal("0.365"),
            visibility_gap=Decimal("0.635"),
        )
        before = DiscoveryScore.objects.values().get(BUSN_ID=self.business)
        self.client.force_authenticate(user=self.admin)
        with (
            patch.object(
                DiscoveryScoreMonitoringService,
                "visibility_context",
                return_value={
                    "configuration": configuration,
                    "reference_time": reference_time,
                },
            ),
            patch.object(
                VisibilityGapService,
                "calculate_business_visibility_gap",
                return_value=result,
            ) as calculate,
        ):
            response = self.client.get(self.diagnostic_url())

        self.assertEqual(response.status_code, 200)
        calculate.assert_called_once_with(
            business_id=self.business.pk,
            reference_time=reference_time,
            configuration=configuration,
            read_only=True,
        )
        data = response.data["data"]
        self.assertEqual(data["business_id"], self.business.pk)
        self.assertEqual(data["window_end"], data["reference_time"])
        self.assertEqual(
            data["window_start"],
            result.window_start.isoformat().replace("+00:00", "Z"),
        )
        for field in (
            "impression_count",
            "profile_visit_count",
            "unique_saver_count",
            "maximum_impression_count",
            "maximum_profile_visit_count",
            "maximum_unique_saver_count",
            "comparison_group_size",
        ):
            self.assertEqual(data[field], getattr(result, field))
        for field in (
            "normalized_impressions",
            "normalized_profile_visits",
            "normalized_saves",
            "traction",
            "visibility_gap",
        ):
            self.assertEqual(Decimal(data[field]), getattr(result, field))
        self.assertEqual(data["comparison_group_level"], "CLUSTER")
        self.assertEqual(
            data["signal_weights"],
            {
                "impressions": "0.50000",
                "profile_visits": "0.30000",
                "saves": "0.20000",
            },
        )
        self.assertEqual(data["observation_context"]["window_days"], 14)
        self.assertEqual(data["observation_context"]["potential_observation_days"], 8)
        self.assertTrue(data["observation_context"]["short_history"])
        self.assertFalse(data["coverage_verified"])
        self.assertEqual(data["telemetry_reason"], "coverage_unverified")
        self.assertIn("zero recorded events", data["telemetry_note"])
        self.assertEqual(
            DiscoveryScore.objects.values().get(BUSN_ID=self.business),
            before,
        )

    def test_visibility_diagnostic_uses_read_only_production_calculation(self):
        """Read empty activity without creating configuration, scores, or MongoDB indexes."""
        DiscoveryAlgorithmConfiguration.objects.all().delete()
        collection = Mock()
        collection.aggregate.return_value = []
        before = DiscoveryScore.objects.values().get(BUSN_ID=self.business)
        self.admin.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.client.force_authenticate(user=self.admin)
        with (
            patch.object(VisibilityEventService, "_unavailable_until", 0.0),
            patch.object(
                VisibilityEventService,
                "ensure_indexes",
                side_effect=AssertionError("Diagnostics must not initialize indexes."),
            ) as ensure_indexes,
            patch.object(
                VisibilityEventService,
                "_get_collection",
                return_value=collection,
            ),
        ):
            response = self.client.get(self.diagnostic_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["visibility_gap"], "1.00000")
        self.assertFalse(response.data["data"]["coverage_verified"])
        self.assertEqual(response.data["data"]["impression_count"], 0)
        collection.aggregate.assert_called_once()
        collection.create_index.assert_not_called()
        collection.bulk_write.assert_not_called()
        ensure_indexes.assert_not_called()
        self.assertFalse(DiscoveryAlgorithmConfiguration.objects.exists())
        self.assertEqual(
            DiscoveryScore.objects.values().get(BUSN_ID=self.business),
            before,
        )

    def test_monitoring_observation_context_is_capped_and_does_not_read_mongo(self):
        """Use configured potential age independently of telemetry and score state."""
        reference_time = timezone.now()
        configuration = DiscoveryAlgorithmConfiguration(
            DAC_VISIBILITY_WINDOW_DAYS=14,
        )
        self.client.force_authenticate(user=self.admin)
        with (
            patch.object(
                DiscoveryScoreMonitoringService,
                "visibility_context",
                return_value={
                    "configuration": configuration,
                    "reference_time": reference_time,
                },
            ),
            patch.object(VisibilityEventService, "_get_collection") as collection,
        ):
            for age, expected_days, short_history in (
                (-1, 0, True),
                (0, 0, True),
                (8, 8, True),
                (14, 14, False),
                (40, 14, False),
            ):
                with self.subTest(age=age):
                    Business.objects.filter(pk=self.business.pk).update(
                        BUSN_CREATED_AT=reference_time - timedelta(days=age),
                    )
                    response = self.client.get(reverse("discovery-score-list"))
                    row = response.data["data"]["items"][0]
                    observation = row["observation_context"]
                    self.assertEqual(
                        observation["potential_observation_days"],
                        expected_days,
                    )
                    self.assertEqual(observation["short_history"], short_history)
                    self.assertEqual(observation["window_days"], 14)
                    self.assertEqual(row["score_state"], "FRESH")
                    self.assertFalse(row["is_provisional"])
                    self.assertFalse(row["coverage_verified"])
                    self.assertEqual(row["visibility_gap"], "0.61000")
        collection.assert_not_called()

    def test_visibility_diagnostic_rejects_non_admin_and_unauthenticated_requests(self):
        """Apply the existing active administrator policy before calculation."""
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
        ) as calculate:
            self.admin.USER_STATUS = User.UserStatus.SUSPENDED
            for user in (None, self.owner, self.admin):
                self.client.force_authenticate(user=user)
                response = self.client.get(self.diagnostic_url())
                self.assertIn(response.status_code, (401, 403))
            self.owner.USER_ROLE = User.UserRole.EXPLORER
            self.client.force_authenticate(user=self.owner)
            self.assertEqual(self.client.get(self.diagnostic_url()).status_code, 403)
            calculate.assert_not_called()

    def test_monitoring_keeps_refresh_state_independent_of_telemetry_uncertainty(self):
        """Retain existing state precedence while reporting unknown coverage for every state."""
        now = timezone.now()
        cases = (
            ("PROVISIONAL", None, True, None, ""),
            ("FRESH", now, False, None, ""),
            ("STALE", now - timedelta(hours=27), False, None, ""),
            ("PENDING", now, False, now, ""),
            ("FAILED", now, False, now, "VisibilityTrackingUnavailable"),
        )
        self.client.force_authenticate(user=self.admin)
        for state, computed_at, provisional, pending, error in cases:
            with self.subTest(state=state):
                DiscoveryScore.objects.filter(BUSN_ID=self.business).update(
                    DSC_COMPUTED_AT=computed_at,
                    DSC_IS_PROVISIONAL=provisional,
                    DSC_REFRESH_REQUESTED_AT=pending,
                    DSC_LAST_ERROR=error,
                )
                response = self.client.get(reverse("discovery-score-list"))
                row = response.data["data"]["items"][0]
                self.assertEqual(row["score_state"], state)
                self.assertEqual(row["is_provisional"], provisional)
                self.assertEqual(row["last_error_code"], error)
                self.assertFalse(row["coverage_verified"])
                self.assertEqual(row["visibility_gap"], "0.61000")

    def test_visibility_diagnostic_preserves_api_failures_and_method_restrictions(self):
        """Retain controlled 503/404 envelopes without allowing diagnostic writes."""
        self.client.force_authenticate(user=self.admin)
        with patch.object(
            VisibilityGapService,
            "calculate_business_visibility_gap",
            side_effect=VisibilityTrackingUnavailable(retry_after=12),
        ):
            response = self.client.get(self.diagnostic_url())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "VISIBILITY_TRACKING_UNAVAILABLE")
        self.assertEqual(response.data["retry_after"], 12)
        methods = (
            self.client.post,
            self.client.put,
            self.client.patch,
            self.client.delete,
        )
        for method in methods:
            self.assertEqual(method(self.diagnostic_url(), {}).status_code, 405)
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        response = self.client.get(self.diagnostic_url())
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "NOT_FOUND")

    def test_search_and_tag_filter_narrow_rows_without_changing_scores(self):
        """Filter persisted rows without invoking scoring code."""

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            reverse("discovery-score-list"),
            {"search": "Cebu Brew", "specialty_tag": 999999},
        )
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(
            DiscoveryScore.objects.get(BUSN_ID=self.business).DSC_D_SCORE,
            Decimal("0.69800"),
        )

    def test_non_admin_cannot_list_or_recompute(self):
        """Reject merchant access to both administrator endpoints."""

        self.client.force_authenticate(user=self.owner)
        self.assertEqual(
            self.client.get(reverse("discovery-score-list")).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(reverse("discovery-score-recompute")).status_code,
            403,
        )

    @patch(
        "apps.admin_operations.analytics.services.discovery_score_monitoring_service."
        "DiscoveryScoreService.recompute_business_scores",
    )
    def test_manual_recompute_delegates_and_returns_summary(self, recompute):
        """Expose counts from the shared batch service without failure details."""

        recompute.return_value = SimpleNamespace(
            considered_count=2,
            updated_count=1,
            stale_count=0,
            failed_count=1,
            failures=[SimpleNamespace(business_id=42, detail="Internal error")],
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(reverse("discovery-score-recompute"))

        self.assertEqual(response.status_code, 200)
        recompute.assert_called_once_with()
        self.assertEqual(
            response.data["data"],
            {
                "considered": 2,
                "updated": 1,
                "skipped_stale": 0,
                "failed": 1,
                "failed_business_ids": [42],
            },
        )

    def test_score_endpoints_do_not_allow_editing(self):
        """Reject PUT and PATCH on the read-only score list."""

        self.client.force_authenticate(user=self.admin)
        url = reverse("discovery-score-list")
        self.assertEqual(self.client.put(url, {}).status_code, 405)
        self.assertEqual(self.client.patch(url, {}).status_code, 405)

    def test_coverage_and_initial_failure_state_are_visible_without_recalculation(self):
        from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService

        self.client.force_authenticate(user=self.admin)
        DiscoveryScore.objects.filter(BUSN_ID=self.business).delete()
        response = self.client.get(reverse("discovery-score-list"))
        coverage = response.data["data"]["coverage"]
        self.assertEqual(coverage["missing"], 1)
        self.assertEqual(coverage["missing_businesses"][0]["id"], self.business.pk)
        DiscoveryScoreRefreshService.initialize(self.business.pk)
        response = self.client.get(
            reverse("discovery-score-list"),
            {"score_state": "PROVISIONAL"},
        )
        row = response.data["data"]["items"][0]
        self.assertTrue(row["is_provisional"])
        self.assertIsNone(row["computed_at"])
        DiscoveryScore.objects.update(DSC_LAST_ERROR="OperationalError")
        response = self.client.get(
            reverse("discovery-score-list"),
            {"score_state": "FAILED"},
        )
        self.assertEqual(
            response.data["data"]["items"][0]["last_error_code"],
            "OperationalError",
        )
