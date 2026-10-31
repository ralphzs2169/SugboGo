"""Admin-only coverage, globally sorted pagination and fixed-window contracts."""

from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.analytics.tests.test_business_attention_service import AttentionFixtures
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class CoverageAttentionViewTests(AttentionFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        self.urls = [reverse(name) for name in (
            "admin-analytics-coverage", "admin-business-attention", "admin-low-exposure",
        )]
        self.authenticate()
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)
        mongo = patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=self.mongo_metrics)
        mongo.start()
        self.addCleanup(mongo.stop)

    def authenticate(self, role=User.UserRole.ADMIN, status=User.UserStatus.ACTIVE):
        self.client.force_authenticate(user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=status))

    def test_admin_and_superadmin_can_read_all_reports(self):
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.authenticate(role)
            for url in self.urls:
                with self.subTest(role=role, url=url):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(response.data["success"])
                    self.assertIn("meta", response.data["data"])

    def test_other_roles_inactive_admins_and_anonymous_are_rejected(self):
        for role, status in (
            (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
        ):
            self.authenticate(role, status)
            for url in self.urls:
                self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(user=None)
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 401)

    def test_pagination_is_applied_after_global_ordering(self):
        first = self.client.get(self.urls[1], {"page_size": 1, "ordering": "-profile_visits"})
        second = self.client.get(self.urls[1], {"page_size": 1, "page": 2, "ordering": "-profile_visits"})
        self.assertEqual(first.data["data"]["items"][0]["business_id"], self.businesses[1].pk)
        self.assertEqual(second.data["data"]["items"][0]["business_id"], self.businesses[0].pk)
        pagination = first.data["data"]["pagination"]
        self.assertEqual(pagination["total_items"], 4)
        self.assertEqual(pagination["total_pages"], 4)
        self.assertTrue(pagination["has_next"])
        self.assertEqual(self.client.get(self.urls[1], {"page": 999}).status_code, 404)

    def test_attention_scales_are_serialized_before_pagination_and_follow_filters(self):
        pages = [
            self.client.get(
                self.urls[1],
                {"attention_mode": "discovery", "page_size": 2, "page": page},
            ).data["data"]
            for page in (1, 2)
        ]
        for page in pages:
            self.assertEqual(
                page["metric_maxima"],
                {"profile_visits": 5, "saves": 4, "distinct_savers": 3},
            )
        self.assertEqual(
            max(row["profile_visits"] for row in pages[0]["items"]),
            1,
        )
        filtered = self.client.get(
            self.urls[1],
            {"attention_mode": "discovery", "category": self.category_a.pk},
        ).data["data"]
        self.assertEqual(
            filtered["metric_maxima"],
            {"profile_visits": 5, "saves": 3, "distinct_savers": 2},
        )

    def test_filtered_attention_retains_zero_visits_and_aggregate_only_columns(self):
        response = self.client.get(self.urls[1], {"category": self.category_a.pk, "ordering": "profile_visits"})
        rows = response.data["data"]["items"]
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["profile_visits"], 0)
        self.assertNotIn("explorer_id", rows[0])
        self.assertNotIn("discovery_score", rows[0])
        self.assertNotIn("location", rows[0])

    def test_low_exposure_is_paginated_fixed_window_and_discloses_thresholds(self):
        response = self.client.get(self.urls[2], {"page_size": 1})
        data = response.data["data"]
        self.assertEqual(data["items"][0]["business_id"], self.businesses[2].pk)
        self.assertEqual(data["pagination"]["total_items"], 2)
        self.assertEqual(data["thresholds"]["max_profile_visits"], 4)
        self.assertEqual(data["thresholds"]["min_distinct_supporters"], 5)
        self.assertTrue(data["thresholds"]["excludes_today"])
        self.assertEqual(data["meta"]["period"]["start_date"], "2026-09-12")
        self.assertEqual(data["meta"]["period"]["end_date"], "2026-10-11")
        self.assertEqual(data["selection_status"], "provisional")

    def test_low_exposure_rejects_request_owned_dates_and_thresholds(self):
        for field, value in (("period", "7"), ("start_date", "2026-10-01"),
                             ("max_profile_visits", "100"), ("min_distinct_supporters", "0")):
            with self.subTest(field=field):
                self.assertValidationError(self.client.get(self.urls[2], {field: value}), field)

    def test_bad_filters_ordering_and_pagination_use_validation_envelope(self):
        for query, field in (
            ({"cluster": 999999}, "cluster"), ({"category": 999999}, "category"),
            ({"cluster": self.cluster_a.pk, "category": self.category_b.pk}, "category"),
            ({"ordering": "discovery_score"}, "ordering"), ({"page_size": 101}, "page_size"),
            ({"page": 0}, "page"), ({"period": "14"}, "period"),
        ):
            with self.subTest(query=query):
                self.assertValidationError(self.client.get(self.urls[1], query), field)

    def test_failed_mongo_cannot_be_presented_as_empty_results_or_zero_coverage(self):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            coverage = self.client.get(self.urls[0]).data["data"]
            for url in self.urls[1:]:
                result = self.client.get(url).data["data"]
                self.assertIsNone(result["items"])
                self.assertIsNone(result["pagination"])
                self.assertEqual(result["meta"]["availability"], "unavailable")
            sql_sort = self.client.get(self.urls[1], {"ordering": "business_name"}).data["data"]
        self.assertEqual(coverage["overall"]["eligible_businesses"], 4)
        self.assertIsNone(coverage["overall"]["coverage_percentage"])
        self.assertEqual(len(sql_sort["items"]), 4)
        self.assertIsNone(sql_sort["items"][0]["saves"])

    def test_empty_filtered_population_has_valid_empty_pagination(self):
        response = self.client.get(self.urls[1], {"category": self.empty_category.pk})
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
