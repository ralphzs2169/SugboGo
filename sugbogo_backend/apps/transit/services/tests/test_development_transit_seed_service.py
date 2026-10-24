"""Exercise guarded fixtures through the real ORM, PostGIS search and passenger APIs."""

from io import StringIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from apps.business.models import Business, BusinessLandmark, Category, Cluster, Location
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.transit.services.development_transit_seed_service import (
    PREFIX,
    DevelopmentTransitSeedService,
)
from apps.transit.services.direct_journey_map_service import DirectJourneyMapService
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.users.models import User


@override_settings(DEBUG=True)
class DevelopmentTransitSeedTests(TestCase):
    """Verify seed safety and observable baseline behavior without external services."""

    @staticmethod
    def snapshot():
        """Capture seed-owned table contents including IDs and update timestamps."""
        return {
            model.__name__: list(model.objects.order_by("pk").values())
            for model in (
                User, Cluster, Category, Location, Business, BusinessLandmark,
                JeepneyRoute, JeepneyRouteVariant, TransitPoint, RouteTransitPoint,
            )
        }

    @staticmethod
    def seed(**options):
        """Apply only to the actual isolated Django test database."""
        return DevelopmentTransitSeedService.seed(
            confirmation=str(connection.settings_dict["NAME"]),
            apply=True,
            **options,
        )

    @staticmethod
    def search(case):
        """Run the unchanged direct search against a command-provided scenario."""
        return DirectJourneyService.search_direct_journeys(
            case["business_id"], case["latitude"], case["longitude"],
        )

    def test_preview_and_default_command_write_no_rows(self):
        before = self.snapshot()
        output = StringIO()
        call_command(
            "seed_transit_direct_baseline",
            confirm_database=str(connection.settings_dict["NAME"]),
            stdout=output,
        )
        self.assertIn('"applied": false', output.getvalue())
        self.assertIn("Preview only", output.getvalue())
        self.assertEqual(self.snapshot(), before)

    def test_creates_complete_minimum_network_and_destinations(self):
        result = self.seed()
        self.assertTrue(result["applied"])
        self.assertEqual(result["created"], 26)
        self.assertEqual(result["reused"], 0)
        self.assertEqual(JeepneyRoute.objects.count(), 2)
        self.assertEqual(JeepneyRouteVariant.objects.count(), 2)
        self.assertEqual(TransitPoint.objects.count(), 5)
        self.assertEqual(RouteTransitPoint.objects.count(), 5)
        self.assertEqual(Business.objects.count(), 3)
        self.assertEqual(BusinessLandmark.objects.count(), 1)
        self.assertTrue(all(not owner.has_usable_password() for owner in User.objects.all()))
        self.assertFalse(Business.objects.filter(BUSN_IS_VERIFIED=True).exists())

    def test_repeat_run_preserves_ids_values_and_timestamps(self):
        first = self.seed()
        before = self.snapshot()
        second = self.seed()
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["reused"], first["created"])
        self.assertEqual(second["scenarios"], first["scenarios"])
        self.assertEqual(self.snapshot(), before)

    def test_debug_false_is_rejected_before_database_queries(self):
        with override_settings(DEBUG=False), self.assertNumQueries(0):
            with self.assertRaises(PermissionDenied):
                self.seed()

    def test_wrong_database_confirmation_is_rejected_before_queries(self):
        with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
            DevelopmentTransitSeedService.seed(confirmation="wrong", apply=True)

    def test_ordinary_database_remote_host_and_non_postgis_are_rejected(self):
        for field, value in (
            ("NAME", "sugbogo"),
            ("HOST", "production.example.com"),
            ("ENGINE", "django.db.backends.postgresql"),
        ):
            with self.subTest(field=field):
                with patch.dict(connection.settings_dict, {field: value}):
                    with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                        self.seed()

    def test_dedicated_database_name_is_accepted_for_preview_without_queries(self):
        with patch.dict(connection.settings_dict, {"NAME": "sugbogo_transit_dev"}):
            with self.assertNumQueries(0):
                result = DevelopmentTransitSeedService.seed(
                    confirmation="sugbogo_transit_dev",
                )
        self.assertFalse(result["applied"])

    def test_reserved_point_collision_rolls_back_every_insert(self):
        TransitPoint.objects.create(
            TRPT_NAME=f"{PREFIX} B", TRPT_POINT=Point(123.8, 10.4, srid=4326),
        )
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed()
        self.assertEqual(self.snapshot(), before)

    def test_duplicate_reserved_point_names_are_not_claimed(self):
        for _ in range(2):
            TransitPoint.objects.create(
                TRPT_NAME=f"{PREFIX} B", TRPT_POINT=Point(123.9, 10.31, srid=4326),
            )
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed()
        self.assertEqual(self.snapshot(), before)

    def test_existing_edits_are_not_reset_on_rerun(self):
        self.seed()
        business = Business.objects.get(BUSN_NAME=f"{PREFIX} Forward")
        business.BUSN_DESCRIPTION = "A developer edited this fixture; do not overwrite it."
        business.save()
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed()
        self.assertEqual(self.snapshot(), before)

    def test_extra_route_membership_is_not_silently_deleted(self):
        self.seed()
        variant = JeepneyRouteVariant.objects.get(JRT_ID__JRT_CODE="DEV-DIR")
        RouteTransitPoint.objects.create(
            JRV_ID=variant,
            TRPT_ID=TransitPoint.objects.get(TRPT_NAME=f"{PREFIX} D"),
            RVTP_SEQUENCE=4,
        )
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed()
        self.assertEqual(self.snapshot(), before)

    def test_unrelated_transit_record_is_preserved(self):
        route = JeepneyRoute.objects.create(JRT_CODE="KEEP-ME")
        before = (route.pk, route.JRT_CREATED_AT, route.JRT_UPDATED_AT)
        self.seed()
        route.refresh_from_db()
        self.assertEqual(before, (route.pk, route.JRT_CREATED_AT, route.JRT_UPDATED_AT))

    def test_existing_empty_reserved_route_is_not_adopted(self):
        JeepneyRoute.objects.create(JRT_CODE="DEV-DIR")
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed()
        self.assertEqual(self.snapshot(), before)

    def test_reserved_owner_with_a_usable_password_is_not_adopted(self):
        self.seed()
        owner = User.objects.get(USER_EMAIL="transit-baseline-forward@sugbogo.invalid")
        owner.set_password("NotASeededLogin123!")
        owner.save()
        before = self.snapshot()
        with self.assertRaises(ValidationError):
            self.seed()
        self.assertEqual(self.snapshot(), before)

    def test_forward_scenario_returns_expected_direction_and_landmark(self):
        result = self.search(self.seed()["scenarios"][0])
        self.assertIsNone(result["reason"])
        self.assertEqual(len(result["route_options"]), 1)
        option = result["route_options"][0]
        self.assertEqual(option["jeepney_route_code"], "DEV-DIR")
        journey = option["recommended_journey"]
        self.assertEqual(journey["boarding_sequence"], 1)
        self.assertEqual(journey["alighting_sequence"], 3)
        self.assertGreater(journey["approximate_ride_distance_meters"], 2000)
        self.assertEqual(journey["landmark_context"]["name"], f"{PREFIX} Entrance Marker")

    def test_reverse_and_disconnected_scenarios_have_candidates_but_no_match(self):
        cases = self.seed()["scenarios"]
        for case in cases[1:]:
            with self.subTest(destination=case["destination"]):
                result = self.search(case)
                self.assertEqual(result, {"route_options": [], "reason": "no_direct_route_match"})

    def test_distant_origin_returns_no_nearby_boarding_point(self):
        case = self.seed()["scenarios"][0]
        case.update(latitude=10.35, longitude=123.88)
        self.assertEqual(self.search(case)["reason"], "no_nearby_boarding_point")

    def test_real_search_and_map_endpoints_use_the_same_seeded_journey(self):
        case = self.seed()["scenarios"][0]
        client = APIClient()
        client.force_authenticate(Business.objects.get(pk=case["business_id"]).USER_ID)
        base = f'/api/explorer/explore/businesses/{case["business_id"]}/direct-journeys/'
        response = client.get(base, {"latitude": case["latitude"], "longitude": case["longitude"]})
        self.assertEqual(response.status_code, 200)
        journey = response.data["data"]["route_options"][0]["recommended_journey"]
        params = {
            "route_variant_id": journey["route_variant_id"],
            "boarding_transit_point_id": journey["boarding_transit_point"]["id"],
            "alighting_transit_point_id": journey["alighting_transit_point"]["id"],
        }
        response = client.get(base + "map/", params)
        self.assertEqual(response.status_code, 200)
        mapped = response.data["data"]["journey"]
        self.assertEqual(mapped["jeepney_route_code"], "DEV-DIR")
        self.assertEqual(mapped["ride"]["selected_segment_geometry"][0], {
            "latitude": 10.31, "longitude": 123.89,
        })
        self.assertEqual(mapped["ride"]["selected_segment_geometry"][-1], {
            "latitude": 10.31, "longitude": 123.91,
        })
        for case in DevelopmentTransitSeedService._scenarios({
            label: Business.objects.get(BUSN_NAME=f"{PREFIX} {label}")
            for label in ("Forward", "Reverse", "Disconnected")
        })[1:]:
            response = client.get(
                f'/api/explorer/explore/businesses/{case["business_id"]}/direct-journeys/',
                {"latitude": case["latitude"], "longitude": case["longitude"]},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"], {
                "route_options": [], "reason": "no_direct_route_match",
            })
        self.assertEqual(client.get(base).status_code, 400)
        client.force_authenticate(user=None)
        self.assertEqual(client.get(base, params).status_code, 401)

    def test_map_rejects_reversed_membership_order(self):
        self.seed()
        variant = JeepneyRouteVariant.objects.get(JRT_ID__JRT_CODE="DEV-DIR")
        with self.assertRaises(ValidationError):
            DirectJourneyMapService.get_map_guidance(
                business_id=Business.objects.get(BUSN_NAME=f"{PREFIX} Reverse").pk,
                route_variant_id=variant.pk,
                boarding_transit_point_id=variant.JRV_DESTINATION_ID_id,
                alighting_transit_point_id=variant.JRV_ORIGIN_ID_id,
            )

    def test_apply_command_prints_reusable_business_ids_and_errors_are_controlled(self):
        output = StringIO()
        call_command(
            "seed_transit_direct_baseline", apply=True,
            confirm_database=str(connection.settings_dict["NAME"]), stdout=output,
        )
        self.assertIn('"applied": true', output.getvalue())
        self.assertNotIn('"business_id": null', output.getvalue())
        before = self.snapshot()
        with self.assertRaises(CommandError):
            call_command("seed_transit_direct_baseline", apply=True, confirm_database="wrong")
        self.assertEqual(self.snapshot(), before)
