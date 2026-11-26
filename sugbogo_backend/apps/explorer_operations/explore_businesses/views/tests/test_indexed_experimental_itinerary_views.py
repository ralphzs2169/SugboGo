"""Exercise the opt-in managed graph through authenticated search and detail views."""

import json
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.request import Request, urlopen

from django.contrib.gis.geos import LineString, Point
from django.db import connection
from django.test import LiveServerTestCase, TestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.explorer_operations.explore_businesses.views.tests import test_experimental_itinerary_views as existing
from apps.transit.models import JeepneyRouteVariant, TransitPoint
from apps.transit.services import configured_development_connection_graph as graph_loader
from apps.transit.services.coordinate_journey_service import CoordinateJourneyService
from apps.transit.services.development_connection_graph_index import INDEX_NAME, DevelopmentConnectionGraphIndex
from apps.transit.services.route_connection_service import RouteConnectionService
from apps.transit.services.tests.test_development_connection_graph_index import write_fixture
from apps.users.models import User


@override_settings(
    DEBUG=True,
    EXPERIMENTAL_ITINERARIES_ENABLED=True,
    EXPERIMENTAL_ITINERARY_EXPLORER_IDS=("501", "502", "503"),
    EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=True,
    EXPERIMENTAL_ITINERARY_PRODUCTION_GRAPH_ENABLED=False,
    EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE="[]",
    EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE="[]",
)
class IndexedExperimentalItineraryViewTests(TestCase):
    """Reuse existing endpoint fixtures with deliberately different graph IDs."""

    _user = existing.ExperimentalItineraryViewTests._user
    _variant = existing.ExperimentalItineraryViewTests._variant
    _mapped_walk = existing.ExperimentalItineraryViewTests._mapped_walk
    _search = existing.ExperimentalItineraryViewTests._search
    _detail = existing.ExperimentalItineraryViewTests._detail

    def setUp(self):
        existing.ExperimentalItineraryViewTests.setUp(self)
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        graph_root = root / ".connection-graphs"
        graph_root.mkdir()
        variants = list(reversed(self.variants))
        routes = {
            index: variant.JRV_GEOMETRY
            for index, variant in enumerate(variants, start=1)
        }
        codes = {
            index: variant.JRT_ID.JRT_CODE
            for index, variant in enumerate(variants, start=1)
        }
        rows = [
            [
                source,
                target,
                1.0,
                routes[source].interpolate_normalized(1).ewkt,
                0.0,
                routes[target].interpolate_normalized(0).ewkt,
                0.0,
                "provisional",
            ]
            for source, target in ((3, 2), (2, 1))
        ]
        self.directory, _ = write_fixture(graph_root, routes, codes, rows)
        DevelopmentConnectionGraphIndex.publish(self.directory)
        self.index = DevelopmentConnectionGraphIndex(self.directory)
        self.enterContext(override_settings(
            BASE_DIR=root,
            EXPERIMENTAL_ITINERARY_GRAPH_REVISION=self.index.revision,
            EXPERIMENTAL_ITINERARY_GRAPH_SHA256=self.index.graph_sha256,
        ))
        graph_loader._reader.cache_clear()
        self.addCleanup(graph_loader._reader.cache_clear)
        self.discovery = self.enterContext(patch.object(
            RouteConnectionService,
            "discover",
            side_effect=AssertionError("Indexed searches must not discover connections."),
        ))

    def test_direct_one_and_required_two_transfer_search_detail_contract(self):
        for point, codes in (
            ((123.917, 10.310), ["A"]),
            ((123.920, 10.328), ["A", "B"]),
            ((123.938, 10.330), ["A", "B", "C"]),
        ):
            self.destination.return_value = (Point(*point, srid=4326), 100)
            depth = len(codes) - 1
            if depth == 2:
                shallow = self._search(max_transfers=1).data["data"]
                self.assertFalse(shallow["options"])
                self.assertEqual(shallow["reason"], "no_forward_journey")
            response = self._search(max_transfers=depth)
            self.assertEqual(response.status_code, 200, response.data)
            result = response.data["data"]
            self.assertEqual(result["options"][0]["route_sequence"], codes)
            self.assertIsNone(result["coverage"]["incomplete_reason"])
            self.assertEqual(result["coverage"]["variants_outside_graph"], [])
            self.assertEqual(result["coverage"]["graph_revision"], self.index.revision)
            detail = self._detail(result["options"][0]["selection"])
            self.assertEqual(detail.status_code, 200, detail.data)
            legs = detail.data["data"]["ride_legs"]
            self.assertEqual([leg["variant_id"] for leg in legs], [
                self.variants[index].pk
                for index in range(depth + 1)
            ])
            for leg in legs:
                self.assertLess(
                    leg["boarding"]["route_position"]["fraction"],
                    leg["alighting"]["route_position"]["fraction"],
                )
                self.assertGreaterEqual(leg["ride_distance_meters"], 25)
                self.assertGreaterEqual(len(leg["geometry"]), 2)
            self.assertFalse(detail.data["data"]["passenger_ready"])
            self.assertTrue(all(
                transfer["validation_status"] == "provisional"
                for transfer in detail.data["data"]["transfers"]
            ))
        self.discovery.assert_not_called()

    def test_extra_variants_retain_direct_rides_and_report_transfer_scope(self):
        extra = self._variant("D", (123.900, 10.310), (123.940, 10.330))
        self.destination.return_value = (Point(123.938, 10.329, srid=4326), 100)
        result = self._search().data["data"]
        self.assertEqual(result["coverage"]["variants_outside_graph"], [extra.pk])
        self.assertEqual(result["coverage"]["incomplete_reason"], "connection_budget")
        self.assertTrue(result["coverage"]["alternatives_unchecked"])
        direct = self._search(max_transfers=0).data["data"]
        self.assertIsNone(direct["coverage"]["incomplete_reason"])
        self.assertIn(["D"], [option["route_sequence"] for option in direct["options"]])

    def test_existing_ranking_places_less_access_transfer_above_direct(self):
        self.destination.return_value = (Point(123.920, 10.312, srid=4326), 100)
        result = self._search(max_transfers=1).data["data"]
        self.assertEqual(result["options"][0]["route_sequence"], ["A", "B"])
        direct = next(option for option in result["options"] if option["transfer_count"] == 0)
        transfer = result["options"][0]
        self.assertLess(transfer["ranking_cost_meters"], direct["ranking_cost_meters"])
        for option in (transfer, direct):
            self.assertAlmostEqual(
                option["ranking_cost_meters"],
                option["straight_line_walking_distance_meters"] + 100 * option["transfer_count"],
            )

    def test_disabled_switch_keeps_legacy_discovery_and_response_contract(self):
        with override_settings(EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=False):
            with patch.object(RouteConnectionService, "discover", return_value=[]) as discover:
                response = self._search()
        self.assertEqual(response.status_code, 200)
        discover.assert_called_once()
        self.assertNotIn("graph_revision", response.data["data"]["coverage"])

    def test_remote_database_configuration_is_rejected_before_graph_access(self):
        with patch.dict(connection.settings_dict, HOST="remote.example"):
            response = self._search()
        self.assertEqual(response.status_code, 503)
        self.discovery.assert_not_called()

    @override_settings(
        DEBUG=False,
        EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=False,
        EXPERIMENTAL_ITINERARY_PRODUCTION_GRAPH_ENABLED=True,
    )
    def test_production_volume_loads_the_pinned_index_with_debug_disabled(self):
        with (
            override_settings(RAILWAY_VOLUME_MOUNT_PATH=str(self.directory.parent)),
            patch.dict(connection.settings_dict, HOST="postgres.railway.internal"),
        ):
            response = self._search()

        self.assertEqual(response.status_code, 200, response.data)
        coverage = response.data["data"]["coverage"]
        self.assertEqual(coverage["graph_revision"], self.index.revision)
        self.assertEqual(coverage["graph_variant_count"], len(self.variants))
        self.assertEqual(coverage["variants_outside_graph"], [])
        self.discovery.assert_not_called()

    @override_settings(
        DEBUG=False,
        EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=False,
        EXPERIMENTAL_ITINERARY_PRODUCTION_GRAPH_ENABLED=True,
    )
    def test_production_graph_rejects_invalid_mounts_pins_and_modes(self):
        cases = (
            {"RAILWAY_VOLUME_MOUNT_PATH": ""},
            {"RAILWAY_VOLUME_MOUNT_PATH": "relative-graph-path"},
            {"RAILWAY_VOLUME_MOUNT_PATH": str(self.directory / "missing")},
            {"EXPERIMENTAL_ITINERARY_GRAPH_SHA256": "0" * 64},
            {"EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED": True},
            {"DEBUG": True},
        )
        with override_settings(RAILWAY_VOLUME_MOUNT_PATH=str(self.directory.parent)):
            for configuration in cases:
                with self.subTest(configuration=configuration), override_settings(**configuration):
                    response = self._search()
                self.assertEqual(response.status_code, 503, response.data)
                self.assertEqual(response.data["code"], "ITINERARY_GRAPH_UNAVAILABLE")
        self.discovery.assert_not_called()

    def test_budget_interruption_retains_direct_and_marks_partial_coverage(self):
        self.destination.return_value = (Point(123.920, 10.312, srid=4326), 100)
        original = CoordinateJourneyService.search

        def limited(**kwargs):
            kwargs["limits"] = replace(kwargs["limits"], maximum_search_work=1)
            return original(**kwargs)

        with patch.object(CoordinateJourneyService, "search", side_effect=limited):
            result = self._search().data["data"]
        self.assertTrue(result["options"])
        self.assertEqual(result["options"][0]["route_sequence"], ["A"])
        self.assertEqual(result["coverage"]["incomplete_reason"], "candidate_budget")
        self.assertTrue(result["coverage"]["alternatives_unchecked"])

    def test_no_forward_journey_is_complete_when_inventory_is_covered(self):
        self.origin = Point(123.938, 10.330, srid=4326)
        self.destination.return_value = (Point(123.901, 10.310, srid=4326), 100)
        result = self._search().data["data"]
        self.assertFalse(result["options"])
        self.assertEqual(result["reason"], "no_forward_journey")
        self.assertIsNone(result["coverage"]["incomplete_reason"])

    def test_graph_pins_and_local_only_guards_fail_closed(self):
        for settings in (
            {"DEBUG": False},
            {"EXPERIMENTAL_ITINERARY_GRAPH_REVISION": ""},
            {"EXPERIMENTAL_ITINERARY_GRAPH_REVISION": "f" * 64},
            {"EXPERIMENTAL_ITINERARY_GRAPH_SHA256": "0" * 64},
        ):
            with self.subTest(settings=settings), override_settings(**settings):
                response = self._search()
                self.assertEqual(response.status_code, 503, response.data)
                self.assertEqual(response.data["code"], "ITINERARY_GRAPH_UNAVAILABLE")
        self.discovery.assert_not_called()

    def test_missing_geometry_or_duplicate_mapping_fails_closed(self):
        variant = self.variants[0]
        with self.subTest(case="changed geometry"):
            JeepneyRouteVariant.objects.filter(pk=variant.pk).update(
                JRV_GEOMETRY=LineString((123.900, 10.310), (123.919, 10.310), srid=4326),
            )
            self.assertEqual(self._search().status_code, 503)
            variant.save()
        with self.subTest(case="ambiguous identity"):
            other_origin = TransitPoint.objects.create(
                TRPT_NAME="Duplicate geometry origin",
                TRPT_POINT=variant.JRV_GEOMETRY.interpolate_normalized(0),
            )
            JeepneyRouteVariant.objects.create(
                JRT_ID=variant.JRT_ID,
                JRV_ORIGIN_ID=other_origin,
                JRV_DESTINATION_ID=variant.JRV_DESTINATION_ID,
                JRV_GEOMETRY=variant.JRV_GEOMETRY,
            )
            self.assertEqual(self._search().status_code, 503)

    def test_corrupted_graph_and_missing_index_never_fall_back(self):
        for name in (INDEX_NAME, "graph.jsonl"):
            path = self.directory / name
            self.assertTrue(path.exists(), name)
            original = path.read_bytes()
            try:
                path.write_bytes(b"corrupt")
                graph_loader._reader.cache_clear()
                self.assertEqual(self._search().status_code, 503)
            finally:
                path.write_bytes(original)
        self.discovery.assert_not_called()

    def test_changed_artifact_after_cached_reader_fails_closed(self):
        self.assertEqual(self._search().status_code, 200)
        with (self.directory / "graph.jsonl").open("ab") as stream:
            stream.write(b"corrupt")
        self.assertEqual(self._search().status_code, 503)

    def test_changed_index_after_cached_reader_fails_closed(self):
        self.assertEqual(self._search().status_code, 200)
        (self.directory / INDEX_NAME).write_bytes(b"corrupt")
        self.assertEqual(self._search().status_code, 503)

    def test_signed_detail_rechecks_managed_geometry(self):
        result = self._search().data["data"]
        selection = result["options"][0]["selection"]
        JeepneyRouteVariant.objects.filter(pk=self.variants[0].pk).update(
            JRV_GEOMETRY=LineString((123.900, 10.310), (123.919, 10.310), srid=4326),
        )
        self.assertEqual(self._detail(selection).status_code, 409)


@override_settings(
    DEBUG=True,
    EXPERIMENTAL_ITINERARIES_ENABLED=True,
    EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=True,
    EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE="[]",
    EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE="[]",
)
class IndexedExperimentalItineraryHTTPTests(LiveServerTestCase):
    """Verify actual TCP HTTP and JWT authentication on a disposable fixture database."""

    setUp = IndexedExperimentalItineraryViewTests.setUp
    _user = IndexedExperimentalItineraryViewTests._user
    _variant = IndexedExperimentalItineraryViewTests._variant
    _mapped_walk = IndexedExperimentalItineraryViewTests._mapped_walk

    def test_http_direct_one_and_required_two_transfer_details(self):
        user = User.objects.create(
            USER_EMAIL="indexed-http-fixture@example.test",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        token = str(AccessToken.for_user(user))

        def post(
            action,
            payload,
        ):
            request = Request(
                self.live_server_url + self.base + action + "/",
                data=json.dumps(payload).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token,
                },
                method="POST",
            )
            with urlopen(request, timeout=20) as response:
                self.assertEqual(response.status, 200)
                return json.loads(response.read())["data"]

        for point, codes in (
            ((123.917, 10.310), ["A"]),
            ((123.920, 10.328), ["A", "B"]),
            ((123.938, 10.330), ["A", "B", "C"]),
        ):
            self.destination.return_value = (Point(*point, srid=4326), 100)
            depth = len(codes) - 1
            payload = {
                "latitude": self.origin.y,
                "longitude": self.origin.x,
                "max_transfers": depth,
            }
            if depth == 2:
                shallow = post("search", {**payload, "max_transfers": 1})
                self.assertEqual(shallow["options"], [])
                self.assertEqual(shallow["reason"], "no_forward_journey")
            result = post("search", payload)
            self.assertEqual(result["options"][0]["route_sequence"], codes)
            detail = post("detail", {"selection": result["options"][0]["selection"]})
            self.assertEqual([leg["route_code"] for leg in detail["ride_legs"]], codes)
            self.assertEqual(len(detail["transfers"]), depth)
            self.assertFalse(detail["passenger_ready"])
        self.discovery.assert_not_called()
