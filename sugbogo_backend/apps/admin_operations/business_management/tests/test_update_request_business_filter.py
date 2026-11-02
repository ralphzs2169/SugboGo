"""Protect business-scoped navigation across all existing update-request queues."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.dashboard.tests import DashboardFixtures
from apps.business.models import Business
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.users.models import User


class UpdateRequestBusinessFilterTests(DashboardFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.create_user(role=User.UserRole.ADMIN))
        self.business = self.create_business(status=Business.BusinessStatus.SUSPENDED)
        self.other = self.create_business()
        for business in [self.business, self.other]:
            BusinessNameChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BNCR_PREVIOUS_BUSINESS_NAME="Old",
                BNCR_PROPOSED_BUSINESS_NAME="New",
                BNCR_SUBMITTED_AT=self.NOW,
            )
            BusinessClassificationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                PREVIOUS_CTGRY_ID=self.category,
                PROPOSED_CTGRY_ID=self.category,
                BCCR_PREVIOUS_CATEGORY_NAME="Category",
                BCCR_PREVIOUS_CLUSTER_ID=self.cluster.pk,
                BCCR_PREVIOUS_CLUSTER_NAME="Cluster",
                BCCR_PROPOSED_CATEGORY_NAME="Category",
                BCCR_PROPOSED_CLUSTER_ID=self.cluster.pk,
                BCCR_PROPOSED_CLUSTER_NAME="Cluster",
                BCCR_SUBMITTED_AT=self.NOW,
            )
            BusinessLocationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=business.USER_ID,
                BLCR_PREVIOUS_LOCT_ID=self.location.pk,
                BLCR_PREVIOUS_POINT=self.location.LOCT_POINT,
                BLCR_PREVIOUS_ADDRESS="Old",
                BLCR_PREVIOUS_CITY="Cebu City",
                BLCR_PREVIOUS_PROVINCE="Cebu",
                BLCR_PROPOSED_POINT=self.location.LOCT_POINT,
                BLCR_PROPOSED_ADDRESS="New",
                BLCR_PROPOSED_CITY="Cebu City",
                BLCR_PROPOSED_PROVINCE="Cebu",
                BLCR_SUBMITTED_AT=self.NOW,
            )
        self.routes = [
            reverse("admin-business-name-change-list"),
            reverse("admin-business-classification-change-list"),
            reverse("admin-business-location-change-list"),
        ]

    def test_filter_is_applied_before_pagination_in_all_three_queues(self):
        for route in self.routes:
            with self.subTest(route=route):
                response = self.client.get(
                    route,
                    {"business_id": self.business.pk, "page_size": 1},
                )
                self.assertEqual(response.status_code, 200)
                payload = response.data["data"]
                self.assertEqual(payload["pagination"]["total_items"], 1)
                self.assertEqual(payload["items"][0]["business_id"], self.business.pk)
                self.assertEqual(payload["items"][0]["status"], "pending")
                self.assertEqual(
                    self.client.get(route).data["data"]["pagination"]["total_items"],
                    2,
                )

    def test_filter_composes_with_status_and_allows_an_empty_business_queue(self):
        for route in self.routes:
            for params in [
                {"business_id": self.business.pk, "status": "approved"},
                {"business_id": self.other.pk + 100},
            ]:
                with self.subTest(route=route, params=params):
                    response = self.client.get(route, params)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.data["data"]["items"], [])
                    self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)

    def test_invalid_business_filters_are_rejected(self):
        for route in self.routes:
            for value in ["0", "-1", "no-business", "1.5"]:
                with self.subTest(route=route, value=value):
                    response = self.client.get(route, {"business_id": value})
                    self.assertEqual(response.status_code, 400)

    def test_existing_admin_permissions_are_preserved(self):
        self.client.force_authenticate(self.business.USER_ID)
        for route in self.routes:
            with self.subTest(route=route):
                response = self.client.get(route, {"business_id": self.business.pk})
                self.assertEqual(response.status_code, 403)
