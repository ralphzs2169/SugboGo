import json
import requests
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import LineString, MultiPolygon, Point, Polygon
from django.core import signing
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.explorer_operations.explore_businesses.services import experimental_itinerary_service as service
from apps.business.models import ServiceableBoundary
from apps.shared.services.google_maps_service import GoogleMapsService, GoogleNearbyLandmark
from apps.shared.services.google_routes_service import GoogleWalkingResult, GoogleWalkingRoute, GoogleWalkingStatus
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.transit.services.coordinate_journey_service import CoordinateJourneyService
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.transit.services.pedestrian_access_service import AccessUse
from apps.transit.services.route_connection_service import RouteConnectionBudgetExceeded, RouteConnectionService
from apps.users.models import User


@override_settings(
    EXPERIMENTAL_ITINERARIES_ENABLED=True,
    EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=False,
    EXPERIMENTAL_ITINERARY_EXPLORER_IDS=("501", "502", "503"),
    EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE="[]",
    EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE="[]",
)
class ExperimentalItineraryViewTests(TestCase):
    def setUp(self):
        self.enterContext(patch.object(ScopedRateThrottle, "THROTTLE_RATES", {
            "experimental_itinerary_search": "100/min",
            "experimental_itinerary_detail": "100/min",
        }))
        self.client = APIClient()
        self.client.force_authenticate(self._user())
        self.base = "/api/explorer/explore/businesses/21/itineraries/v1/"
        self.origin = Point(123.901, 10.310, srid=4326)
        ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City",
            SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=MultiPolygon(Polygon.from_bbox((123, 10, 124, 11)), srid=4326),
        )
        self.variants = [
            self._variant("A", (123.900, 10.310), (123.920, 10.310)),
            self._variant("B", (123.920, 10.310), (123.920, 10.330)),
            self._variant("C", (123.920, 10.330), (123.940, 10.330)),
        ]
        self.destination = self.enterContext(patch.object(DirectJourneyService, "_get_destination_context"))
        self.destination.return_value = (Point(123.938, 10.330, srid=4326), 100)
        self.provider = self.enterContext(patch(
            "apps.shared.services.google_routes_service.GoogleRoutesService.compute_walking_route",
            side_effect=self._mapped_walk,
        ))
        self.places = self.enterContext(patch(
            "apps.shared.services.google_maps_service.GoogleMapsService.search_transit_landmark",
            return_value=GoogleNearbyLandmark(
                place_id="fixture-place",
                name="Synthetic landmark",
                address="Fixture street",
                latitude=10.310,
                longitude=123.901,
                distance_meters=10,
                attributions=(("Fixture provider", "https://example.com/provider"),),
            ),
        ))
        self.enterContext(patch("requests.Session.request", side_effect=AssertionError("Network requests are forbidden.")))
        self.enterContext(patch.object(
            service,
            "EVALUATION_LIMITS",
            replace(service.EVALUATION_LIMITS, provider_request_window_seconds=None),
        ))

    def _user(self, pk=501, role=User.UserRole.EXPLORER):
        return SimpleNamespace(pk=pk, is_active=True, is_authenticated=True, USER_ROLE=role)

    def _variant(
        self,
        code,
        start,
        end,
        *,
        with_memberships=True,
    ):
        route = JeepneyRoute.objects.create(JRT_CODE=code)
        origin = TransitPoint.objects.create(TRPT_NAME=f"{code} start", TRPT_POINT=Point(*start, srid=4326))
        destination = TransitPoint.objects.create(TRPT_NAME=f"{code} end", TRPT_POINT=Point(*end, srid=4326))
        variant = JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=origin,
            JRV_DESTINATION_ID=destination,
            JRV_GEOMETRY=LineString(start, end, srid=4326),
        )
        if with_memberships:
            RouteTransitPoint.objects.bulk_create([
                RouteTransitPoint(JRV_ID=variant, TRPT_ID=origin, RVTP_SEQUENCE=1),
                RouteTransitPoint(JRV_ID=variant, TRPT_ID=destination, RVTP_SEQUENCE=2),
            ])
        return variant

    def _mapped_walk(self, **kwargs):
        origin = (kwargs["origin_latitude"], kwargs["origin_longitude"])
        destination = (kwargs["destination_latitude"], kwargs["destination_longitude"])
        return GoogleWalkingResult(
            GoogleWalkingStatus.AVAILABLE,
            GoogleWalkingRoute(
                distance_meters=100,
                duration_seconds=80,
                encoded_polyline="provider-polyline",
                start_location=origin,
                end_location=destination,
                warnings=("Mocked Google walking warning",),
            ),
        )

    def _search(self, **overrides):
        return self.client.post(
            self.base + "search/",
            {"latitude": self.origin.y, "longitude": self.origin.x, "max_transfers": 2, **overrides},
            format="json",
        )

    def _detail(self, selection):
        return self.client.post(self.base + "detail/", {"selection": selection}, format="json")

    def test_direct_one_and_two_transfer_contracts_use_directional_geometry(self):
        for latitude, longitude, codes in (
            (10.310, 123.917, ["A"]),
            (10.328, 123.920, ["A", "B"]),
            (10.330, 123.938, ["A", "B", "C"]),
        ):
            self.destination.return_value = (Point(longitude, latitude, srid=4326), 100)
            count = len(codes) - 1
            response = self._search(max_transfers=count)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertIn("no-store", response.headers["Cache-Control"])
            search = response.data["data"]
            option = search["options"][0]
            self.assertEqual(option["route_sequence"], codes)
            self.assertEqual(option["transfer_count"], count)
            self.assertFalse(option["passenger_ready"])
            selection = signing.loads(option["selection"], salt=service.SELECTION_SALT)
            self.assertNotIn("provider-polyline", repr(selection))
            response = self._detail(option["selection"])
            self.assertEqual(response.status_code, 200, response.data)
            self.assertIn("no-store", response.headers["Cache-Control"])
            detail = response.data["data"]
            self.assertEqual(detail["origin"], search["origin"])
            self.assertEqual(detail["destination"], search["destination"])
            self.assertEqual([leg["route_code"] for leg in detail["ride_legs"]], codes)
            self.assertEqual(len(detail["transfers"]), count)
            for leg in detail["ride_legs"]:
                self.assertEqual(leg["direction"]["toward"], f'{leg["route_code"]} end')
                self.assertEqual(leg["boarding"]["coordinate_status"], "provisional")
                self.assertLess(leg["boarding"]["route_position"]["fraction"], leg["alighting"]["route_position"]["fraction"])
                self.assertGreaterEqual(len(leg["geometry"]), 2)
            self.assertIsNone(detail["access_walk"]["mapped_distance_meters"])
            self.assertEqual(detail["access_walk"]["status"], "not_evaluated")
            self.assertEqual(detail["guidance_mode"], "geometry")
            self.provider.assert_not_called()
            self.assertEqual(detail["ride_legs"][0]["boarding"]["landmark"]["attributions"][0]["name"], "Fixture provider")

    def test_flag_authentication_role_and_allowlist_gate_both_endpoints(self):
        with override_settings(EXPERIMENTAL_ITINERARIES_ENABLED=False):
            self.assertEqual(self._search().status_code, 404)
            self.assertEqual(self._detail("sample").status_code, 404)
        for user, status in (
            (None, 401),
            (self._user(role=User.UserRole.MERCHANT), 403),
            (self._user(pk=700), 403),
        ):
            self.client.force_authenticate(user)
            self.assertEqual(self._search().status_code, status)
            self.assertEqual(self._detail("sample").status_code, status)
        self.provider.assert_not_called()

    @override_settings(DEBUG=True, EXPERIMENTAL_ITINERARY_EXPLORER_IDS=())
    def test_debug_allows_active_explorer_with_empty_allowlist_on_search_and_detail(self):
        self.client.force_authenticate(self._user(pk=700))
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)

        response = self._search(max_transfers=0)
        self.assertEqual(response.status_code, 200, response.data)
        selection = response.data["data"]["options"][0]["selection"]
        detail = self._detail(selection)
        self.assertEqual(detail.status_code, 200, detail.data)

    @override_settings(DEBUG=False)
    def test_non_debug_requires_allowlist_for_search_and_detail(self):
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)
        response = self._search(max_transfers=0)
        self.assertEqual(response.status_code, 200, response.data)
        selection = response.data["data"]["options"][0]["selection"]
        self.assertEqual(self._detail(selection).status_code, 200)

        self.client.force_authenticate(self._user(pk=700))
        self.provider.reset_mock()
        for allowlist in ((), ("501",)):
            with self.subTest(allowlist=allowlist), override_settings(
                EXPERIMENTAL_ITINERARY_EXPLORER_IDS=allowlist,
            ):
                self.assertEqual(self._search().status_code, 403)
                self.assertEqual(self._detail(selection).status_code, 403)
        self.provider.assert_not_called()

    def test_debug_exception_preserves_authentication_active_account_and_explorer_role(self):
        inactive = self._user()
        inactive.is_active = False
        for debug in (True, False):
            with self.subTest(debug=debug), override_settings(DEBUG=debug):
                for user, expected in (
                    (None, 401),
                    (inactive, 403),
                    (self._user(role=User.UserRole.MERCHANT), 403),
                    (self._user(role=User.UserRole.ADMIN), 403),
                ):
                    with self.subTest(user=user):
                        self.client.force_authenticate(user)
                        self.assertEqual(self._search().status_code, expected)
                        self.assertEqual(self._detail("sample").status_code, expected)
        self.provider.assert_not_called()

    def test_feature_switch_disables_both_endpoints_with_and_without_debug(self):
        for debug in (True, False):
            with self.subTest(debug=debug), override_settings(
                DEBUG=debug,
                EXPERIMENTAL_ITINERARIES_ENABLED=False,
            ):
                self.assertEqual(self._search().status_code, 404)
                self.assertEqual(self._detail("sample").status_code, 404)
        self.provider.assert_not_called()

    def test_rejects_bad_inputs_foreign_selections_and_expiration(self):
        for fields in ({"latitude": "NaN"}, {"longitude": 190}, {"max_transfers": 3}):
            response = self._search(**fields)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data["code"], "VALIDATION_ERROR")
        self.assertEqual(self._detail("bad-token").status_code, 404)
        token = self._search().data["data"]["options"][0]["selection"]
        self.client.force_authenticate(self._user(pk=502))
        self.assertEqual(self._detail(token).status_code, 404)
        self.client.force_authenticate(self._user())
        with patch.object(service, "SELECTION_MAX_AGE_SECONDS", -1):
            self.assertEqual(self._detail(token).status_code, 410)
        response = self.client.post(self.base.replace("/21/", "/22/") + "detail/", {"selection": token})
        self.assertEqual(response.status_code, 404)

    def test_bulk_geometry_change_and_destination_move_make_selection_stale(self):
        token = self._search().data["data"]["options"][0]["selection"]
        with patch.object(self.destination, "return_value", (Point(123.939, 10.330, srid=4326), 100)):
            self.assertEqual(self._detail(token).status_code, 409)
        JeepneyRouteVariant.objects.filter(pk=self.variants[1].pk).update(JRV_GEOMETRY=LineString(
            (123.920, 10.310),
            (123.921, 10.320),
            (123.920, 10.330),
            srid=4326,
        ))
        self.provider.reset_mock()
        response = self._detail(token)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "STALE_ITINERARY")
        self.provider.assert_not_called()

    def test_forward_route_with_no_memberships_is_eligible_on_search_and_detail(self):
        variant = self._variant(
            "GEO",
            (123.950, 10.350),
            (123.970, 10.350),
            with_memberships=False,
        )
        self.origin = Point(123.952, 10.350, srid=4326)
        self.destination.return_value = (Point(123.967, 10.350, srid=4326), 100)
        self.assertFalse(variant.route_transit_points.exists())

        with CaptureQueriesContext(connection) as queries:
            option = self._search(max_transfers=0).data["data"]["options"][0]
            detail = self._detail(option["selection"]).data["data"]

        self.assertFalse(any("ROUTE_TRANSIT_POINT" in query["sql"] for query in queries))
        self.assertEqual(option["route_sequence"], ["GEO"])
        self.assertEqual(option["route_alignment_status"], "unreviewed")
        self.assertFalse(option["passenger_ready"])
        self.assertGreater(detail["ride_legs"][0]["ride_distance_meters"], 25)
        self.assertLess(
            detail["ride_legs"][0]["boarding"]["route_position"]["fraction"],
            detail["ride_legs"][0]["alighting"]["route_position"]["fraction"],
        )

    def test_legacy_stop_edits_leave_geometry_and_existing_selection_eligible(self):
        option = self._search().data["data"]["options"][0]
        original = self._detail(option["selection"]).data["data"]["ride_legs"][1]
        variant = self.variants[1]
        RouteTransitPoint.objects.filter(JRV_ID=variant).delete()
        TransitPoint.objects.filter(pk=variant.JRV_DESTINATION_ID_id).update(
            TRPT_NAME="Updated terminal label",
            TRPT_POINT=Point(123.940, 10.340, srid=4326),
        )
        variant.save(update_fields=["JRV_UPDATED_AT"])

        response = self._detail(option["selection"])
        self.assertEqual(response.status_code, 200, response.data)
        ride = response.data["data"]["ride_legs"][1]
        self.assertEqual(ride["geometry_revision"], original["geometry_revision"])
        self.assertEqual(ride["geometry"], original["geometry"])
        self.assertEqual(ride["direction"]["toward"], "Updated terminal label")

    def test_self_intersecting_geometry_is_excluded_and_selection_is_stale(self):
        token = self._search().data["data"]["options"][0]["selection"]
        JeepneyRouteVariant.objects.filter(pk=self.variants[1].pk).update(
            JRV_GEOMETRY=LineString(
                (123.920, 10.310),
                (123.925, 10.330),
                (123.925, 10.310),
                (123.920, 10.330),
                srid=4326,
            ),
        )
        self.provider.reset_mock()
        result = self._search().data["data"]
        self.assertEqual(result["options"], [])
        self.assertEqual(result["coverage"]["variants_excluded_by_spatial_validation"], 1)
        self.assertEqual(self._detail(token).status_code, 409)
        self.provider.assert_not_called()

    def test_itineraries_are_available_without_an_active_serviceable_boundary(self):
        ServiceableBoundary.objects.update(SBND_IS_ACTIVE=False)
        response = self._search()

        self.assertEqual(response.status_code, 200, response.data)
        result = response.data["data"]
        self.assertTrue(result["options"])
        self.assertEqual(result["coverage"]["variants_excluded_by_spatial_validation"], 0)
        self.assertEqual(self._detail(result["options"][0]["selection"]).status_code, 200)

    def test_curved_ride_detail_preserves_vertices_between_ordered_positions(self):
        curve = (123.910, 10.312)
        JeepneyRouteVariant.objects.filter(pk=self.variants[0].pk).update(
            JRV_GEOMETRY=LineString((123.900, 10.310), curve, (123.920, 10.310), srid=4326),
        )
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)
        option = self._search(max_transfers=0).data["data"]["options"][0]
        ride = self._detail(option["selection"]).data["data"]["ride_legs"][0]

        self.assertEqual(len(ride["geometry"]), 3)
        self.assertEqual(ride["geometry"][1], {"longitude": curve[0], "latitude": curve[1]})
        for index, endpoint in ((0, "boarding"), (-1, "alighting")):
            point = ride[endpoint]["route_position"]
            self.assertEqual(
                ride["geometry"][index],
                {"longitude": point["longitude"], "latitude": point["latitude"]},
            )
        self.assertLess(ride["boarding"]["route_position"]["fraction"], ride["alighting"]["route_position"]["fraction"])

    def test_search_detail_distance_parity_batches_nonzero_access_and_transfer_gaps(self):
        self.origin = Point(123.901, 10.3105, srid=4326)
        JeepneyRouteVariant.objects.filter(pk=self.variants[1].pk).update(
            JRV_GEOMETRY=LineString((123.9203, 10.3104), (123.9203, 10.330), srid=4326),
        )
        JeepneyRouteVariant.objects.filter(pk=self.variants[2].pk).update(
            JRV_GEOMETRY=LineString((123.9207, 10.3304), (123.940, 10.3304), srid=4326),
        )
        for point, depth in (
            ((123.917, 10.311), 0),
            ((123.9208, 10.328), 1),
            ((123.938, 10.331), 2),
        ):
            with self.subTest(depth=depth):
                self.destination.return_value = (Point(*point, srid=4326), 100)
                search = self._search(max_transfers=depth).data["data"]
                option = search["options"][0]
                self.assertEqual(option["transfer_count"], depth)
                payload = signing.loads(option["selection"], salt=service.SELECTION_SALT)
                with CaptureQueriesContext(connection) as queries:
                    response = self._detail(option["selection"])
                self.assertEqual(response.status_code, 200, response.data)
                detail = response.data["data"]
                self.assertEqual(detail["rank"], option["rank"])
                self.assertEqual(
                    [leg["route_code"] for leg in detail["ride_legs"]],
                    option["route_sequence"],
                )
                self.assertAlmostEqual(
                    detail["totals"]["straight_line_walking_distance_meters"],
                    option["straight_line_walking_distance_meters"],
                    places=6,
                )
                self.assertAlmostEqual(
                    detail["totals"]["ranking_cost_meters"],
                    option["ranking_cost_meters"],
                    places=6,
                )
                self.assertEqual(
                    detail["totals"]["ride_distance_meters"],
                    option["ride_distance_meters"],
                )
                self.assertEqual(
                    detail["totals"]["transfer_penalty_meters"],
                    depth * 100,
                )
                for signed, leg in zip(payload["legs"], detail["ride_legs"], strict=True):
                    self.assertEqual(leg["variant_id"], signed[0])
                    self.assertEqual(
                        leg["boarding"]["route_position"]["fraction"],
                        signed[1],
                    )
                    self.assertEqual(
                        leg["alighting"]["route_position"]["fraction"],
                        signed[2],
                    )
                    self.assertGreaterEqual(leg["ride_distance_meters"], 25)
                batches = [
                    query
                    for query in queries
                    if "AS points(start_wkt, end_wkt, position)" in query["sql"]
                ]
                self.assertEqual(len(batches), 1)
                walks = [
                    detail["access_walk"],
                    *[
                        transfer["walk"]
                        for transfer in detail["transfers"]
                    ],
                    detail["egress_walk"],
                ]
                spherical_cost = sum(
                    GoogleMapsService.calculate_distance_meters(
                        walk["from"]["latitude"],
                        walk["from"]["longitude"],
                        walk["to"]["latitude"],
                        walk["to"]["longitude"],
                    )
                    for walk in walks
                ) + depth * 100
                self.assertNotAlmostEqual(
                    spherical_cost,
                    option["ranking_cost_meters"],
                    places=4,
                )
                print(
                    f"Distance parity depth={depth}: search={option['ranking_cost_meters']:.9f}, "
                    f"previous_spherical={spherical_cost:.9f}, detail={detail['totals']['ranking_cost_meters']:.9f}",
                )

    def test_candidate_budget_reports_incomplete_search_instead_of_no_routes(self):
        search = CoordinateJourneyService.search

        def limited_search(**kwargs):
            kwargs["limits"] = replace(kwargs["limits"], maximum_search_work=1)
            return search(**kwargs)

        with patch.object(CoordinateJourneyService, "search", side_effect=limited_search):
            result = self._search().data["data"]
        self.assertEqual(result["options"], [])
        self.assertEqual(result["reason"], "search_incomplete")
        self.assertEqual(result["coverage"]["incomplete_reason"], "candidate_budget")
        self.assertTrue(result["coverage"]["alternatives_unchecked"])
        self.provider.assert_not_called()

    def test_connection_budget_keeps_completed_direct_candidates(self):
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)
        with patch.object(RouteConnectionService, "discover", side_effect=RouteConnectionBudgetExceeded):
            result = self._search().data["data"]
        self.assertEqual(result["options"][0]["route_sequence"], ["A"])
        self.assertIsNone(result["reason"])
        self.assertEqual(result["coverage"]["incomplete_reason"], "connection_budget")

    def test_sql_timeout_keeps_direct_selection_and_existing_incomplete_contract(self):
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)

        def cancel_discovery(**kwargs):
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '1ms'")
                cursor.execute("SELECT pg_sleep(0.05)")

        with patch.object(RouteConnectionService, "discover", side_effect=cancel_discovery):
            response = self._search()
        self.assertEqual(response.status_code, 200)
        result = response.data["data"]
        self.assertEqual(result["options"][0]["route_sequence"], ["A"])
        self.assertIsNone(result["reason"])
        self.assertEqual(result["coverage"]["incomplete_reason"], "connection_budget")
        self.assertTrue(result["coverage"]["alternatives_unchecked"])
        detail = self.client.post(
            self.base + "detail/",
            {"selection": result["options"][0]["selection"]},
            format="json",
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["data"]["transfer_count"], 0)
        self.provider.assert_not_called()

    def test_sql_timeout_without_direct_candidates_reports_incomplete_search(self):
        def cancel_discovery(**kwargs):
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '1ms'")
                cursor.execute("SELECT pg_sleep(0.05)")

        with patch.object(RouteConnectionService, "discover", side_effect=cancel_discovery):
            response = self._search()
        self.assertEqual(response.status_code, 200)
        result = response.data["data"]
        self.assertEqual(result["options"], [])
        self.assertEqual(result["reason"], "search_incomplete")
        self.assertEqual(result["coverage"]["incomplete_reason"], "connection_budget")
        self.assertTrue(result["coverage"]["alternatives_unchecked"])
        self.provider.assert_not_called()

    def test_ride_measurement_timeout_reports_incomplete_candidate_evaluation(self):
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)

        def cancel_measurement(**kwargs):
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '1ms'")
                cursor.execute("SELECT pg_sleep(0.05)")

        with patch(
            "apps.transit.services.coordinate_journey_service.measure_journey_rides",
            side_effect=cancel_measurement,
        ):
            response = self._search()

        self.assertEqual(response.status_code, 200)
        result = response.data["data"]
        self.assertEqual(result["options"], [])
        self.assertEqual(result["reason"], "search_incomplete")
        self.assertEqual(result["coverage"]["incomplete_reason"], "candidate_budget")
        self.assertTrue(result["coverage"]["alternatives_unchecked"])
        self.provider.assert_not_called()

    def test_terminal_mismatch_allows_forward_return_as_geometry_preview(self):
        reverse = self._variant("REV", (123.920, 10.310), (123.900, 10.310))
        TransitPoint.objects.filter(pk=reverse.JRV_DESTINATION_ID_id).update(
            TRPT_POINT=Point(123.896, 10.316, srid=4326),
        )
        self.origin = Point(123.917, 10.310, srid=4326)
        self.destination.return_value = (Point(123.901, 10.310, srid=4326), 100)

        for cap in range(3):
            with self.subTest(cap=cap):
                response = self._search(max_transfers=cap)
                self.assertEqual(response.status_code, 200, response.data)
                result = response.data["data"]
                option = result["options"][0]
                self.assertEqual(option["route_sequence"], ["REV"])
                self.assertEqual(option["route_alignment_status"], "unreviewed")
                self.assertFalse(option["passenger_ready"])
                self.assertIsNone(result["reason"])
                self.assertEqual(result["coverage"]["variants_excluded_by_spatial_validation"], 0)
                self.assertIsNone(result["coverage"]["incomplete_reason"])

    def test_empty_reason_distinguishes_endpoints_direction_and_minimum_ride(self):
        for origin, destination, reason, validation_stage in (
            ((123.970, 10.350), (123.917, 10.310), "no_route_near_origin", None),
            ((123.901, 10.310), (123.970, 10.350), "no_route_near_destination", None),
            ((123.917, 10.310), (123.901, 10.310), "no_forward_journey", None),
            ((123.901, 10.310), (123.90105, 10.310), "candidate_excluded_by_validation", "minimum_ride_distance"),
        ):
            with self.subTest(reason=reason, validation_stage=validation_stage):
                self.destination.return_value = (Point(*destination, srid=4326), 100)
                result = self._search(
                    latitude=origin[1],
                    longitude=origin[0],
                    max_transfers=0,
                ).data["data"]
                self.assertEqual(result["reason"], reason)
                self.assertEqual(result["validation_stage"], validation_stage)
        self.provider.assert_not_called()

    def test_direct_options_survive_cheaper_transfers_and_partial_expansion(self):
        self.origin = Point(123.951, 10.350, srid=4326)
        self.destination.return_value = (Point(123.969, 10.350, srid=4326), 100)
        self._variant("DIR", (123.950, 10.354), (123.970, 10.354))
        self._variant("X", (123.950, 10.350), (123.960, 10.350))
        self._variant("Y", (123.960, 10.350), (123.970, 10.350))
        search = CoordinateJourneyService.search

        def limited_search(**kwargs):
            kwargs["limits"] = replace(kwargs["limits"], maximum_journeys=1)
            return search(**kwargs)

        with (
            patch.object(CoordinateJourneyService, "search", side_effect=limited_search),
            patch.object(service, "EVALUATION_LIMITS", replace(service.EVALUATION_LIMITS, maximum_candidates=1)),
        ):
            for cap in range(3):
                with self.subTest(cap=cap):
                    result = self._search(max_transfers=cap).data["data"]
                    routes = [option["route_sequence"] for option in result["options"]]
                    self.assertIn(["DIR"], routes)
                    if cap:
                        self.assertIn(["X", "Y"], routes)
                    self.assertLessEqual(self.provider.call_count, service.EVALUATION_LIMITS.maximum_walking_requests)
                    self.provider.reset_mock()

        def partial_search(**kwargs):
            kwargs["limits"] = replace(kwargs["limits"], maximum_search_work=1)
            return search(**kwargs)

        with patch.object(CoordinateJourneyService, "search", side_effect=partial_search):
            result = self._search(max_transfers=2).data["data"]
        self.assertEqual(result["coverage"]["incomplete_reason"], "candidate_budget")
        self.assertEqual([option["route_sequence"] for option in result["options"]], [["DIR"]])

    def test_provider_failure_is_distinct_from_empty_and_provisional_results(self):
        empty = self._search(max_transfers=0).data["data"]
        self.assertEqual(empty["reason"], "no_forward_journey")
        self.assertEqual(empty["options"], [])
        self.provider.assert_not_called()
        self.provider.side_effect = None
        self.provider.return_value = GoogleWalkingResult(
            GoogleWalkingStatus.TIMEOUT,
            diagnostic_code="request_timeout",
        )
        response = self._search()
        self.assertEqual(response.status_code, 200, response.data)
        search = response.data["data"]
        self.assertIsNone(search["reason"])
        self.assertFalse(search["coverage"]["walking_provider_unavailable"])
        candidate = search["options"][0]
        detail = self._detail(candidate["selection"]).data["data"]
        self.assertFalse(candidate["passenger_ready"])
        self.assertFalse(candidate["has_blocking_evidence"])
        self.assertEqual(detail["transfers"][0]["validation_status"], "provisional")
        self.assertEqual(detail["access_walk"]["status"], "not_evaluated")
        self.assertIsNone(detail["access_walk"]["diagnostic_code"])
        self.provider.assert_not_called()
        self.assertIsNone(detail["access_walk"]["mapped_distance_meters"])

    def test_geometry_ranking_is_deterministic_and_independent_of_google_walking(self):
        for index in range(4):
            latitude = 10.310 + 0.0003 * (index + 1)
            self._variant(f"ALT{index}", (123.900, latitude), (123.920, latitude))
        self.destination.return_value = (Point(123.917, 10.310, srid=4326), 100)
        self.provider.side_effect = AssertionError("Geometric guidance must not request walking routes.")
        first = self._search(max_transfers=0).data["data"]
        second = self._search(max_transfers=0).data["data"]
        self.assertEqual(first["options"][0]["route_sequence"], ["A"])
        self.assertEqual(
            [option["route_sequence"] for option in first["options"]],
            [option["route_sequence"] for option in second["options"]],
        )
        self.assertEqual(
            len({tuple(option["route_sequence"]) for option in first["options"]}),
            len(first["options"]),
        )
        self.assertTrue(first["coverage"]["alternatives_unchecked"])
        self.provider.assert_not_called()
        self.places.assert_not_called()

    def test_geometric_preview_retains_distinct_transfer_areas(self):
        result = self._search().data["data"]
        details = [
            self._detail(option["selection"]).data["data"]
            for option in result["options"]
        ]
        for index, first in enumerate(details):
            for second in details[index + 1:]:
                if [ride["variant_id"] for ride in first["ride_legs"]] != [
                    ride["variant_id"] for ride in second["ride_legs"]
                ]:
                    continue
                gaps = [
                    service._distance(
                        Point(
                            before[action]["route_position"]["longitude"],
                            before[action]["route_position"]["latitude"],
                            srid=4326,
                        ),
                        Point(
                            after[action]["route_position"]["longitude"],
                            after[action]["route_position"]["latitude"],
                            srid=4326,
                        ),
                    )
                    for before, after in zip(first["ride_legs"], second["ride_legs"], strict=True)
                    for action in ("boarding", "alighting")
                ]
                self.assertGreater(max(gaps), service.CONNECTION_AREA_METERS)
        self.provider.assert_not_called()

    def test_places_absence_or_failure_preserves_geometry_and_coordinates(self):
        option = self._search().data["data"]["options"][0]
        for unavailable in (None, requests.Timeout("fixture timeout")):
            self.places.reset_mock()
            self.places.side_effect = unavailable
            self.places.return_value = None
            response = self._detail(option["selection"])
            self.assertEqual(response.status_code, 200, response.data)
            detail = response.data["data"]
            self.assertFalse(detail["passenger_ready"])
            for ride in detail["ride_legs"]:
                self.assertIsNone(ride["boarding"]["landmark"])
                self.assertIsNone(ride["alighting"]["landmark"])
                self.assertEqual(
                    ride["geometry"][0]["latitude"],
                    ride["boarding"]["route_position"]["latitude"],
                )
                self.assertEqual(
                    ride["geometry"][-1]["longitude"],
                    ride["alighting"]["route_position"]["longitude"],
                )
            self.assertLessEqual(self.places.call_count, 6)
        self.provider.assert_not_called()

    def test_passenger_ready_requires_independent_evidence_and_changes_invalidate_selection(self):
        sample = self._search().data["data"]["options"][0]
        payload = signing.loads(sample["selection"], salt=service.SELECTION_SALT)
        evidence = []
        revisions = dict(payload["variants"])
        variants = {variant.pk: variant for variant in self.variants}
        for variant_id, boarding, alighting in payload["legs"]:
            for fraction, use in ((boarding, AccessUse.BOARDING), (alighting, AccessUse.ALIGHTING)):
                position = variants[variant_id].JRV_GEOMETRY.interpolate_normalized(fraction)
                evidence.append({
                    "variant_id": variant_id,
                    "geometry_revision": revisions[variant_id],
                    "fraction": fraction,
                    "use": use,
                    "latitude": position.y + 0.00002,
                    "longitude": position.x,
                    "coordinate_verified": True,
                    "permission": "permitted",
                })
        with override_settings(EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE=json.dumps(evidence)):
            self.assertEqual(self._detail(sample["selection"]).status_code, 409)
            option = self._search().data["data"]["options"][0]
            detail = self._detail(option["selection"]).data["data"]
            self.assertFalse(option["passenger_access_verified"])
            self.assertFalse(detail["transfers"][0]["passenger_access_verified"])
            self.assertFalse(option["passenger_ready"])
            self.assertFalse(detail["passenger_ready"])
            self.assertFalse(detail["transfers"][0]["passenger_ready"])
            reviews = [
                {
                    "variant_id": variant_id,
                    "geometry_revision": revision,
                    "alignment_status": "reviewed",
                    "provenance": "Synthetic field review",
                }
                for variant_id, revision in revisions.items()
            ]
            with override_settings(EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE=json.dumps(reviews)):
                self.assertEqual(self._detail(option["selection"]).status_code, 409)
                reviewed = self._search().data["data"]["options"][0]
                detail = self._detail(reviewed["selection"]).data["data"]
                self.assertFalse(reviewed["passenger_ready"])
                self.assertEqual(reviewed["route_alignment_status"], "reviewed")
                self.assertFalse(detail["passenger_ready"])
                self.assertFalse(detail["transfers"][0]["passenger_ready"])
                self.assertEqual(detail["ride_legs"][0]["route_provenance"], "Synthetic field review")
            self.assertEqual(self._detail(reviewed["selection"]).status_code, 409)
