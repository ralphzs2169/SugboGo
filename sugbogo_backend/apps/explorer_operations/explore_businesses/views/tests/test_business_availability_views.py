"""Private saved placeholders and bounded public eligibility reconciliation."""
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.business.models import Business, BusinessPocket, PocketMembership
from apps.business.services.pocket_service import PocketService
from apps.business.services.tests.pocket_fixtures import PocketFixtures
from apps.explorer_operations.explore_businesses.services.business_availability_service import BusinessAvailabilityService
from apps.notifications.models import Notification
from apps.users.models import User


class BusinessAvailabilityViewTests(PocketFixtures, APITestCase):
    base = "/api/explorer/explore/"

    def setUp(self):
        self.client.force_authenticate(self.user)
        PocketService.replace_memberships(self.user, self.business.pk, [self.custom.pk])
        self.saved = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)

    def test_suspension_preserves_minimal_owned_placeholder_and_reactivation_restores_same_save(self):
        url = self.base + f"pockets/{self.custom.pk}/businesses/"
        initial = self.client.get(url).data["data"]["items"][0]
        self.assertEqual(initial["availability"], "available")
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")
        response = self.client.get(url)
        item = response.data["data"]["items"][0]
        self.assertEqual(set(item), {"id", "business_name", "is_pocketed", "availability", "availability_checked_at"})
        self.assertEqual(item["availability"], "unavailable")
        self.assertEqual(item["business_name"], self.business.BUSN_NAME)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(self.client.get(self.base + f"businesses/{self.business.pk}/").status_code, 404)
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="active")
        restored = self.client.get(url).data["data"]["items"][0]
        self.assertEqual(restored["availability"], "available")
        self.assertIn("location", restored)
        self.assertEqual(BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business).pk, self.saved.pk)
        self.assertEqual(PocketMembership.objects.filter(PCKT_ID=self.saved).count(), 1)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)

    def test_unavailable_entry_remains_removable_and_foreign_collection_is_denied(self):
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")
        foreign = self.base + f"pockets/{self.custom.pk}/businesses/"
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(foreign).status_code, 404)
        self.client.force_authenticate(self.user)
        response = self.client.delete(foreign + f"{self.business.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["data"]["is_pocketed"])

    def test_batch_discloses_only_eligibility_and_treats_absent_and_suspended_identically(self):
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS="suspended")
        response = self.client.post(self.base + "businesses/availability/", {"business_ids": [self.business.pk, self.business_two.pk, 999999]}, format="json")
        self.assertEqual(response.status_code, 200)
        payload = response.data["data"]
        self.assertIn("checked_at", payload)
        self.assertEqual(payload["items"], [
            {"business_id": self.business.pk, "availability": "unavailable"},
            {"business_id": self.business_two.pk, "availability": "available"},
            {"business_id": 999999, "availability": "unavailable"},
        ])
        self.assertNotIn(self.business.BUSN_NAME, str(payload))

    def test_batch_requires_authentication_and_rejects_unbounded_or_invalid_ids(self):
        url = self.base + "businesses/availability/"
        for ids in [[], list(range(1, 102)), [0], [-1], ["invalid"]]:
            with self.subTest(ids=ids):
                self.assertEqual(self.client.post(url, {"business_ids": ids}, format="json").status_code, 400)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(url, {"business_ids": [self.business.pk]}, format="json").status_code, 401)

    def test_batch_is_one_query_and_deduplicates_identifiers(self):
        with self.assertNumQueries(1):
            result = BusinessAvailabilityService.check([self.business.pk, self.business.pk, self.business_two.pk])
        self.assertEqual(len(result["items"]), 2)

    def test_admin_cycle_restores_public_access_and_the_same_saved_membership(self):
        admin = self.make_user(
            "lifecycle-admin",
            User.UserRole.ADMIN,
        )
        business_id = self.business.pk
        pocket_id = self.custom.pk
        saved_id = self.saved.pk
        membership_id = PocketMembership.objects.get(PCKT_ID=self.saved).pk
        owner_status = self.owner.USER_STATUS
        reason = "Please correct the listing information."
        admin_url = f"/api/admin/businesses/{business_id}/"
        detail_url = self.base + f"businesses/{business_id}/"
        pocket_url = self.base + f"pockets/{pocket_id}/"
        availability_url = self.base + "businesses/availability/"

        self.assertEqual(self.client.get(detail_url).status_code, 200)
        self.client.force_authenticate(admin)
        initial = self.client.get(admin_url + "status/").data["data"]
        self.assertEqual(initial["status"], "active")
        overview = self.client.get("/api/admin/businesses/overview/").data["data"]
        initial_counts = overview["business_status"]
        suspended_response = self.client.post(
            admin_url + "suspend/",
            {
                "reason": reason,
                "expected_transition_id": initial["transition_id"],
            },
            format="json",
        )
        self.assertEqual(suspended_response.status_code, 200)
        suspended = suspended_response.data["data"]
        overview = self.client.get("/api/admin/businesses/overview/").data["data"]
        self.assertEqual(
            overview["business_status"]["active"],
            initial_counts["active"] - 1,
        )
        self.assertEqual(
            overview["business_status"]["suspended"],
            initial_counts["suspended"] + 1,
        )

        self.client.force_authenticate(self.owner)
        merchant = self.client.get("/api/merchant/business-profile/status/")
        self.assertEqual(merchant.data["data"]["suspension_reason"], reason)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(detail_url).status_code, 404)
        counts = self.client.get(pocket_url).data["data"]
        self.assertEqual(counts["business_count"], 1)
        self.assertEqual(counts["available_business_count"], 0)
        item = self.client.get(pocket_url + "businesses/").data["data"]["items"][0]
        self.assertEqual(item["availability"], "unavailable")
        self.assertNotIn("location", item)
        probe = self.client.post(
            availability_url,
            {"business_ids": [business_id]},
            format="json",
        )
        self.assertEqual(
            probe.data["data"]["items"][0]["availability"],
            "unavailable",
        )

        self.client.force_authenticate(admin)
        restored_response = self.client.post(
            admin_url + "reactivate/",
            {"expected_transition_id": suspended["transition_id"]},
            format="json",
        )
        self.assertEqual(restored_response.status_code, 200)
        restored = restored_response.data["data"]
        self.assertEqual(restored["status"], "active")
        self.assertIsNone(restored["suspension_reason"])
        self.assertGreater(restored["transition_id"], suspended["transition_id"])
        history_response = self.client.get(admin_url + "status-history/")
        history = history_response.data["data"]["items"]
        self.assertEqual(len(history), 2)
        self.assertEqual(history[1]["reason"], reason)
        overview = self.client.get("/api/admin/businesses/overview/").data["data"]
        self.assertEqual(overview["business_status"], initial_counts)
        notices = Notification.objects.filter(USER_ID=self.owner)
        self.assertEqual(notices.count(), 2)
        self.assertEqual(
            set(notices.values_list("NOTF_TYPE", flat=True)),
            {"business_suspended", "business_reactivated"},
        )

        self.client.force_authenticate(self.owner)
        merchant = self.client.get("/api/merchant/business-profile/status/")
        self.assertEqual(merchant.data["data"]["status"], "active")
        self.assertIsNone(merchant.data["data"]["suspension_reason"])
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.USER_STATUS, owner_status)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(detail_url).status_code, 200)
        item = self.client.get(pocket_url + "businesses/").data["data"]["items"][0]
        self.assertEqual(item["availability"], "available")
        counts = self.client.get(pocket_url).data["data"]
        self.assertEqual(counts["business_count"], 1)
        self.assertEqual(counts["available_business_count"], 1)
        probe = self.client.post(
            availability_url,
            {"business_ids": [business_id]},
            format="json",
        )
        self.assertEqual(
            probe.data["data"]["items"][0]["availability"],
            "available",
        )
        self.assertEqual(
            BusinessPocket.objects.get(
                USER_ID=self.user,
                BUSN_ID=self.business,
            ).pk,
            saved_id,
        )
        self.assertEqual(
            PocketMembership.objects.get(PCKT_ID=self.saved).pk,
            membership_id,
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_POCKET_COUNT, 1)
