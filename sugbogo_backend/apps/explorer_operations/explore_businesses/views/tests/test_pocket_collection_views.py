from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessPhoto,
    BusinessPocket,
    BusinessSpecialtyTag,
    PocketCollection,
    SpecialtyTag,
)
from apps.business.services.pocket_service import PocketService
from apps.business.services.tests.pocket_fixtures import PocketFixtures
from core.tests.assertions import APIResponseAssertionsMixin


class PocketCollectionViewTests(PocketFixtures, APIResponseAssertionsMixin, APITestCase):
    """Exercises the complete private collection and membership HTTP contracts."""

    base = "/api/explorer/explore/"

    def setUp(self):
        self.client.force_authenticate(self.user)
        self.collections_url = self.base + "pockets/"
        self.detail_url = self.collections_url + f"{self.custom.pk}/"
        self.contents_url = self.detail_url + "businesses/"
        self.memberships_url = self.base + f"businesses/{self.business.pk}/pockets/"
        self.legacy_url = self.base + f"businesses/{self.business.pk}/pocket/"

    def put_selection(self, ids):
        """Submits the complete selected Pocket set as JSON."""
        return self.client.put(self.memberships_url, {"pocket_ids": ids}, format="json")

    def test_collection_crud_with_normalized_name_and_standard_envelopes(self):
        response = self.client.post(self.collections_url, {"name": "  Food\t trips "}, format="json")
        self.assertSuccessResponse(response, message="Pocket created successfully.", status_code=201)
        data = response.data["data"]
        self.assertEqual(data["name"], "Food trips")
        self.assertFalse(data["is_default"])
        self.assertEqual(data["business_count"], 0)
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)
        detail = self.collections_url + f"{data['id']}/"
        self.assertEqual(self.client.get(detail).data["data"], data)
        response = self.client.patch(detail, {"name": "Day trips"}, format="json")
        self.assertEqual(response.data["data"]["name"], "Day trips")
        self.assertSuccessResponse(self.client.delete(detail), message="Pocket deleted successfully.")
        self.assertEqual(self.client.get(detail).status_code, 404)

    def test_overview_paginates_with_favorites_first_and_only_owned_collections(self):
        response = self.client.get(self.collections_url, {"page_size": 1})
        self.assertTrue(response.data["success"])
        data = response.data["data"]
        self.assertEqual(data["items"][0]["id"], self.favorites.pk)
        self.assertEqual(data["pagination"]["total_items"], 3)
        self.assertTrue(data["pagination"]["has_next"])
        page_two = self.client.get(self.collections_url, {"page_size": 1, "page": 2})
        self.assertEqual(page_two.data["data"]["pagination"]["page"], 2)

    def test_empty_contents_is_successful_paginated_empty(self):
        response = self.client.get(self.contents_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)

    def test_names_require_valid_nonempty_unique_values(self):
        for payload in ({}, {"name": "\t\n"}, {"name": "x" * 101}, {"name": "favorites"}, {"name": "CAFES"}):
            with self.subTest(payload=payload):
                response = self.client.post(self.collections_url, payload, format="json")
                self.assertValidationError(response, "name")
                self.assertIsInstance(response.data["errors"]["name"], (list, str))
        self.assertValidationError(self.client.patch(self.detail_url, {}, format="json"), "name")
        response = self.client.patch(self.detail_url, {"name": "WEEKEND"}, format="json")
        self.assertValidationError(response, "name")

    def test_favorites_is_protected(self):
        url = self.collections_url + f"{self.favorites.pk}/"
        self.assertValidationError(self.client.patch(url, {"name": "Other"}, format="json"))
        self.assertValidationError(self.client.delete(url))

    def test_every_new_endpoint_requires_authentication(self):
        self.client.force_authenticate(None)
        cases = (
            ("get", self.collections_url, None),
            ("post", self.collections_url, {"name": "Other"}),
            ("get", self.detail_url, None),
            ("patch", self.detail_url, {"name": "Other"}),
            ("delete", self.detail_url, None),
            ("get", self.contents_url, None),
            ("get", self.memberships_url, None),
            ("put", self.memberships_url, {"pocket_ids": []}),
            ("delete", self.contents_url + f"{self.business.pk}/", None),
        )
        for method, url, data in cases:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url, data, format="json")
                self.assertEqual(response.status_code, 401)
                self.assertFalse(response.data["success"])

    def test_active_merchant_can_use_explorer_pockets(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(self.collections_url, {"name": "Merchant places"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(PocketCollection.objects.filter(pk=response.data["data"]["id"], USER_ID=self.owner).exists())

    def test_disallowed_roles_and_inactive_accounts_are_rejected(self):
        for field, value in (("USER_ROLE", "admin"), ("USER_ROLE", "super_admin"), ("USER_STATUS", "suspended"), ("USER_STATUS", "disabled")):
            original = getattr(self.user, field)
            setattr(self.user, field, value)
            with self.subTest(field=field, value=value):
                self.assertEqual(self.client.get(self.collections_url).status_code, 403)
                self.assertEqual(self.put_selection([self.custom.pk]).status_code, 403)
            setattr(self.user, field, original)

    def test_foreign_and_missing_collections_return_not_found(self):
        for identifier in (self.foreign.pk, 999999):
            detail = self.collections_url + f"{identifier}/"
            cases = (
                self.client.get(detail),
                self.client.patch(detail, {"name": "Other"}, format="json"),
                self.client.delete(detail),
                self.client.get(detail + "businesses/"),
                self.client.delete(detail + f"businesses/{self.business.pk}/"),
            )
            self.assertTrue(all(response.status_code == 404 for response in cases))

    def test_complete_memberships_are_independent_of_overview_pagination(self):
        desired = sorted([self.custom.pk, self.second.pk])
        self.assertEqual(self.put_selection(desired).status_code, 200)
        self.client.get(self.collections_url, {"page_size": 1})
        state = self.client.get(self.memberships_url).data["data"]
        self.assertEqual(state, {"business_id": self.business.pk, "pocket_ids": desired, "is_pocketed": True})
        self.assertEqual(self.put_selection(desired).data["data"], state)
        self.assertEqual(self.put_selection([]).data["data"]["is_pocketed"], False)

    def test_mixed_invalid_selection_does_not_change_existing_state(self):
        self.put_selection([self.favorites.pk])
        response = self.put_selection([self.custom.pk, self.foreign.pk])
        self.assertValidationError(response, "pocket_ids")
        self.assertEqual(self.client.get(self.memberships_url).data["data"]["pocket_ids"], [self.favorites.pk])
        for payload in ({}, {"pocket_ids": None}, {"pocket_ids": [-1]}, {"pocket_ids": [True]}, {"pocket_ids": "all"}):
            self.assertValidationError(self.client.put(self.memberships_url, payload, format="json"), "pocket_ids")

    def test_single_removal_preserves_other_memberships_and_repeated_removal_is_safe(self):
        self.put_selection([self.custom.pk, self.second.pk])
        url = self.contents_url + f"{self.business.pk}/"
        response = self.client.delete(url)
        self.assertEqual(response.data["data"]["pocket_ids"], [self.second.pk])
        self.assertTrue(response.data["data"]["is_pocketed"])
        self.assertEqual(self.client.delete(url).data["data"], response.data["data"])

    def test_legacy_responses_are_unchanged_and_delete_unsaves_everywhere(self):
        self.put_selection([self.custom.pk])
        saved = BusinessPocket.objects.get(USER_ID=self.user, BUSN_ID=self.business)
        response = self.client.post(self.legacy_url, format="json")
        self.assertSuccessResponse(response, message="Business added to your pocket successfully.")
        self.assertEqual(response.data["data"], {"id": saved.pk, "business_id": self.business.pk, "is_pocketed": True})
        self.assertValidationError(self.client.post(self.legacy_url, format="json"))
        response = self.client.delete(self.legacy_url)
        self.assertEqual(response.data["data"], {"business_id": self.business.pk, "is_pocketed": False})
        self.assertEqual(self.client.get(self.memberships_url).data["data"]["pocket_ids"], [])
        self.assertEqual(self.client.delete(self.legacy_url).status_code, 404)

    def test_available_counts_and_business_images_match_current_card_contract(self):
        self.put_selection([self.custom.pk])
        PocketService.replace_memberships(self.user, self.business_two.pk, [self.custom.pk])
        tag = SpecialtyTag.objects.create(TAG_NAME="Pocket specialty", TAG_COLOR="red")
        BusinessSpecialtyTag.objects.create(BUSN_ID=self.business, TAG_ID=tag)
        BusinessPhoto.objects.create(
            BUSN_ID=self.business,
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
            BPHO_PHOTO_URL="https://example.com/storefront.jpg",
            BPHO_PHOTO_PUBLIC_ID="pocket-storefront",
        )
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(self.contents_url, {"page_size": 1})
        self.assertLessEqual(len(queries), 6)
        data = response.data["data"]
        self.assertEqual(data["pagination"]["total_items"], 2)
        self.assertTrue(data["pagination"]["has_next"])
        page_two = self.client.get(self.contents_url, {"page_size": 1, "page": 2})
        business = page_two.data["data"]["items"][0]
        self.assertEqual(business["id"], self.business.pk)
        self.assertIsNone(business["cover_photo_url"])
        self.assertEqual(business["display_cover_photo_url"], "https://example.com/storefront.jpg")
        self.assertTrue(business["is_pocketed"])
        self.assertEqual(business["specialty_tags"][0]["id"], tag.pk)
        self.assertIn("cluster", business)
        self.assertIn("location", business)
        self.assertIn("review_count", business)
        Business.objects.filter(pk=self.business_two.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        self.assertEqual(self.client.get(self.detail_url).data["data"]["business_count"], 1)
        self.assertEqual(self.client.get(self.contents_url).data["data"]["pagination"]["total_items"], 1)

    def test_unavailable_saves_are_hidden_but_can_be_read_and_removed(self):
        self.put_selection([self.custom.pk])
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        self.assertTrue(self.client.get(self.memberships_url).data["data"]["is_pocketed"])
        self.assertValidationError(self.put_selection([self.custom.pk, self.second.pk]))
        self.assertValidationError(self.client.post(self.legacy_url, format="json"))
        self.assertEqual(self.client.get(self.detail_url).data["data"]["business_count"], 0)
        self.assertEqual(self.client.delete(self.legacy_url).status_code, 200)
        missing = self.base + "businesses/999999/pockets/"
        self.assertEqual(self.client.get(missing).status_code, 404)
        self.assertEqual(self.client.put(missing, {"pocket_ids": []}, format="json").status_code, 404)
