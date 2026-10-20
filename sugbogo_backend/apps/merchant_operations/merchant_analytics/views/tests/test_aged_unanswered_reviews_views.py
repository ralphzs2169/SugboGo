from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.tests.fixtures import MerchantAnalyticsFixtures


class AgedUnansweredReviewsViewTests(
    MerchantAnalyticsFixtures,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.url = reverse("merchant-analytics-aged-unanswered-reviews")
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch(
            "apps.merchant_operations.merchant_analytics.services."
            "aged_unanswered_reviews_service.timezone.now",
            return_value=self.NOW,
        )
        clock.start()
        self.addCleanup(clock.stop)

    def test_response_contract_and_zero_snapshot(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "success": True,
                "message": "Current unanswered review ages retrieved successfully.",
                "data": {
                    "business": {
                        "id": self.business_a.pk,
                        "name": self.business_a.BUSN_NAME,
                        "status": self.business_a.BUSN_STATUS,
                    },
                    "total_unanswered": 0,
                    "under_3_days": 0,
                    "days_3_to_6": 0,
                    "days_7_plus": 0,
                    "snapshot_as_of": self.NOW.isoformat(),
                },
            },
        )

    def test_owned_business_is_derived_from_the_authenticated_merchant(self):
        self.review(self.NOW - timedelta(days=1))
        for age in (4, 8):
            self.review(
                self.NOW - timedelta(days=age),
                business=self.business_b,
            )
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["total_unanswered"], 1)
        self.assertEqual(response.data["data"]["under_3_days"], 1)
        self.client.force_authenticate(user=self.merchant_b)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["business"]["id"], self.business_b.pk)
        self.assertEqual(response.data["data"]["total_unanswered"], 2)
        self.assertEqual(response.data["data"]["days_3_to_6"], 1)
        self.assertEqual(response.data["data"]["days_7_plus"], 1)

    def test_snapshot_rejects_period_cutoff_business_and_entitlement_parameters(self):
        for key, value in (
            ("period", "7"),
            ("period", "30"),
            ("period", "90"),
            ("as_of", self.NOW.isoformat()),
            ("business_id", self.business_b.pk),
            ("user_id", self.merchant_b.pk),
            ("start_date", "2026-10-01"),
            ("plus", "true"),
        ):
            with self.subTest(parameter=key, value=value):
                self.assertValidationError(
                    self.client.get(self.url, {key: value}),
                    key,
                )

    def test_changing_the_standard_period_does_not_filter_this_snapshot(self):
        for age in (1, 20, 95):
            self.review(self.NOW - timedelta(days=age))
        for period in ("7", "30", "90"):
            standard = self.client.get(
                reverse("merchant-analytics-standard"),
                {"period": period},
            )
            self.assertEqual(standard.status_code, 200)
            report = self.client.get(self.url).data["data"]
            self.assertEqual(report["total_unanswered"], 3)
            self.assertEqual(report["days_7_plus"], 2)
            self.assertEqual(report["snapshot_as_of"], self.NOW.isoformat())

    def test_authentication_active_merchant_role_and_owned_business_are_required(self):
        for role, status in (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, status=status):
                self.client.force_authenticate(
                    user=User(
                        USER_ID=900,
                        USER_ROLE=role,
                        USER_STATUS=status,
                    ),
                )
                self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_authenticate(
            user=self.user("aged-api-missing", role=User.UserRole.MERCHANT),
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["code"], "NOT_FOUND")

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_standard_merchants_do_not_need_plus_access(self):
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_mutation_methods_are_not_supported(self):
        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url)
                self.assertEqual(response.status_code, 405)
