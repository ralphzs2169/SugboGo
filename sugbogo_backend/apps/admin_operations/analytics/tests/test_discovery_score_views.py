"""API coverage for administrator Discovery Score monitoring."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

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
