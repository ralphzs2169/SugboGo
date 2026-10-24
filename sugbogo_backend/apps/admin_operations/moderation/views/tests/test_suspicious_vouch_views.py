from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.admin_operations.moderation.serializers.suspicious_vouch_serializers import (
    SuspiciousVouchListSerializer,
)
from apps.admin_operations.moderation.services.suspicious_vouch_service import (
    SuspiciousVouchService,
)
from apps.business.models import BusinessVouch, SpecialtyTag
from apps.business.services.tests.test_vouch_lifecycle import VouchLifecycleFixtures
from apps.business.services.vouch_service import VouchService
from apps.users.models import User


class SuspiciousVouchViewTests(VouchLifecycleFixtures, TestCase):
    """Checks read-only scope, contracts, joins and bounded private context."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.admin = User.objects.create(
            USER_EMAIL="vouch-admin@example.com",
            USER_FNAME="Admin",
            USER_LNAME="Monitor",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        self.client.force_authenticate(self.admin)
        self.now = timezone.now()
        self.vouch = BusinessVouch.objects.create(
            USER_ID=self.user,
            BUSN_ID=self.business,
            TAG_ID=self.spicy_tag,
            VOUCH_REPUTATION_SNAPSHOT=self.user.USER_REPUTATION,
            VOUCH_FLAG_SUSPICIOUS=True,
            VOUCH_INSTALLATION_ID="private-installation",
        )
        self.list_url = reverse("admin-suspicious-vouch-list")
        self.detail_url = reverse(
            "admin-suspicious-vouch-detail",
            args=[self.vouch.pk],
        )

    def test_permissions_and_get_only_endpoints(self):
        """Both Admin roles may inspect findings; other actors cannot."""
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.admin.USER_ROLE = role
            self.admin.save(update_fields=["USER_ROLE"])
            self.assertEqual(self.client.get(self.list_url).status_code, 200)
            self.assertEqual(self.client.get(self.detail_url).status_code, 200)
        for url in (self.list_url, self.detail_url):
            for method in ("post", "patch", "delete", "put"):
                self.assertEqual(getattr(self.client, method)(url).status_code, 405)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        self.assertEqual(self.client.get(self.detail_url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(
            self.client.get(self.list_url).status_code,
            (401, 403),
        )

    def test_list_contract_search_order_pagination_and_retained_states(self):
        """Flags remain inspectable regardless of validity and withdrawal."""
        other = BusinessVouch.objects.create(
            USER_ID=self.second_user,
            BUSN_ID=self.business,
            TAG_ID=self.traditional_tag,
            VOUCH_REPUTATION_SNAPSHOT=self.second_user.USER_REPUTATION,
            VOUCH_FLAG_SUSPICIOUS=True,
            VOUCH_EVIDENCE_IS_VALID=False,
            VOUCH_WITHDRAWN_AT=self.now,
        )
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_CREATED_AT=self.now - timedelta(days=1),
        )
        response = self.client.get(
            self.list_url,
            {"page_size": 1},
        )
        self.assertTrue(response.data["success"])
        data = response.data["data"]
        self.assertEqual(data["pagination"]["total_items"], 2)
        self.assertTrue(data["pagination"]["has_next"])
        self.assertEqual(data["items"][0]["id"], other.pk)
        self.assertFalse(data["items"][0]["evidence_is_valid"])
        oldest = self.client.get(
            self.list_url,
            {"ordering": "oldest"},
        ).data["data"]
        self.assertEqual(oldest["items"][0]["id"], self.vouch.pk)
        self.assertEqual(oldest["items"][0]["reasons"], ["unknown_reason"])
        for search in (
            self.business.BUSN_NAME,
            self.spicy_tag.TAG_NAME,
            "Explorer User",
        ):
            result = self.client.get(
                self.list_url,
                {"search": search},
            )
            self.assertGreater(
                result.data["data"]["pagination"]["total_items"],
                0,
            )
        with self.assertNumQueries(1):
            SuspiciousVouchListSerializer(
                SuspiciousVouchService.list_vouches({}),
                many=True,
            ).data
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_FLAG_SUSPICIOUS=False,
        )
        self.assertEqual(self.client.get(self.detail_url).status_code, 404)

    def test_detail_bounds_context_and_never_exposes_installation_ids(self):
        """Only the original business/window is shown, capped at twenty rows."""
        evidence = {
            VouchService.CONCENTRATION_REASON: {
                "observed_at": (self.now + timedelta(minutes=1)).isoformat(),
                "window_start": (self.now - timedelta(hours=23)).isoformat(),
                "window_hours": 24,
                "distinct_account_count": 5,
                "threshold": 5,
                "installation_id": "private-installation",
            },
        }
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_RELIABILITY_EVIDENCE=evidence,
        )
        for index in range(22):
            tag = SpecialtyTag.objects.create(
                TAG_NAME=f"Context {index}",
                TAG_COLOR="blue",
            )
            BusinessVouch.objects.create(
                USER_ID=self.second_user,
                BUSN_ID=self.business,
                TAG_ID=tag,
                VOUCH_REPUTATION_SNAPSHOT=self.second_user.USER_REPUTATION,
                VOUCH_INSTALLATION_ID="private-installation",
            )
        data = self.client.get(self.detail_url).data["data"]
        self.assertEqual(data["author"]["id"], self.user.pk)
        self.assertEqual(data["business"]["id"], self.business.pk)
        self.assertEqual(data["specialty"]["id"], self.spicy_tag.pk)
        self.assertEqual(len(data["current_related_activity"]["items"]), 20)
        self.assertTrue(data["current_related_activity"]["has_more"])
        self.assertNotIn("private-installation", str(data))
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_RELIABILITY_EVIDENCE={},
        )
        legacy = self.client.get(self.detail_url).data["data"]
        self.assertEqual(legacy["reasons"], ["unknown_reason"])
        self.assertTrue(legacy["current_related_activity"]["window_unavailable"])

    def test_context_scope_and_detection_timestamp(self):
        """The API separates detection time and excludes unrelated submissions."""
        observed_at = self.now + timedelta(minutes=1)
        evidence = {
            VouchService.CONCENTRATION_REASON: {
                "observed_at": observed_at.isoformat(),
                "window_start": (observed_at - timedelta(hours=24)).isoformat(),
                "window_hours": 24,
                "distinct_account_count": 5,
                "threshold": 5,
            },
        }
        BusinessVouch.objects.filter(pk=self.vouch.pk).update(
            VOUCH_RELIABILITY_EVIDENCE=evidence,
        )
        unrelated = BusinessVouch.objects.create(
            USER_ID=self.second_user,
            BUSN_ID=self.business,
            TAG_ID=self.spicy_tag,
            VOUCH_REPUTATION_SNAPSHOT=self.second_user.USER_REPUTATION,
            VOUCH_INSTALLATION_ID="different-installation",
        )
        for changes in (
            {},
            {
                "VOUCH_INSTALLATION_ID": "private-installation",
                "VOUCH_CREATED_AT": observed_at - timedelta(hours=25),
            },
        ):
            if changes:
                BusinessVouch.objects.filter(pk=unrelated.pk).update(**changes)
            data = self.client.get(self.detail_url).data["data"]
            self.assertEqual(data["detected_at"], observed_at.isoformat())
            self.assertEqual(data["reasons"], [VouchService.CONCENTRATION_REASON])
            self.assertEqual(
                [row["id"] for row in data["current_related_activity"]["items"]],
                [self.vouch.pk],
            )
            self.assertEqual(
                data["detection_evidence"][VouchService.CONCENTRATION_REASON]["distinct_account_count"],
                5,
            )
