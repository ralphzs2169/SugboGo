"""Private saved placeholders and bounded public eligibility reconciliation."""
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.business.models import Business, BusinessPocket, PocketMembership
from apps.business.services.pocket_service import PocketService
from apps.business.services.tests.pocket_fixtures import PocketFixtures
from apps.explorer_operations.explore_businesses.services.business_availability_service import BusinessAvailabilityService


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
