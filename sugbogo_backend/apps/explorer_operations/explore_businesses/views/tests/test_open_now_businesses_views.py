from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.models import BusinessPocket
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.test_open_now_businesses_service import (
    OpenNowBusinessesTestMixin,
)


class OpenNowBusinessesViewTests(
    OpenNowBusinessesTestMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Cover the fixed preview contract, coordinate validation, and access control."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.explorer)
        self.url = reverse("open-now-businesses")
        self.params = {
            "latitude": 10.3,
            "longitude": 123.9,
        }
        clock = patch(
            "apps.explorer_operations.explore_businesses.services."
            "operating_hours_filter_service.timezone.now",
            return_value=self.reference_time,
        )
        clock.start()
        self.addCleanup(clock.stop)

    def test_returns_existing_business_card_contract_and_user_saved_state(self):
        business = self.create_open_business()
        BusinessPocket.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=business,
        )

        response = self.client.get(self.url, self.params)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(self.url, "/api/explorer/explore/open-now/")
        item = response.data["data"][0]
        self.assertEqual(item["id"], business.BUSN_ID)
        self.assertTrue(item["is_pocketed"])
        self.assertEqual(item["specialty_tags"], [])
        self.assertEqual(item["location"]["latitude"], 10.303)
        self.assertEqual(item["review_count"], 0)
        self.assertNotIn("nearby_visibility_gap", item)

    def test_preview_limit_cannot_be_overridden_by_pagination_parameters(self):
        for _ in range(8):
            self.create_open_business()

        response = self.client.get(
            self.url,
            {
                **self.params,
                "page_size": 100,
            },
        )

        self.assertEqual(len(response.data["data"]), 6)

    def test_successful_empty_preview_is_an_empty_array(self):
        response = self.client.get(self.url, self.params)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(response.data["data"], [])

    def test_rejects_missing_invalid_and_nonfinite_coordinates_before_querying(self):
        for params in (
            {},
            {"latitude": 10.3},
            {"longitude": 123.9},
            {"latitude": 91, "longitude": 123.9},
            {"latitude": 10.3, "longitude": 181},
            {"latitude": "NaN", "longitude": 123.9},
            {"latitude": 10.3, "longitude": "Infinity"},
        ):
            with self.subTest(params=params):
                with self.assertNumQueries(0):
                    response = self.client.get(self.url, params)

                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.data["success"])

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.url, self.params)

        self.assertEqual(response.status_code, 401)

    def test_allows_merchants_and_rejects_other_roles(self):
        self.explorer.USER_ROLE = User.UserRole.MERCHANT
        response = self.client.get(self.url, self.params)
        self.assertEqual(response.status_code, 200)

        self.explorer.USER_ROLE = User.UserRole.ADMIN
        response = self.client.get(self.url, self.params)
        self.assertEqual(response.status_code, 403)

    def test_serialization_query_count_does_not_grow_with_preview_size(self):
        self.create_open_business()
        with self.assertNumQueries(3):
            self.client.get(self.url, self.params)

        for _ in range(5):
            self.create_open_business()
        with self.assertNumQueries(3):
            self.client.get(self.url, self.params)
