"""Exercise spatial authoring through real services, APIs and PostGIS queries."""

import io
import json
from copy import deepcopy

from django.contrib.gis.geos import GEOSGeometry, Point
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.admin_operations.transit_management.services.route_variant_service import RouteVariantService
from apps.admin_operations.transit_management.services.tests import TransitBoundaryTestMixin
from apps.admin_operations.transit_management.services.transit_point_service import TransitPointService
from apps.admin_operations.transit_management.services.transit_spatial_audit_service import TransitSpatialAuditService
from apps.business.models import ServiceableBoundary
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, TransitPoint
from apps.users.models import User


class TransitSpatialValidationTests(TransitBoundaryTestMixin, TestCase):
    """Reject bad geographic data without altering existing routes or shared stops."""

    def setUp(self):
        self.a = self.point("A", 123.89, 10.31)
        self.b = self.point("B", 123.90, 10.31)
        self.c = self.point("C", 123.91, 10.31)
        self.route = JeepneyRoute.objects.create(JRT_CODE="06B")
        self.data = {
            "JRT_ID": self.route,
            "JRV_ORIGIN_ID": self.a,
            "JRV_DESTINATION_ID": self.c,
            "ordered_transit_points": [self.a, self.b, self.c],
            "geometry": self.coordinates(self.a, self.b, self.c),
        }
        self.variant = RouteVariantService.create_variant(self.data)
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="spatial-admin@example.test", password="Test-only-Spatial-482!",
            USER_FNAME="Spatial", USER_LNAME="Test", USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.admin)

    def point(self, name, longitude, latitude):
        """Create explicitly synthetic fixture points without exercising authoring setup."""
        return TransitPoint.objects.create(
            TRPT_NAME=name, TRPT_POINT=Point(longitude, latitude, srid=4326),
        )

    @staticmethod
    def coordinates(*points):
        """Convert fixture points into the actual frontend coordinate contract."""
        return [
            {"longitude": point.TRPT_POINT.x, "latitude": point.TRPT_POINT.y}
            for point in points
        ]

    def snapshot(self):
        """Capture relevant IDs, geometry, stop order and update times for rollback assertions."""
        self.variant.refresh_from_db()
        return (
            self.variant.JRV_GEOMETRY.ewkt, self.variant.JRV_UPDATED_AT,
            list(self.variant.route_transit_points.values_list("RVTP_ID", "TRPT_ID_id", "RVTP_SEQUENCE")),
            list(TransitPoint.objects.order_by("pk").values_list("pk", "TRPT_NAME", "TRPT_UPDATED_AT")),
        )

    def test_bad_paths_are_rejected_before_any_route_write(self):
        bad_paths = [
            self.coordinates(self.c, self.a),
            [{"longitude": 123.89, "latitude": 10.31}] * 2,
            self.coordinates(self.a),
            [{"longitude": float("nan"), "latitude": 10.31}, *self.coordinates(self.c)],
            [{"longitude": 181, "latitude": 10.31}, *self.coordinates(self.c)],
            [
                *self.coordinates(self.a),
                {"longitude": 123.91, "latitude": 10.32},
                {"longitude": 123.89, "latitude": 10.32},
                *self.coordinates(self.c),
            ],
        ]
        before = self.snapshot()
        for geometry in bad_paths:
            with self.subTest(geometry=geometry):
                with CaptureQueriesContext(connection) as queries:
                    with self.assertRaises(ValidationError) as raised:
                        RouteVariantService.update_variant(self.variant.pk, {"geometry": geometry})
                self.assertIn("geometry", raised.exception.detail)
                self.assertFalse(any(
                    query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
                    for query in queries
                ))
                self.assertEqual(self.snapshot(), before)

    def test_cross_city_route_and_outside_stop_can_be_saved_and_audited(self):
        outside = TransitPointService.create_transit_point({
            "name": "Outside stop",
            "longitude": 124.001,
            "latitude": 10.31,
        })
        boundary = ServiceableBoundary.objects.get().SBND_BOUNDARY
        self.assertTrue(boundary.covers(self.a.TRPT_POINT))
        self.assertFalse(boundary.covers(outside.TRPT_POINT))

        variant = RouteVariantService.create_variant({
            "JRT_ID": self.route,
            "JRV_ORIGIN_ID": self.a,
            "JRV_DESTINATION_ID": outside,
            "ordered_transit_points": [self.a, outside],
            "geometry": self.coordinates(self.a, outside),
        })
        moved = TransitPointService.update_transit_point(
            outside.pk,
            {
                "longitude": 124.0011,
                "latitude": 10.31,
            },
        )

        variant.refresh_from_db()
        self.assertEqual(variant.JRV_GEOMETRY[-1], outside.TRPT_POINT.coords)
        self.assertEqual(moved.TRPT_POINT.x, 124.0011)
        self.assertTrue(TransitSpatialAuditService.audit()["valid"])

    def test_stops_off_path_are_refused(self):
        self.b.TRPT_POINT = Point(123.9, 10.311, srid=4326)
        self.b.save()
        with self.assertRaises(ValidationError) as raised:
            RouteVariantService.update_variant(self.variant.pk, {"ordered_transit_points": [self.a, self.b, self.c]})
        self.assertIn("transit_point_ids", raised.exception.detail)

    def test_stop_distances_use_meters_within_and_outside_tolerance(self):
        for distance, accepted in [(24, True), (26, False)]:
            with self.subTest(distance=distance):
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT ST_AsEWKT(ST_Project(%s::geometry::geography, %s, 0)::geometry)",
                        [Point(123.9, 10.31, srid=4326).ewkt, distance],
                    )
                    location = GEOSGeometry(cursor.fetchone()[0])
                TransitPoint.objects.filter(pk=self.b.pk).update(TRPT_POINT=location)
                if accepted:
                    RouteVariantService.update_variant(self.variant.pk, {})
                else:
                    with self.assertRaises(ValidationError):
                        RouteVariantService.update_variant(self.variant.pk, {})

    def test_path_cannot_extend_far_beyond_managed_endpoints(self):
        for geometry in [
            [{"longitude": 123.88, "latitude": 10.31}, *self.coordinates(self.a, self.b, self.c)],
            [*self.coordinates(self.a, self.b, self.c), {"longitude": 123.92, "latitude": 10.31}],
        ]:
            with self.subTest(geometry=geometry), self.assertRaises(ValidationError) as raised:
                RouteVariantService.update_variant(self.variant.pk, {"geometry": geometry})
            self.assertIn("geometry", raised.exception.detail)

    def test_stop_ids_in_reverse_spatial_order_are_refused(self):
        early = self.point("Early", 123.895, 10.31)
        late = self.point("Late", 123.905, 10.31)
        with self.assertRaises(ValidationError) as raised:
            RouteVariantService.update_variant(self.variant.pk, {
                "ordered_transit_points": [self.a, late, early, self.c],
            })
        self.assertIn("transit_point_ids", raised.exception.detail)

    def test_old_serializer_point_instances_are_refreshed_before_create(self):
        TransitPoint.objects.filter(pk=self.b.pk).update(TRPT_POINT=Point(123.9, 10.32, srid=4326))
        data = deepcopy(self.data)
        data["JRT_ID"] = JeepneyRoute.objects.create(JRT_CODE="04L")
        with self.assertRaises(ValidationError):
            RouteVariantService.create_variant(data)
        self.assertEqual(JeepneyRouteVariant.objects.count(), 1)

    def test_valid_partial_path_change_preserves_ordered_membership_ids(self):
        before = list(self.variant.route_transit_points.values_list("pk", flat=True))
        RouteVariantService.update_variant(self.variant.pk, {"geometry": self.coordinates(self.a, self.c)})
        self.assertEqual(list(self.variant.route_transit_points.values_list("pk", flat=True)), before)

    def test_invalid_create_does_not_leave_partial_route_memberships(self):
        data = deepcopy(self.data)
        data["JRT_ID"] = JeepneyRoute.objects.create(JRT_CODE="04L")
        data["geometry"] = self.coordinates(self.c, self.a)
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            RouteVariantService.create_variant(data)
        self.assertEqual(JeepneyRouteVariant.objects.count(), 1)
        self.assertEqual(self.snapshot(), before)

    def test_duplicate_direction_is_a_controlled_error_inside_service(self):
        with self.assertRaises(ValidationError) as raised:
            RouteVariantService.create_variant(self.data)
        self.assertIn("non_field_errors", raised.exception.detail)
        self.assertEqual(JeepneyRouteVariant.objects.count(), 1)

    def test_shared_stop_move_checks_every_affected_direction_and_rolls_back_name(self):
        north = self.point("North", 123.9, 10.32)
        RouteVariantService.create_variant({
            "JRT_ID": JeepneyRoute.objects.create(JRT_CODE="08G"),
            "JRV_ORIGIN_ID": self.b, "JRV_DESTINATION_ID": north,
            "geometry": self.coordinates(self.b, north), "ordered_transit_points": [self.b, north],
        })
        before = self.snapshot()
        with self.assertRaises(ValidationError) as raised:
            TransitPointService.update_transit_point(self.b.pk, {
                "name": "Changed", "longitude": 123.902, "latitude": 10.31,
            })
        self.assertIn("08G", str(raised.exception.detail))
        self.b.refresh_from_db()
        self.assertEqual(self.b.TRPT_POINT, Point(123.9, 10.31, srid=4326))
        self.assertEqual(self.snapshot(), before)

    def test_small_shared_stop_move_can_preserve_all_directions(self):
        north = self.point("North", 123.9, 10.32)
        RouteVariantService.create_variant({
            "JRT_ID": JeepneyRoute.objects.create(JRT_CODE="08G"),
            "JRV_ORIGIN_ID": self.b, "JRV_DESTINATION_ID": north,
            "geometry": self.coordinates(self.b, north), "ordered_transit_points": [self.b, north],
        })
        moved = TransitPointService.update_transit_point(self.b.pk, {
            "longitude": 123.9, "latitude": 10.3101,
        })
        self.assertEqual(moved.TRPT_POINT.y, 10.3101)
        self.assertTrue(TransitSpatialAuditService.audit()["valid"])

    def test_nonfinite_and_out_of_range_stop_locations_are_refused(self):
        for longitude, latitude in [(123.9, float("nan")), (181, 10.31)]:
            with self.subTest(longitude=longitude, latitude=latitude), self.assertRaises(ValidationError):
                TransitPointService.create_transit_point({
                    "name": "Invalid", "longitude": longitude, "latitude": latitude,
                })
        self.assertEqual(TransitPoint.objects.count(), 3)

    def test_route_update_does_not_require_a_serviceable_boundary(self):
        ServiceableBoundary.objects.all().delete()
        before = self.variant.JRV_GEOMETRY
        updated = RouteVariantService.update_variant(self.variant.pk, {})

        self.assertEqual(updated.JRV_GEOMETRY, before)

    def test_name_only_edit_and_unchanged_coordinates_do_not_require_boundary(self):
        ServiceableBoundary.objects.all().delete()
        moved = TransitPointService.update_transit_point(self.b.pk, {
            "name": "Renamed", "longitude": self.b.TRPT_POINT.x, "latitude": self.b.TRPT_POINT.y,
        })
        self.assertEqual(moved.TRPT_NAME, "Renamed")
        self.assertEqual(moved.TRPT_POINT, self.b.TRPT_POINT)

    def test_api_rejections_keep_existing_field_error_contract(self):
        before = self.snapshot()
        response = self.client.patch(f"/api/admin/transit/route-variants/{self.variant.pk}/", {
            "geometry": self.coordinates(self.c, self.a),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("geometry", response.data["errors"])
        response = self.client.patch(f"/api/admin/transit/transit-points/{self.b.pk}/", {
            "latitude": 10.32, "longitude": 123.9,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.data["errors"])
        self.assertEqual(self.snapshot(), before)

    def test_api_create_rejects_bad_path_without_creating_a_direction(self):
        route = JeepneyRoute.objects.create(JRT_CODE="04L")
        response = self.client.post("/api/admin/transit/route-variants/", {
            "route_id": route.pk,
            "origin_transit_point_id": self.a.pk,
            "destination_transit_point_id": self.c.pk,
            "transit_point_ids": [self.a.pk, self.b.pk, self.c.pk],
            "geometry": self.coordinates(self.c, self.a),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("geometry", response.data["errors"])
        self.assertEqual(JeepneyRouteVariant.objects.count(), 1)

    def test_audit_reports_legacy_failures_without_writes_or_timestamp_changes(self):
        TransitPoint.objects.filter(pk=self.b.pk).update(TRPT_POINT=Point(123.9, 10.32, srid=4326))
        before = self.snapshot()
        output = io.StringIO()
        with CaptureQueriesContext(connection) as queries:
            call_command("audit_transit_spatial_integrity", stdout=output)
        report = json.loads(output.getvalue())
        self.assertFalse(report["valid"])
        self.assertEqual(report["invalid_variants"][0]["variant_id"], self.variant.pk)
        self.assertFalse(any(
            query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
            for query in queries
        ))
        self.assertEqual(self.snapshot(), before)
        with self.assertRaises(CommandError):
            call_command("audit_transit_spatial_integrity", fail_on_errors=True, stdout=io.StringIO())

    def test_audit_handles_missing_boundary_and_inconsistent_legacy_memberships(self):
        ServiceableBoundary.objects.all().delete()
        self.variant.route_transit_points.all().delete()
        output = io.StringIO()
        call_command("audit_transit_spatial_integrity", stdout=output)

        report = json.loads(output.getvalue())
        self.assertEqual(len(report["invalid_variants"]), 1)
        self.assertEqual(report["invalid_variants"][0]["variant_id"], self.variant.pk)
