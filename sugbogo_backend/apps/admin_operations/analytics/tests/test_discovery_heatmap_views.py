"""Authenticated heatmap contract using real PostGIS and fixture visibility reads."""

import json
from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Polygon
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.analytics.services.geographic_aggregation_service import GeographicAggregationService
from apps.admin_operations.analytics.services.geographic_grid_service import GeographicGridService as Grid
from apps.admin_operations.analytics.tests.test_business_attention_service import AttentionFixtures
from apps.business.models import ServiceableBoundary
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class DiscoveryHeatmapViewTests(AttentionFixtures, APIResponseAssertionsMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.polygon = Polygon.from_bbox((123.87, 10.30, 123.90, 10.33))
        cls.boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Cebu heatmap fixture", SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=MultiPolygon(cls.polygon, srid=4326),
        )

    def setUp(self):
        self.url = reverse("admin-discovery-heatmap")
        self.authenticate()
        reference = json.dumps({"type": "MultiPolygon", "coordinates": [self.polygon.coords]})
        for patcher in (
            patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW),
            patch.object(Grid, "reference_geometry", return_value=(reference, "fixture-digest")),
            patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=self.mongo_metrics),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def authenticate(self, role=User.UserRole.ADMIN, status=User.UserStatus.ACTIVE):
        self.client.force_authenticate(user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=status))

    def test_active_admin_and_superadmin_receive_the_standard_aggregate_contract(self):
        self.assertEqual(self.url, "/api/admin/analytics/discovery-heatmap/")
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.authenticate(role)
            response = self.client.get(self.url)
            self.assertSuccessResponse(response, message="Discovery heatmap retrieved successfully.")
            data = response.data["data"]
            self.assertEqual(data["metric"], "profile_visits")
            self.assertEqual(data["definition"]["cell_size_metres"], 1000)
            self.assertEqual(data["selection"]["eligible_businesses"], 4)
            self.assertEqual(data["selection"]["profile_visits"], 10)
            self.assertEqual(data["legend"]["maximum"], 10)
            self.assertFalse(data["truncated"])
            self.assertTrue(data["empty_cells_included"])
            self.assertEqual(sum(row["profile_visits"] for row in data["cells"]), 10)
            self.assertEqual(data["attribution"]["location"], "current_business_location")
            self.assertFalse(data["attribution"]["physical_arrivals"])

    def test_permission_denials_happen_before_geographic_or_visibility_reads(self):
        with patch.object(GeographicAggregationService, "get_report") as aggregate:
            for role, status in (
                (User.UserRole.MERCHANT, User.UserStatus.ACTIVE),
                (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
                (User.UserRole.ADMIN, User.UserStatus.SUSPENDED),
                (User.UserRole.SUPER_ADMIN, User.UserStatus.DISABLED),
            ):
                self.authenticate(role, status)
                self.assertEqual(self.client.get(self.url).status_code, 403)
            self.client.force_authenticate(user=None)
            self.assertEqual(self.client.get(self.url).status_code, 401)
            aggregate.assert_not_called()

    def test_dates_and_taxonomy_filters_reuse_existing_period_and_population(self):
        response = self.client.get(self.url, {
            "period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-10",
            "cluster": self.cluster_a.pk, "category": self.category_a.pk,
        })
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["selection"]["eligible_businesses"], 3)
        self.assertEqual(data["selection"]["profile_visits"], 9)
        period = data["meta"]["period"]
        self.assertEqual(period["start"], "2026-09-30T16:00:00+00:00")
        self.assertEqual(period["end_exclusive"], "2026-10-10T16:00:00+00:00")
        self.assertEqual(data["sources"]["visibility"]["period"], period)
        self.assertFalse(data["meta"]["coverage_verified"])

    def test_one_cell_selection_preserves_full_scope_totals_and_grid_identity(self):
        whole = self.client.get(self.url).data["data"]
        empty_cell = next(row for row in whole["cells"] if row["eligible_businesses"] == 0)
        selected = self.client.get(self.url, {"cell": empty_cell["id"]}).data["data"]
        self.assertEqual(selected["cells"], [empty_cell])
        self.assertEqual(selected["display_state"], "no_businesses")
        self.assertEqual(selected["selection"]["profile_visits"], 0)
        self.assertEqual(selected["selection"]["returned_cells"], 1)
        self.assertEqual(selected["reconciliation"], whole["reconciliation"])
        self.assertEqual(selected["legend"], whole["legend"])
        self.assertEqual(selected["definition"], whole["definition"])

    def test_healthy_empty_population_and_populated_zero_activity_have_distinct_states(self):
        empty = self.client.get(self.url, {"category": self.empty_category.pk}).data["data"]
        self.assertEqual(empty["display_state"], "no_businesses")
        self.assertTrue(all(row["state"] == "no_businesses" for row in empty["cells"]))
        for metrics in self.metrics.values():
            metrics["profile_visits"] = 0
        zero = self.client.get(self.url).data["data"]
        self.assertEqual(zero["display_state"], "zero_recorded_visits")
        self.assertEqual(zero["legend"]["maximum"], 0)
        self.assertTrue(zero["legend"]["zero_range"])

    def test_unavailable_visibility_preserves_populations_and_null_measurements(self):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["display_state"], "visibility_unavailable")
        self.assertEqual(data["selection"]["eligible_businesses"], 4)
        self.assertIsNone(data["selection"]["profile_visits"])
        self.assertIsNone(data["legend"]["maximum"])
        self.assertTrue(all(row["profile_visits"] is None for row in data["cells"]))
        self.assertEqual(data["sources"]["visibility"]["availability"], "unavailable")

    def test_unavailable_geography_is_a_null_report_with_preserved_inventory(self):
        ServiceableBoundary.objects.filter(pk=self.boundary.pk).update(SBND_IS_ACTIVE=False)
        data = self.client.get(self.url).data["data"]
        self.assertEqual(data["display_state"], "geography_unavailable")
        self.assertIsNone(data["cells"])
        self.assertIsNone(data["scope"])
        self.assertIsNone(data["selection"]["profile_visits"])
        self.assertEqual(data["reconciliation"]["eligible_businesses"], 4)
        self.assertEqual(data["reconciliation"]["inventory_profile_visits"], 10)
        self.assertEqual(data["meta"]["availability"], "unavailable")

    def test_rejects_unsupported_parameters_dates_metrics_and_taxonomy(self):
        for query, field in (
            ({"period": "14"}, "period"), ({"period": "custom"}, "start_date"),
            ({"period": "custom", "start_date": "2026-10-12", "end_date": "2026-10-01"}, "period"),
            ({"period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-20"}, "period"),
            ({"cluster": 0}, "cluster"), ({"cluster": 999999}, "cluster"),
            ({"category": 999999}, "category"),
            ({"cluster": self.cluster_a.pk, "category": self.category_b.pk}, "category"),
            ({"metric": "distinct_visitors"}, "metric"), ({"metric": "saves"}, "metric"),
            ({"cell": "wrong-version:596:1139"}, "cell"),
            ({"cell": Grid.cell_id(99999, 99999)}, "cell"),
            ({"cell": Grid.cell_id(-0, 0).replace(":0:0", ":-0:0")}, "cell"),
            ({"resolution": "100"}, "resolution"), ({"district": "Cebu"}, "district"),
            ({"business_id": self.businesses[0].pk}, "business_id"),
            ({"page": 1}, "page"), ({"bbox": "123,10,124,11"}, "bbox"),
        ):
            with self.subTest(query=query):
                self.assertValidationError(self.client.get(self.url, query), field)

    def test_rejects_repeated_query_parameters(self):
        self.assertValidationError(self.client.get(self.url + "?period=7&period=30"), "period")
        self.assertValidationError(self.client.get(self.url + "?category=1&category=2"), "category")

    def test_non_get_methods_are_not_supported(self):
        for method in (self.client.post, self.client.put, self.client.patch, self.client.delete):
            self.assertEqual(method(self.url, {}, format="json").status_code, 405)

    def test_output_contains_no_business_or_explorer_identity_or_invented_unique_counts(self):
        data = self.client.get(self.url).data["data"]
        encoded = json.dumps(data)
        for key in ("business_id", "explorer_id", "USER_ID", "distinct_visitors", "distinct_savers"):
            self.assertNotIn(f'"{key}"', encoded)
        row = next(row for row in data["cells"] if row["eligible_businesses"])
        self.assertEqual(row["geometry"]["type"], "Polygon")
        for longitude, latitude in row["geometry"]["coordinates"][0]:
            self.assertTrue(123 < longitude < 125)
            self.assertTrue(10 < latitude < 11)
