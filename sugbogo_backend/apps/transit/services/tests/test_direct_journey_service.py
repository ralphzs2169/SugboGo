from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import LineString, Point
from django.db import connection
from django.test import TestCase
from rest_framework.exceptions import NotFound

from apps.business.models import Business, Category, Cluster, Location
from apps.transit.constants import (
    DIRECT_ROUTE_RESULT_LIMIT,
    DIRECT_ROUTE_SEARCH_RADIUS_METERS,
)
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
)
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.users.models import User


class DirectJourneyServiceTests(TestCase):
    """Test PostGIS direct journey discovery, direction, distance, and ranking."""

    def setUp(self):
        """Create one active destination business with an authoritative location."""

        self.owner = User.objects.create_user(
            email="direct-routing-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Route",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Direct Routing Cluster",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Direct Routing Category",
            CLUS_ID=self.cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8980,
                10.3000,
                srid=4326,
            ),
            LOCT_ADDRESS="Direct Routing Destination",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Direct Routing Business",
            BUSN_DESCRIPTION="A destination used by direct routing tests.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        self.route_counter = 0

    def _create_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Create one managed WGS 84 Transit Point."""

        return TransitPoint.objects.create(
            TRPT_NAME=name,
            TRPT_POINT=Point(
                longitude,
                latitude,
                srid=4326,
            ),
        )

    def _create_variant(
        self,
        ordered_points,
        geometry=None,
        route_code=None,
    ):
        """Create one directional variant and its authoritative memberships."""

        self.route_counter += 1
        code = route_code or f"T{self.route_counter:02d}"
        route = JeepneyRoute.objects.create(
            JRT_CODE=code,
        )

        if geometry is None:
            geometry = [
                (
                    point.TRPT_POINT.x,
                    point.TRPT_POINT.y,
                )
                for point in ordered_points
            ]

        variant = JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=ordered_points[0],
            JRV_DESTINATION_ID=ordered_points[-1],
            JRV_GEOMETRY=LineString(
                *geometry,
                srid=4326,
            ),
        )

        RouteTransitPoint.objects.bulk_create(
            [
                RouteTransitPoint(
                    JRV_ID=variant,
                    TRPT_ID=point,
                    RVTP_SEQUENCE=sequence,
                )
                for sequence, point in enumerate(
                    ordered_points,
                    start=1,
                )
            ]
        )

        return variant

    def _set_destination(
        self,
        longitude,
        latitude,
    ):
        """Move the authoritative business destination for the next search."""

        self.location.LOCT_POINT = Point(
            longitude,
            latitude,
            srid=4326,
        )
        self.location.save(
            update_fields=[
                "LOCT_POINT",
                "LOCT_UPDATED_AT",
            ],
        )

    def _search(
        self,
        longitude,
        latitude,
    ):
        """Search direct journeys from one explorer location."""

        return DirectJourneyService.search_direct_journeys(
            business_id=self.business.BUSN_ID,
            latitude=latitude,
            longitude=longitude,
        )

    def test_points_inside_meter_radius_are_eligible_on_both_ends(self):
        """Include boarding and alighting infrastructure inside 500 meters."""

        boarding = self._create_point(
            "Eligible Boarding",
            123.8800,
            10.3000,
        )
        alighting = self._create_point(
            "Eligible Alighting",
            123.8980,
            10.3000,
        )
        self._create_variant(
            [
                boarding,
                alighting,
            ],
        )

        result = self._search(
            longitude=123.8808,
            latitude=10.3000,
        )

        self.assertEqual(
            DIRECT_ROUTE_SEARCH_RADIUS_METERS,
            500,
        )
        self.assertEqual(
            len(result["journeys"]),
            1,
        )
        self.assertLess(
            result["journeys"][0][
                "explorer_to_boarding_distance_meters"
            ],
            500,
        )
        self.assertLess(
            result["journeys"][0][
                "alighting_to_business_distance_meters"
            ],
            500,
        )

    def test_boarding_point_beyond_meter_radius_is_excluded(self):
        """Return the boarding reason when all source points exceed 500 meters."""

        boarding = self._create_point(
            "Far Boarding",
            123.8800,
            10.3000,
        )
        alighting = self._create_point(
            "Destination",
            123.8980,
            10.3000,
        )
        self._create_variant(
            [
                boarding,
                alighting,
            ],
        )

        result = self._search(
            longitude=123.8800,
            latitude=10.3060,
        )

        self.assertEqual(
            result,
            {
                "journeys": [],
                "reason": "no_nearby_boarding_point",
            },
        )

    def test_alighting_point_beyond_meter_radius_is_excluded(self):
        """Return the alighting reason when destination points exceed 500 meters."""

        boarding = self._create_point(
            "Boarding",
            123.8800,
            10.3000,
        )
        alighting = self._create_point(
            "Far Alighting",
            123.8980,
            10.3000,
        )
        self._create_variant(
            [
                boarding,
                alighting,
            ],
        )
        self._set_destination(
            longitude=123.8980,
            latitude=10.3060,
        )

        result = self._search(
            longitude=123.8800,
            latitude=10.3000,
        )

        self.assertEqual(
            result,
            {
                "journeys": [],
                "reason": "no_nearby_alighting_point",
            },
        )

    def test_all_nearby_boarding_points_are_retained(self):
        """Evaluate every nearby membership instead of only the nearest point."""

        first_boarding = self._create_point(
            "First Boarding",
            123.8800,
            10.3000,
        )
        second_boarding = self._create_point(
            "Second Boarding",
            123.8820,
            10.3000,
        )
        alighting = self._create_point(
            "Alighting",
            123.8980,
            10.3000,
        )
        self._create_variant(
            [
                first_boarding,
                second_boarding,
                alighting,
            ],
        )

        result = self._search(
            longitude=123.8810,
            latitude=10.3000,
        )

        boarding_ids = {
            journey["boarding_transit_point"]["id"]
            for journey in result["journeys"]
        }
        self.assertEqual(
            boarding_ids,
            {
                first_boarding.TRPT_ID,
                second_boarding.TRPT_ID,
            },
        )

    def test_direction_uses_route_transit_point_sequence(self):
        """Allow increasing sequence travel and reject the reverse direction."""

        kamputhaw = self._create_point(
            "Kamputhaw",
            123.8800,
            10.3000,
        )
        capitol = self._create_point(
            "Capitol",
            123.8860,
            10.3000,
        )
        fuente = self._create_point(
            "Fuente",
            123.8920,
            10.3000,
        )
        colon = self._create_point(
            "Colon",
            123.8980,
            10.3000,
        )
        variant = self._create_variant(
            [
                kamputhaw,
                capitol,
                fuente,
                colon,
            ],
            route_code="14D",
        )

        forward = self._search(
            longitude=capitol.TRPT_POINT.x,
            latitude=capitol.TRPT_POINT.y,
        )

        self.assertEqual(
            forward["journeys"][0]["route_variant_id"],
            variant.JRV_ID,
        )
        self.assertEqual(
            forward["journeys"][0]["boarding_sequence"],
            2,
        )
        self.assertEqual(
            forward["journeys"][0]["alighting_sequence"],
            4,
        )

        self._set_destination(
            longitude=capitol.TRPT_POINT.x,
            latitude=capitol.TRPT_POINT.y,
        )
        reverse = self._search(
            longitude=colon.TRPT_POINT.x,
            latitude=colon.TRPT_POINT.y,
        )

        self.assertEqual(
            reverse["journeys"],
            [],
        )
        self.assertEqual(
            reverse["reason"],
            "no_direct_route_match",
        )

    def test_reverse_variant_supports_reverse_trip_independently(self):
        """Use a separate directional variant for travel in reverse."""

        capitol = self._create_point(
            "Capitol",
            123.8860,
            10.3000,
        )
        colon = self._create_point(
            "Colon",
            123.8980,
            10.3000,
        )
        reverse_variant = self._create_variant(
            [
                colon,
                capitol,
            ],
            geometry=[
                (123.8980, 10.3000),
                (123.8860, 10.3000),
            ],
            route_code="14D",
        )
        self._set_destination(
            longitude=capitol.TRPT_POINT.x,
            latitude=capitol.TRPT_POINT.y,
        )

        result = self._search(
            longitude=colon.TRPT_POINT.x,
            latitude=colon.TRPT_POINT.y,
        )

        self.assertEqual(
            result["journeys"][0]["route_variant_id"],
            reverse_variant.JRV_ID,
        )

    def test_same_boarding_and_alighting_membership_is_not_a_journey(self):
        """Exclude a candidate that would board and alight at one ordered point."""

        shared = self._create_point(
            "Shared Point",
            123.8800,
            10.3000,
        )
        far_end = self._create_point(
            "Far End",
            123.8860,
            10.3000,
        )
        self._create_variant(
            [
                shared,
                far_end,
            ],
        )
        self._set_destination(
            longitude=shared.TRPT_POINT.x,
            latitude=shared.TRPT_POINT.y,
        )

        result = self._search(
            longitude=shared.TRPT_POINT.x,
            latitude=shared.TRPT_POINT.y,
        )

        self.assertEqual(
            result["journeys"],
            [],
        )
        self.assertEqual(
            result["reason"],
            "no_direct_route_match",
        )

    def test_nearby_points_without_shared_variant_return_no_match(self):
        """Return no direct match when each end is served by different variants."""

        first_boarding = self._create_point(
            "First Boarding",
            123.8800,
            10.3000,
        )
        first_end = self._create_point(
            "First End",
            123.8860,
            10.3000,
        )
        second_start = self._create_point(
            "Second Start",
            123.8920,
            10.3000,
        )
        second_alighting = self._create_point(
            "Second Alighting",
            123.8980,
            10.3000,
        )
        self._create_variant(
            [
                first_boarding,
                first_end,
            ],
        )
        self._create_variant(
            [
                second_start,
                second_alighting,
            ],
        )

        result = self._search(
            longitude=first_boarding.TRPT_POINT.x,
            latitude=first_boarding.TRPT_POINT.y,
        )

        self.assertEqual(
            result,
            {
                "journeys": [],
                "reason": "no_direct_route_match",
            },
        )

    def test_ride_distance_uses_only_projected_linestring_segment(self):
        """Measure a curved partial route segment rather than endpoint straight line."""

        origin = self._create_point(
            "Origin",
            123.8740,
            10.3000,
        )
        boarding = self._create_point(
            "Boarding",
            123.8800,
            10.3000,
        )
        alighting = self._create_point(
            "Alighting",
            123.8980,
            10.3000,
        )
        variant = self._create_variant(
            [
                origin,
                boarding,
                alighting,
            ],
            geometry=[
                (123.8740, 10.3000),
                (123.8770, 10.3040),
                (123.8800, 10.3000),
                (123.8890, 10.3060),
                (123.8980, 10.3000),
            ],
        )

        result = self._search(
            longitude=boarding.TRPT_POINT.x,
            latitude=boarding.TRPT_POINT.y,
        )
        ride_distance = result["journeys"][0][
            "approximate_ride_distance_meters"
        ]

        with connection.cursor() as cursor:
            cursor.execute(
                """
                    SELECT
                        ST_Length(%s::geometry::geography),
                        ST_Distance(
                            %s::geometry::geography,
                            %s::geometry::geography
                        )
                """,
                [
                    variant.JRV_GEOMETRY.ewkt,
                    boarding.TRPT_POINT.ewkt,
                    alighting.TRPT_POINT.ewkt,
                ],
            )
            full_route_distance, straight_line_distance = cursor.fetchone()

        self.assertLess(
            ride_distance,
            full_route_distance,
        )
        self.assertGreater(
            ride_distance,
            straight_line_distance,
        )

    def test_distance_fields_and_total_are_meter_based(self):
        """Return access, egress, and their arithmetic total in meters."""

        boarding = self._create_point(
            "Boarding",
            123.8800,
            10.3000,
        )
        alighting = self._create_point(
            "Alighting",
            123.8980,
            10.3000,
        )
        self._create_variant(
            [
                boarding,
                alighting,
            ],
        )
        self._set_destination(
            longitude=123.8986,
            latitude=10.3000,
        )

        result = self._search(
            longitude=123.8805,
            latitude=10.3000,
        )
        journey = result["journeys"][0]
        expected_total = (
            journey["explorer_to_boarding_distance_meters"]
            + journey["alighting_to_business_distance_meters"]
        )

        self.assertGreater(
            journey["explorer_to_boarding_distance_meters"],
            40,
        )
        self.assertGreater(
            journey["alighting_to_business_distance_meters"],
            50,
        )
        self.assertAlmostEqual(
            journey["total_access_egress_distance_meters"],
            expected_total,
            places=5,
        )

    def test_ranking_prioritizes_access_then_ride_distance_and_stable_ids(self):
        """Apply explicit ranking criteria followed by deterministic identifiers."""

        close_boarding = self._create_point(
            "Close Boarding",
            123.8801,
            10.3000,
        )
        close_alighting = self._create_point(
            "Close Alighting",
            123.8979,
            10.3000,
        )
        farther_boarding = self._create_point(
            "Farther Boarding",
            123.8820,
            10.3000,
        )
        farther_alighting = self._create_point(
            "Farther Alighting",
            123.8960,
            10.3000,
        )
        close_access_variant = self._create_variant(
            [
                close_boarding,
                close_alighting,
            ],
            geometry=[
                (123.8801, 10.3000),
                (123.8890, 10.3080),
                (123.8979, 10.3000),
            ],
        )
        self._create_variant(
            [
                farther_boarding,
                farther_alighting,
            ],
        )

        result = self._search(
            longitude=123.8800,
            latitude=10.3000,
        )

        self.assertEqual(
            result["journeys"][0]["route_variant_id"],
            close_access_variant.JRV_ID,
        )

        shared_boarding = self._create_point(
            "Shared Boarding",
            123.8800,
            10.2900,
        )
        shared_alighting = self._create_point(
            "Shared Alighting",
            123.8980,
            10.2900,
        )
        shorter_variant = self._create_variant(
            [
                shared_boarding,
                shared_alighting,
            ],
        )
        tied_variant = self._create_variant(
            [
                shared_boarding,
                shared_alighting,
            ],
        )
        self._create_variant(
            [
                shared_boarding,
                shared_alighting,
            ],
            geometry=[
                (123.8800, 10.2900),
                (123.8890, 10.2960),
                (123.8980, 10.2900),
            ],
        )
        self._set_destination(
            longitude=shared_alighting.TRPT_POINT.x,
            latitude=shared_alighting.TRPT_POINT.y,
        )

        tie_result = self._search(
            longitude=shared_boarding.TRPT_POINT.x,
            latitude=shared_boarding.TRPT_POINT.y,
        )
        ranked_variant_ids = [
            journey["route_variant_id"]
            for journey in tie_result["journeys"]
        ]

        self.assertEqual(
            ranked_variant_ids[:2],
            [
                shorter_variant.JRV_ID,
                tied_variant.JRV_ID,
            ],
        )

    def test_results_are_limited_and_equivalent_combinations_are_unique(self):
        """Bound results and return each variant-point combination only once."""

        boarding = self._create_point(
            "Shared Boarding",
            123.8800,
            10.3000,
        )
        alighting = self._create_point(
            "Shared Alighting",
            123.8980,
            10.3000,
        )

        for _ in range(DIRECT_ROUTE_RESULT_LIMIT + 2):
            self._create_variant(
                [
                    boarding,
                    alighting,
                ],
            )

        result = self._search(
            longitude=boarding.TRPT_POINT.x,
            latitude=boarding.TRPT_POINT.y,
        )
        combinations = [
            (
                journey["route_variant_id"],
                journey["boarding_transit_point"]["id"],
                journey["alighting_transit_point"]["id"],
            )
            for journey in result["journeys"]
        ]

        self.assertEqual(
            len(combinations),
            DIRECT_ROUTE_RESULT_LIMIT,
        )
        self.assertEqual(
            len(combinations),
            len(set(combinations)),
        )

    def test_missing_business_raises_controlled_not_found(self):
        """Raise the Explorer business not-found response for an unknown destination."""

        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            DirectJourneyService.search_direct_journeys(
                business_id=999999,
                latitude=10.3000,
                longitude=123.8800,
            )

    @patch(
        "apps.transit.services.direct_journey_service."
        "Business.objects.select_related",
    )
    def test_missing_business_location_raises_controlled_not_found(
        self,
        mock_select_related,
    ):
        """Raise a controlled response if legacy data lacks a location."""

        mock_select_related.return_value.get.return_value = SimpleNamespace(
            LOCT_ID=None,
        )

        with self.assertRaisesMessage(
            NotFound,
            "The business location could not be found.",
        ):
            DirectJourneyService.search_direct_journeys(
                business_id=self.business.BUSN_ID,
                latitude=10.3000,
                longitude=123.8800,
            )
