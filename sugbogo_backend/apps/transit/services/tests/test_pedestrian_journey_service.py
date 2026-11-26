import json
from dataclasses import replace
from unittest.mock import patch

import requests
from django.contrib.gis.geos import LineString, Point
from django.test import TestCase, override_settings

from apps.shared.services.google_routes_service import GoogleRoutesService, GoogleWalkingStatus
from apps.transit.services.coordinate_journey_service import (
    CoordinateJourneySearchLimits,
    CoordinateJourneyService,
)
from apps.transit.services.pedestrian_access_service import (
    AccessCoordinateStatus,
    AccessLocationEvidence,
    AccessPermission,
    AccessUse,
    access_location_key,
)
from apps.transit.services.pedestrian_journey_service import (
    PedestrianEvaluationLimits,
    PedestrianJourneyService,
    WalkingEvaluationStatus,
)
from apps.transit.services.route_connection_service import RouteConnectionService, TransferValidationStatus


def _point(
    x,
    y,
):
    return Point(123.900 + x, 10.310 + y, srid=4326)


def _line(*coordinates):
    return LineString(
        [
            _point(*coordinate).coords
            for coordinate in coordinates
        ],
        srid=4326,
    )


def _response(
    payload,
    status=200,
):
    result = requests.Response()
    result.status_code = status
    result._content = json.dumps(payload).encode()
    return result


@override_settings(GOOGLE_MAPS_API_KEY="test-pedestrian-key")
class PedestrianJourneyServiceTests(TestCase):
    def test_offset_candidates_can_resolve_blocked_nearest_access_with_bounded_requests(self):
        origin = _point(0.002, 0.0002)
        destination = _point(0.008, 0.0002)
        routes = {1: self.routes[1]}
        ordinary = CoordinateJourneyService.search(
            origin=origin,
            destination=destination,
            route_geometries=routes,
            route_codes={1: "A"},
            limits=CoordinateJourneySearchLimits(max_transfers=0),
        )
        self.assertEqual(len(ordinary), 1)
        first = ordinary[0].ride_legs[0]
        self.walk_distances[(origin.coords, first.boarding_position.point.coords)] = 1379
        candidates = CoordinateJourneyService.search(
            origin=origin,
            destination=destination,
            route_geometries=routes,
            route_codes={1: "A"},
            include_access_alternatives=True,
            limits=CoordinateJourneySearchLimits(max_transfers=0),
        )
        self.assertGreater(len(candidates), 1)
        results = PedestrianJourneyService.evaluate_candidates(
            journeys=candidates,
            origin=origin,
            destination=destination,
            evaluation_limits=PedestrianEvaluationLimits(maximum_candidates=6, maximum_landmark_requests=0),
        )
        self.assertFalse(results[0].has_blocking_evidence)
        self.assertFalse(results[0].passenger_ready)
        blocked = next(result for result in results if result.has_blocking_evidence)
        self.assertEqual(blocked.access_walk.status, WalkingEvaluationStatus.DISTANCE_LIMIT)
        self.assertEqual(blocked.access_walk.route.distance_meters, 1379)
        self.assertEqual(blocked.access_walk.distance_limit_meters, 800)
        self.assertLessEqual(len(self.walk_requests), 12)
        for result in results:
            leg = result.journey.ride_legs[0]
            self.assertLess(leg.boarding_position.fraction, leg.alighting_position.fraction)
            self.assertGreaterEqual(leg.ride_distance_meters, 25)

    def setUp(self):
        self.routes = {
            1: _line((0, 0), (0.010, 0)),
            2: _line((0.010, 0), (0.010, 0.010)),
            3: _line((0.010, 0.010), (0.020, 0.010)),
        }
        self.origin = _point(0.001, 0)
        self.destination = _point(0.010, 0.008)
        self.search_limits = CoordinateJourneySearchLimits(
            maximum_access_distance_meters=45,
            maximum_egress_distance_meters=45,
        )
        self.walk_requests = []
        self.places_requests = []
        self.failures = {}
        self.walk_distances = {}
        self.places = []
        self.enterContext(patch("requests.post", side_effect=self._post))

    def _post(
        self,
        url,
        **kwargs,
    ):
        payload = kwargs["json"]
        if url == GoogleRoutesService.COMPUTE_ROUTES_URL:
            start = payload["origin"]["location"]["latLng"]
            end = payload["destination"]["location"]["latLng"]
            key = (
                (start["longitude"], start["latitude"]),
                (end["longitude"], end["latitude"]),
            )
            self.walk_requests.append(key)
            if key in self.failures:
                response = self.failures[key]
                if isinstance(response, Exception):
                    raise response
                return response
            distance = self.walk_distances.get(key, 0 if start == end else 60)
            return _response({
                "routes": [{
                    "distanceMeters": distance,
                    "duration": f"{distance}s",
                    "polyline": {"encodedPolyline": "mock-walk"},
                    "legs": [{
                        "startLocation": {"latLng": start},
                        "endLocation": {"latLng": end},
                    }],
                }],
            })

        self.assertEqual(url, "https://places.googleapis.com/v1/places:searchNearby")
        center = payload["locationRestriction"]["circle"]["center"]
        self.places_requests.append((center["longitude"], center["latitude"]))
        return _response({"places": self.places})

    def _input(self, **overrides):
        options = {
            "origin": self.origin,
            "destination": self.destination,
            "route_geometries": self.routes,
            "search_limits": self.search_limits,
        }
        options.update(overrides)
        options["route_codes"] = {
            variant_id: str(variant_id)
            for variant_id in options["route_geometries"]
        }
        return options

    def _geometry(self, **overrides):
        options = self._input(**overrides)
        limits = options.pop("search_limits")
        return CoordinateJourneyService.search(
            **options,
            allow_provisional_transfers=True,
            limits=limits,
        )

    def _verified_evidence(self, journeys):
        evidence = {}
        for journey in journeys:
            for leg in journey.ride_legs:
                for use, position, offset in (
                    (AccessUse.BOARDING, leg.boarding_position, 0.00002),
                    (AccessUse.ALIGHTING, leg.alighting_position, -0.00002),
                ):
                    evidence[access_location_key(leg.variant_id, position, use)] = AccessLocationEvidence(
                        point=Point(position.point.x, position.point.y + offset, srid=4326),
                        coordinate_verified=True,
                        permission=AccessPermission.PERMITTED,
                    )
        return evidence

    def _transfer_points(
        self,
        connection,
        evidence,
    ):
        alighting = evidence[access_location_key(
            connection.from_variant_id,
            connection.alighting_position,
            AccessUse.ALIGHTING,
        )]
        boarding = evidence[access_location_key(
            connection.to_variant_id,
            connection.boarding_position,
            AccessUse.BOARDING,
        )]
        return alighting.point.coords, boarding.point.coords

    def test_validated_transfer_uses_distinct_access_locations_and_retains_landmarks(self):
        geometric = self._geometry()
        evidence = self._verified_evidence(geometric)
        self.places = [{
            "id": "landmark",
            "displayName": {"text": "Community Hospital"},
            "primaryType": "hospital",
            "location": {"longitude": 123.910, "latitude": 10.31005},
        }]

        (result,) = PedestrianJourneyService.search(**self._input(), access_evidence=evidence)

        self.assertTrue(result.passenger_ready)
        self.assertEqual(result.mapped_walking_distance_meters, 180)
        self.assertAlmostEqual(result.ranking_cost_meters, 280)
        self.assertEqual(len(self.walk_requests), 3)
        self.assertEqual(result.journey, geometric[0])
        self.assertEqual(result.transfers[0].connection.validation_status, TransferValidationStatus.PEDESTRIAN_VALIDATED)
        self.assertTrue(result.transfers[0].passenger_ready)
        self.assertEqual(self.walk_requests[1], self._transfer_points(geometric[0].transfers[0], evidence))
        self.assertEqual(result.ride_access[0].alighting_landmark.name, "Community Hospital")
        self.assertNotEqual(
            result.ride_access[0].alighting.point.y,
            result.ride_access[0].alighting_landmark.latitude,
        )

    def test_two_transfers_evaluate_all_four_walks_in_travel_order(self):
        destination = _point(0.017, 0.010)
        geometry = self._geometry(destination=destination)

        (result,) = PedestrianJourneyService.search(
            **self._input(destination=destination),
            access_evidence=self._verified_evidence(geometry),
        )

        self.assertTrue(result.passenger_ready)
        self.assertEqual([leg.variant_id for leg in result.journey.ride_legs], [1, 2, 3])
        self.assertEqual(len(result.transfers), 2)
        self.assertEqual(len(result.walks), 4)
        self.assertEqual(len(self.walk_requests), 4)
        self.assertEqual(result.mapped_walking_distance_meters, 240)
        self.assertEqual(result.ranking_cost_meters, 440)
        self.assertTrue(all(transfer.passenger_ready for transfer in result.transfers))
        self.assertLess(
            result.journey.ride_legs[1].boarding_position.fraction,
            result.journey.ride_legs[1].alighting_position.fraction,
        )
        self.assertTrue(all(
            ride.boarding_landmark is None and ride.alighting_landmark is None
            for ride in result.ride_access
        ))

    def test_direct_search_spends_its_shortlist_on_independently_verified_access(self):
        routes = {1: self.routes[1], 4: self.routes[1]}
        options = {
            "destination": _point(0.008, 0),
            "route_geometries": routes,
            "search_limits": replace(self.search_limits, max_transfers=0),
        }
        first, second = self._geometry(**options)
        self.assertEqual(first.ride_legs[0].variant_id, 1)

        (result,) = PedestrianJourneyService.search(
            **self._input(**options),
            access_evidence=self._verified_evidence([second]),
            evaluation_limits=PedestrianEvaluationLimits(maximum_candidates=1),
        )

        self.assertEqual(result.journey, second)
        self.assertTrue(result.passenger_ready)
        self.assertEqual(result.transfers, ())
        self.assertEqual(result.mapped_walking_distance_meters, 120)
        self.assertEqual(len(self.walk_requests), 2)

    def test_no_mapped_transfer_stays_distinct_from_provider_failure(self):
        (geometric,) = self._geometry()
        evidence = self._verified_evidence([geometric])
        transfer = self._transfer_points(geometric.transfers[0], evidence)
        for failure, expected, blocking in (
            (_response({}), GoogleWalkingStatus.NO_ROUTE, True),
            (requests.Timeout("timeout"), GoogleWalkingStatus.TIMEOUT, False),
            (_response({"error": {"status": "RESOURCE_EXHAUSTED"}}, 429), GoogleWalkingStatus.QUOTA_OR_BILLING, False),
        ):
            with self.subTest(expected=expected):
                self.walk_requests.clear()
                self.failures[transfer] = failure
                (result,) = PedestrianJourneyService.search(**self._input(), access_evidence=evidence)

                self.assertEqual(result.transfers[0].walking.status, expected)
                self.assertEqual(result.has_blocking_evidence, blocking)
                self.assertEqual(result.transfers[0].connection.validation_status, TransferValidationStatus.PROVISIONAL)
                self.assertFalse(result.passenger_ready)
                self.assertIsNone(result.mapped_walking_distance_meters)
                if expected is GoogleWalkingStatus.QUOTA_OR_BILLING:
                    self.assertEqual(len(self.walk_requests), 2)
                    self.assertEqual(result.egress_walk.status, GoogleWalkingStatus.QUOTA_OR_BILLING)

    def test_google_connectivity_cannot_verify_centerline_or_grant_permission(self):
        (provisional,) = PedestrianJourneyService.search(**self._input())

        self.assertEqual(provisional.ride_access[0].boarding.coordinate_status, AccessCoordinateStatus.PROVISIONAL)
        self.assertEqual(provisional.ride_access[0].boarding.point, provisional.journey.ride_legs[0].boarding_position.point)
        self.assertEqual(provisional.transfers[0].walking.status, GoogleWalkingStatus.AVAILABLE)
        self.assertFalse(provisional.transfers[0].passenger_ready)
        self.assertFalse(provisional.passenger_ready)

        evidence = {
            key: replace(record, permission=AccessPermission.UNKNOWN)
            for key, record in self._verified_evidence([provisional.journey]).items()
        }
        (mapped,) = PedestrianJourneyService.search(**self._input(), access_evidence=evidence)

        self.assertEqual(mapped.transfers[0].connection.validation_status, TransferValidationStatus.PEDESTRIAN_VALIDATED)
        self.assertFalse(mapped.transfers[0].passenger_ready)
        self.assertFalse(mapped.passenger_ready)

    def test_known_prohibition_or_invalid_access_prevents_provider_calls(self):
        (journey,) = self._geometry()
        key = access_location_key(1, journey.ride_legs[0].boarding_position, AccessUse.BOARDING)
        for evidence, expected in (
            (AccessLocationEvidence(permission=AccessPermission.PROHIBITED), WalkingEvaluationStatus.PROHIBITED_ACCESS),
            (
                AccessLocationEvidence(
                    point=_point(0.001, 0.001),
                    coordinate_verified=True,
                    permission=AccessPermission.PERMITTED,
                ),
                GoogleWalkingStatus.INVALID_COORDINATES,
            ),
            (
                AccessLocationEvidence(
                    point=Point(123.901, 95, srid=4326),
                    coordinate_verified=True,
                    permission=AccessPermission.PERMITTED,
                ),
                GoogleWalkingStatus.INVALID_COORDINATES,
            ),
        ):
            with self.subTest(expected=expected, evidence=evidence):
                (result,) = PedestrianJourneyService.search(**self._input(), access_evidence={key: evidence})
                self.assertEqual(result.access_walk.status, expected)
                self.assertFalse(result.passenger_ready)
                self.assertEqual(
                    result.ride_access[0].boarding.route_position,
                    journey.ride_legs[0].boarding_position,
                )
        self.assertEqual(self.walk_requests, [])
        self.assertEqual(self.places_requests, [])

    def test_walking_distance_limit_retains_provider_data_without_promoting_the_link(self):
        (journey,) = self._geometry()
        evidence = self._verified_evidence([journey])
        self.walk_distances[self._transfer_points(journey.transfers[0], evidence)] = 500

        (result,) = PedestrianJourneyService.search(**self._input(), access_evidence=evidence)

        transfer = result.transfers[0]
        self.assertEqual(transfer.walking.status, WalkingEvaluationStatus.DISTANCE_LIMIT)
        self.assertEqual(transfer.walking.route.distance_meters, 500)
        self.assertIsNone(transfer.walking.mapped_distance_meters)
        self.assertFalse(transfer.passenger_ready)

    def test_network_distances_rerank_distinct_corridors_and_deduplicate_shared_walks(self):
        routes = {
            1: self.routes[1],
            2: _line((0.003, -0.005), (0.003, 0.005), (0.007, 0.005), (0.007, -0.005)),
        }
        connections = RouteConnectionService.discover(
            route_geometries=routes,
            maximum_transfer_distance_meters=15,
            maximum_candidates_per_area=1,
        )
        options = {
            "route_geometries": routes,
            "destination": _point(0.007, -0.004),
            "connections": connections,
        }
        first, second = self._geometry(**options)
        evidence = self._verified_evidence([first, second])
        self.walk_distances[self._transfer_points(first.transfers[0], evidence)] = 180
        self.walk_distances[self._transfer_points(second.transfers[0], evidence)] = 40

        results = PedestrianJourneyService.search(
            **self._input(**options),
            access_evidence=evidence,
            evaluation_limits=PedestrianEvaluationLimits(maximum_candidates=2),
        )

        self.assertEqual([result.journey for result in results], [second, first])
        self.assertEqual([result.mapped_walking_distance_meters for result in results], [160, 300])
        self.assertEqual(len(self.walk_requests), 4)
        self.walk_requests.clear()
        again = PedestrianJourneyService.search(
            **self._input(**{**options, "connections": list(reversed(connections))}),
            access_evidence=evidence,
            evaluation_limits=PedestrianEvaluationLimits(maximum_candidates=2),
        )
        self.assertEqual(again, results)
        self.assertEqual(len(self.walk_requests), 4)

    def test_request_budgets_stop_outbound_calls_and_keep_unknown_walk_status(self):
        (result,) = PedestrianJourneyService.search(
            **self._input(),
            evaluation_limits=PedestrianEvaluationLimits(
                maximum_walking_requests=1,
                maximum_landmark_requests=1,
            ),
        )

        self.assertEqual(len(self.walk_requests), 1)
        self.assertEqual(len(self.places_requests), 1)
        self.assertEqual(result.access_walk.status, GoogleWalkingStatus.AVAILABLE)
        self.assertEqual(result.transfers[0].walking.status, WalkingEvaluationStatus.BUDGET_EXHAUSTED)
        self.assertEqual(result.egress_walk.status, WalkingEvaluationStatus.BUDGET_EXHAUSTED)
        self.assertIsNone(result.mapped_walking_distance_meters)
        self.assertFalse(result.has_blocking_evidence)
