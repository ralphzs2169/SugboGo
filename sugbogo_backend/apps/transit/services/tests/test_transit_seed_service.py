"""Exercise import safety and routing using explicitly synthetic test-only geometry."""

import copy
import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.business.models import Business, Category, Cluster, Location, ServiceableBoundary
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.transit.serializers.transit_seed_serializers import TransitSeedDatasetSerializer
from apps.transit.services.direct_journey_map_service import DirectJourneyMapService
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.transit.services.transit_seed_export_service import TransitSeedExportService
from apps.transit.services.transit_seed_service import TransitSeedService
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService
from apps.users.models import User


def reviewed_fixture():
    """Return synthetic test coordinates, not a candidate real-world route or boarding site."""
    today = timezone.localdate().isoformat()
    return {
        "format_version": 1, "kind": "cebu_city_transit_seed",
        "dataset_id": "synthetic-test-only", "scope": "cebu_city",
        "sources": [{
            "id": "test-evidence", "title": "Synthetic test data",
            "url": "https://example.com/synthetic-test-only", "accessed_on": today,
            "license_note": "Generated for automated tests; no operational route claim.",
        }],
        "points": [
            {"key": key, "name": f"Synthetic import {key}", "longitude": longitude, "latitude": 10.31}
            for key, longitude in (("a", 123.89), ("b", 123.90), ("c", 123.91))
        ],
        "routes": [{
            "code": "TEST-CITY", "name": "Synthetic import test", "vehicle_type": "unknown",
            "variants": [{
                "key": "outbound", "point_keys": ["a", "b", "c"],
                "geometry": [
                    {"longitude": longitude, "latitude": 10.31}
                    for longitude in (123.89, 123.90, 123.91)
                ],
                "source_ids": ["test-evidence"],
                "review": {
                    "status": "reviewed", "reviewer": "Synthetic test reviewer",
                    "reviewed_on": today, "observed_on": today,
                    "geometry_method": "manual_trace", "evidence": "Synthetic fixture only.",
                    "license_reviewed": True,
                },
            }],
        }],
    }


@override_settings(DEBUG=True)
class TransitSeedServiceTests(TestCase):
    """Test preview, exact reuse, validation and rollback against actual local PostGIS."""

    def setUp(self):
        """Create a fictional test boundary without changing any application database."""
        self.payload = reviewed_fixture()
        self.confirmation = str(connection.settings_dict["NAME"])
        self.boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City", SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=MultiPolygon(Polygon((
                (123.88, 10.30), (123.92, 10.30), (123.92, 10.32),
                (123.88, 10.32), (123.88, 10.30),
            )), srid=4326),
        )

    @staticmethod
    def snapshot():
        """Include timestamps and IDs so reruns cannot silently repair existing data."""
        return {
            model.__name__: list(model.objects.order_by("pk").values())
            for model in (JeepneyRoute, TransitPoint, JeepneyRouteVariant, RouteTransitPoint)
        }

    def seed(self, *, apply=False):
        """Run only against Django's current isolated test database."""
        return TransitSeedService.seed(self.payload, confirmation=self.confirmation, apply=apply)

    def test_preview_checks_geometry_and_collisions_without_writes(self):
        before = self.snapshot()
        with CaptureQueriesContext(connection) as queries:
            result = self.seed()
        self.assertFalse(result["applied"])
        self.assertEqual(result["planned_records"], {"create": 8, "reuse": 0})
        self.assertIsNone(result["directions"][0]["variant_id"])
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(any(
            query["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
            for query in queries
        ))

    def test_apply_and_repeat_preserve_values_ids_and_timestamps(self):
        first = self.seed(apply=True)
        before = self.snapshot()
        second = self.seed(apply=True)
        self.assertEqual(first["planned_records"], {"create": 8, "reuse": 0})
        self.assertEqual(second["planned_records"], {"create": 0, "reuse": 8})
        self.assertEqual(first["directions"], second["directions"])
        self.assertEqual(first["dataset_sha256"], second["dataset_sha256"])
        self.assertEqual(self.snapshot(), before)

    def test_code_only_existing_route_is_reused_without_changes(self):
        route = JeepneyRoute.objects.create(JRT_CODE="TEST-CITY")
        updated_at = route.JRT_UPDATED_AT
        result = self.seed(apply=True)
        self.assertEqual(result["planned_records"], {"create": 7, "reuse": 1})
        route.refresh_from_db()
        self.assertEqual(route.JRT_UPDATED_AT, updated_at)

    def test_apply_plans_only_after_acquiring_the_admin_network_lock(self):
        original_plan = TransitSeedService._plan
        with patch.object(
            TransitSpatialValidationService, "lock_network",
            wraps=TransitSpatialValidationService.lock_network,
        ) as lock:
            def checked_plan(data):
                self.assertTrue(connection.in_atomic_block)
                lock.assert_called_once_with()
                return original_plan(data)

            with patch.object(TransitSeedService, "_plan", side_effect=checked_plan):
                self.seed(apply=True)

    def test_return_direction_is_independent_and_reuses_shared_stops(self):
        outbound = self.payload["routes"][0]["variants"][0]
        inbound = copy.deepcopy(outbound)
        inbound["key"] = "inbound"
        inbound["point_keys"].reverse()
        inbound["geometry"].reverse()
        self.payload["routes"][0]["variants"].append(inbound)
        first = self.seed(apply=True)
        self.assertEqual(len(first["directions"]), 2)
        self.assertEqual(TransitPoint.objects.count(), 3)
        self.assertEqual(JeepneyRouteVariant.objects.count(), 2)
        before = self.snapshot()
        second = self.seed(apply=True)
        self.assertEqual(second["planned_records"], {"create": 0, "reuse": 12})
        self.assertEqual(self.snapshot(), before)

    def test_existing_point_and_direction_edits_are_not_overwritten(self):
        self.seed(apply=True)
        point = TransitPoint.objects.get(TRPT_NAME="Synthetic import b")
        point.TRPT_POINT = Point(123.9001, 10.31, srid=4326)
        point.save()
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed(apply=True)
        self.assertEqual(self.snapshot(), before)

    def test_changed_geometry_and_extra_memberships_conflict_in_preview(self):
        self.seed(apply=True)
        self.payload["routes"][0]["variants"][0]["geometry"][1]["latitude"] = 10.31001
        with self.assertRaises(ValidationError):
            self.seed()
        self.payload = reviewed_fixture()
        variant = JeepneyRouteVariant.objects.get()
        point = TransitPoint.objects.create(TRPT_NAME="Extra", TRPT_POINT=Point(123.915, 10.31, srid=4326))
        RouteTransitPoint.objects.create(JRV_ID=variant, TRPT_ID=point, RVTP_SEQUENCE=4)
        with self.assertRaises(ValidationError):
            self.seed()

    def test_duplicate_point_names_or_coordinate_aliases_in_database_are_rejected(self):
        for name in ("Synthetic import a", "Another name"):
            with self.subTest(name=name):
                TransitPoint.objects.all().delete()
                TransitPoint.objects.create(TRPT_NAME=name, TRPT_POINT=Point(123.89, 10.31, srid=4326))
                if name == "Synthetic import a":
                    TransitPoint.objects.create(TRPT_NAME=name, TRPT_POINT=Point(123.89, 10.31, srid=4326))
                with self.assertRaises(ValidationError):
                    self.seed()

    def test_transaction_rolls_back_if_membership_validation_fails(self):
        before = self.snapshot()
        with patch.object(
            RouteTransitPoint, "full_clean", side_effect=ModelValidationError("Simulated conflict"),
        ):
            with self.assertRaises(ModelValidationError):
                self.seed(apply=True)
        self.assertEqual(self.snapshot(), before)

    def test_other_network_records_are_preserved(self):
        route = JeepneyRoute.objects.create(JRT_CODE="KEEP")
        before = (route.pk, route.JRT_CREATED_AT, route.JRT_UPDATED_AT)
        self.seed(apply=True)
        route.refresh_from_db()
        self.assertEqual((route.pk, route.JRT_CREATED_AT, route.JRT_UPDATED_AT), before)

    def test_target_guards_reject_before_database_access(self):
        for field, value in (
            ("NAME", "ordinary_database"), ("HOST", "remote.example.com"),
            ("ENGINE", "django.db.backends.postgresql"),
        ):
            with self.subTest(field=field), patch.dict(connection.settings_dict, {field: value}):
                with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                    self.seed(apply=True)
        with override_settings(DEBUG=False), self.assertNumQueries(0), self.assertRaises(PermissionDenied):
            self.seed()
        with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
            TransitSeedService.seed(self.payload, confirmation="wrong")

    def test_missing_duplicate_inactive_or_wrong_boundary_is_refused(self):
        self.boundary.SBND_IS_ACTIVE = False
        self.boundary.save()
        with self.assertRaises(ValidationError):
            self.seed()
        self.boundary.SBND_IS_ACTIVE = True
        self.boundary.SBND_PSGC_CODE = "wrong"
        self.boundary.save()
        with self.assertRaises(ValidationError):
            self.seed()
        self.boundary.SBND_PSGC_CODE = "072217000"
        self.boundary.save()
        self.boundary.pk = None
        self.boundary.save()
        with self.assertRaises(ValidationError):
            self.seed()

    def test_cross_boundary_geometry_is_not_clipped(self):
        self.payload["routes"][0]["variants"][0]["geometry"].insert(
            1, {"latitude": 10.33, "longitude": 123.90},
        )
        with self.assertRaisesMessage(ValidationError, "stay within Cebu City"):
            self.seed()
        self.assertEqual(TransitPoint.objects.count(), 0)

    def test_far_points_and_wrong_geometry_direction_are_rejected(self):
        self.payload["points"][1]["latitude"] = 10.311
        with self.assertRaisesMessage(ValidationError, "25 meters"):
            self.seed()
        self.payload = reviewed_fixture()
        self.payload["routes"][0]["variants"][0]["geometry"].reverse()
        with self.assertRaises(ValidationError):
            self.seed()

    def test_zero_length_and_self_intersecting_paths_are_refused(self):
        variant = self.payload["routes"][0]["variants"][0]
        variant["geometry"] = [variant["geometry"][0]] * 2
        with self.assertRaises(ValidationError):
            self.seed()
        variant["geometry"] = [
            {"longitude": longitude, "latitude": latitude}
            for longitude, latitude in ((123.89, 10.31), (123.91, 10.315), (123.89, 10.315), (123.91, 10.31))
        ]
        with self.assertRaises(ValidationError):
            self.seed()

    def test_intermediate_point_order_must_follow_the_geometry(self):
        self.payload["points"][1]["longitude"] = 123.895
        self.payload["points"][2]["longitude"] = 123.90
        self.payload["points"].append({
            "key": "d", "name": "Synthetic import d", "longitude": 123.91, "latitude": 10.31,
        })
        self.payload["routes"][0]["variants"][0]["point_keys"] = ["a", "c", "b", "d"]
        with self.assertRaisesMessage(ValidationError, "Stops must follow"):
            self.seed()

    def test_duplicate_path_cannot_be_disguised_with_different_endpoint_keys(self):
        self.payload["points"].extend([
            {"key": "d", "name": "Alternate start", "latitude": 10.31, "longitude": 123.89001},
            {"key": "e", "name": "Alternate end", "latitude": 10.31, "longitude": 123.90999},
        ])
        duplicate = copy.deepcopy(self.payload["routes"][0]["variants"][0])
        duplicate["key"] = "duplicate-path"
        duplicate["point_keys"] = ["d", "b", "e"]
        self.payload["routes"][0]["variants"].append(duplicate)
        with self.assertRaisesMessage(ValidationError, "duplicate path"):
            self.seed(apply=True)
        self.assertEqual(TransitPoint.objects.count(), 0)

    def test_draft_can_be_previewed_but_not_applied(self):
        self.payload["routes"][0]["variants"][0]["review"]["status"] = "needs_review"
        self.assertEqual(self.seed()["reviewed_direction_count"], 0)
        with self.assertRaisesMessage(ValidationError, "every supplied direction"):
            self.seed(apply=True)
        self.assertEqual(TransitPoint.objects.count(), 0)

    def test_review_evidence_dates_and_sources_are_required(self):
        for field, value in (
            ("reviewer", ""), ("observed_on", None), ("license_reviewed", False),
            ("evidence", ""), ("reviewed_on", "2999-01-01"),
        ):
            with self.subTest(field=field):
                self.payload = reviewed_fixture()
                self.payload["routes"][0]["variants"][0]["review"][field] = value
                with self.assertRaises(ValidationError):
                    self.seed()
        self.payload = reviewed_fixture()
        self.payload["routes"][0]["variants"][0]["source_ids"] = []
        with self.assertRaises(ValidationError):
            self.seed()

    def test_source_references_require_safe_urls_and_reuse_notes(self):
        for field, value in (
            ("url", "ftp://example.com/routes"),
            ("url", "https://user:password@example.com/routes"),
            ("license_note", ""), ("accessed_on", "2999-01-01"),
        ):
            with self.subTest(field=field, value=value):
                self.payload = reviewed_fixture()
                self.payload["sources"][0][field] = value
                with self.assertNumQueries(0), self.assertRaises(ValidationError):
                    self.seed()

    def test_duplicate_unknown_and_unused_file_keys_are_rejected(self):
        variants = []
        duplicate_point = reviewed_fixture()
        duplicate_point["points"].append(copy.deepcopy(duplicate_point["points"][0]))
        variants.append(duplicate_point)
        bad_reference = reviewed_fixture()
        bad_reference["routes"][0]["variants"][0]["point_keys"][1] = "missing"
        variants.append(bad_reference)
        duplicate_variant = reviewed_fixture()
        duplicate_variant["routes"][0]["variants"] *= 2
        variants.append(duplicate_variant)
        unknown = reviewed_fixture()
        unknown["routes"][0]["variants"][0]["verified"] = True
        variants.append(unknown)
        unused = reviewed_fixture()
        unused["points"].append({"key": "unused", "name": "Unused", "latitude": 10.31, "longitude": 123.915})
        variants.append(unused)
        for payload in variants:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                TransitSeedService.seed(payload, confirmation=self.confirmation)

    def test_nonfinite_coordinates_are_rejected(self):
        for value in (float("nan"), float("inf"), 181):
            self.payload = reviewed_fixture()
            self.payload["points"][0]["longitude"] = value
            with self.assertRaises(ValidationError):
                self.seed()

    def test_empty_bundled_dataset_is_an_honest_no_write_preview(self):
        data_path = Path(__file__).resolve().parents[2] / "data"
        payload = json.loads((data_path / "cebu_city_reviewed_seed.json").read_text())
        with self.assertNumQueries(0):
            result = TransitSeedService.seed(payload, confirmation=self.confirmation)
        self.assertEqual(result["planned_records"], {"create": 0, "reuse": 0})
        self.assertFalse(result["boundary_checked"])
        with self.assertRaisesMessage(ValidationError, "No reviewed directions"):
            TransitSeedService.seed(payload, confirmation=self.confirmation, apply=True)
        catalog = json.loads((data_path / "cebu_city_route_candidates.json").read_text())
        with self.assertRaises(ValidationError):
            TransitSeedService.seed(catalog, confirmation=self.confirmation)

    def test_command_preview_apply_and_malformed_files(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "seed.json"
            path.write_text(json.dumps(self.payload), encoding="utf-8")
            output = StringIO()
            call_command(
                "seed_cebu_city_transit", dataset=path, confirm_database=self.confirmation,
                stdout=output, stderr=StringIO(),
            )
            self.assertFalse(json.loads(output.getvalue())["applied"])
            self.assertEqual(TransitPoint.objects.count(), 0)
            output = StringIO()
            call_command(
                "seed_cebu_city_transit", dataset=path, confirm_database=self.confirmation,
                apply=True, stdout=output, stderr=StringIO(),
            )
            self.assertTrue(json.loads(output.getvalue())["applied"])
            for contents in ('{"kind": 1, "kind": 2}', '{broken', '{"kind": NaN}'):
                path.write_text(contents, encoding="utf-8")
                with self.assertRaises(CommandError):
                    call_command("seed_cebu_city_transit", dataset=path, confirm_database=self.confirmation)
            with self.assertRaises(CommandError):
                call_command(
                    "seed_cebu_city_transit", dataset=Path(directory) / "missing",
                    confirm_database=self.confirmation,
                )

    def test_command_rejects_oversized_files_without_database_writes(self):
        before = self.snapshot()
        with TemporaryDirectory() as directory:
            path = Path(directory) / "oversized.json"
            path.write_text(json.dumps(self.payload), encoding="utf-8-sig")
            with patch("apps.transit.management.commands.seed_cebu_city_transit.MAX_DATASET_BYTES", 10):
                with self.assertRaises(CommandError):
                    call_command("seed_cebu_city_transit", dataset=path, confirm_database=self.confirmation)
        self.assertEqual(self.snapshot(), before)

    def test_export_preserves_geometry_and_requires_new_review(self):
        self.seed(apply=True)
        variant = JeepneyRouteVariant.objects.get()
        before = self.snapshot()
        payload = TransitSeedExportService.export([variant.pk], confirmation=self.confirmation)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(
            payload["routes"][0]["variants"][0]["geometry"],
            self.payload["routes"][0]["variants"][0]["geometry"],
        )
        self.assertEqual(payload["routes"][0]["variants"][0]["review"]["status"], "needs_review")
        self.assertEqual(payload["routes"][0]["variants"][0]["source_ids"], [])
        serializer = TransitSeedDatasetSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        output = StringIO()
        call_command(
            "export_transit_seed_draft", variant_id=[variant.pk],
            confirm_database=self.confirmation, stdout=output, stderr=StringIO(),
        )
        self.assertEqual(json.loads(output.getvalue()), payload)
        for ids in ([variant.pk, variant.pk], [999999]):
            with self.assertRaises(ValidationError):
                TransitSeedExportService.export(ids, confirmation=self.confirmation)
        payload["sources"] = copy.deepcopy(self.payload["sources"])
        direction = payload["routes"][0]["variants"][0]
        direction["source_ids"] = ["test-evidence"]
        direction["review"] = copy.deepcopy(self.payload["routes"][0]["variants"][0]["review"])
        replay = TransitSeedService.seed(payload, confirmation=self.confirmation, apply=True)
        self.assertEqual(replay["planned_records"], {"create": 0, "reuse": 8})
        self.assertEqual(self.snapshot(), before)

    def test_imported_direction_is_retrievable_by_real_search_and_map(self):
        self.seed(apply=True)
        owner = User.objects.create_user(
            email="seed-test@example.com", password=None, USER_FNAME="Synthetic",
            USER_LNAME="Owner", USER_ROLE=User.UserRole.MERCHANT,
            USER_REPUTATION=User._meta.get_field("USER_REPUTATION").get_default(),
        )
        category = Category.objects.create(
            CTGRY_NAME="Test", CLUS_ID=Cluster.objects.create(CLUS_NAME="Test"),
        )
        location = Location.objects.create(
            LOCT_ADDRESS="Synthetic test destination", LOCT_POINT=Point(123.91, 10.3102, srid=4326),
        )
        business = Business.objects.create(
            USER_ID=owner, CTGRY_ID=category, LOCT_ID=location,
            BUSN_NAME="Synthetic destination", BUSN_CONTACT_NUMBER="09000000000",
        )
        result = DirectJourneyService.search_direct_journeys(business.pk, 10.31, 123.89)
        self.assertIsNone(result["reason"])
        journey = result["route_options"][0]["recommended_journey"]
        self.assertEqual(journey["jeepney_route_code"], "TEST-CITY")
        mapped = DirectJourneyMapService.get_map_guidance(
            business_id=business.pk, route_variant_id=journey["route_variant_id"],
            boarding_transit_point_id=journey["boarding_transit_point"]["id"],
            alighting_transit_point_id=journey["alighting_transit_point"]["id"],
        )
        self.assertEqual(
            mapped["journey"]["ride"]["selected_segment_geometry"],
            self.payload["routes"][0]["variants"][0]["geometry"],
        )
        location.LOCT_POINT = Point(123.89, 10.3102, srid=4326)
        location.save(update_fields=["LOCT_POINT"])
        reverse = DirectJourneyService.search_direct_journeys(business.pk, 10.31, 123.91)
        self.assertEqual(reverse["reason"], "no_direct_route_match")
