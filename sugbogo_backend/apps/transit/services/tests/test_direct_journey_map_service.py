from django.contrib.gis.geos import LineString, Point
from django.test import TestCase
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessLandmark,
    Category,
    Cluster,
    Location,
)
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
)
from apps.transit.services.direct_journey_map_service import (
    DirectJourneyMapService,
)
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.users.models import User


class DirectJourneyMapServiceTests(TestCase):
    """Test authoritative map context for selected direct journeys."""

    def setUp(self):
        """Create one business and a four-point directional route."""

        owner = User.objects.create_user(
            email="journey-map-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Journey",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(
            CLUS_NAME="Journey Map Cluster",
        )
        category = Category.objects.create(
            CTGRY_NAME="Journey Map Category",
            CLUS_ID=cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8960,
                10.3000,
                srid=4326,
            ),
            LOCT_ADDRESS="Journey Map Destination",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Journey Map Business",
            BUSN_DESCRIPTION="A destination used for map guidance tests.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=self.location,
        )
        self.origin = self._create_point(
            "Origin",
            123.8740,
        )
        self.boarding = self._create_point(
            "Boarding",
            123.8800,
        )
        self.alighting = self._create_point(
            "Alighting",
            123.8920,
        )
        self.destination = self._create_point(
            "Destination",
            123.8980,
        )
        route = JeepneyRoute.objects.create(
            JRT_CODE="14D",
        )
        self.variant = JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=self.origin,
            JRV_DESTINATION_ID=self.destination,
            JRV_GEOMETRY=LineString(
                (123.8740, 10.3000),
                (123.8800, 10.3020),
                (123.8860, 10.3040),
                (123.8920, 10.3020),
                (123.8980, 10.3000),
                srid=4326,
            ),
        )
        RouteTransitPoint.objects.bulk_create(
            [
                RouteTransitPoint(
                    JRV_ID=self.variant,
                    TRPT_ID=transit_point,
                    RVTP_SEQUENCE=sequence,
                )
                for sequence, transit_point in enumerate(
                    [
                        self.origin,
                        self.boarding,
                        self.alighting,
                        self.destination,
                    ],
                    start=1,
                )
            ],
        )

    def _create_point(
        self,
        name,
        longitude,
    ):
        """Create one managed Transit Point on the test corridor."""

        return TransitPoint.objects.create(
            TRPT_NAME=name,
            TRPT_POINT=Point(
                longitude,
                10.3000,
                srid=4326,
            ),
        )

    def _get_guidance(
        self,
        **overrides,
    ):
        """Request map guidance with valid fixture identifiers by default."""

        parameters = {
            "business_id": self.business.BUSN_ID,
            "route_variant_id": self.variant.JRV_ID,
            "boarding_transit_point_id": self.boarding.TRPT_ID,
            "alighting_transit_point_id": self.alighting.TRPT_ID,
        }
        parameters.update(
            overrides,
        )

        return DirectJourneyMapService.get_map_guidance(
            **parameters,
        )

    def test_returns_full_variant_and_selected_directed_segment(self):
        """Return full route context and only the selected ride subline."""

        result = self._get_guidance()
        journey = result["journey"]
        ride = journey["ride"]

        self.assertEqual(
            journey["jeepney_route_code"],
            "14D",
        )
        self.assertEqual(
            journey["route_variant"],
            {
                "id": self.variant.JRV_ID,
                "origin": {
                    "id": self.origin.TRPT_ID,
                    "name": "Origin",
                },
                "destination": {
                    "id": self.destination.TRPT_ID,
                    "name": "Destination",
                },
            },
        )
        self.assertEqual(
            journey["boarding_transit_point"]["sequence"],
            2,
        )
        self.assertEqual(
            journey["alighting_transit_point"]["sequence"],
            3,
        )
        self.assertEqual(
            len(ride["full_variant_geometry"]),
            5,
        )
        self.assertNotEqual(
            ride["selected_segment_geometry"],
            ride["full_variant_geometry"],
        )
        selected_start_longitude = ride[
            "selected_segment_geometry"
        ][0]["longitude"]
        selected_end_longitude = ride[
            "selected_segment_geometry"
        ][-1]["longitude"]

        self.assertGreater(
            selected_start_longitude,
            ride["full_variant_geometry"][0]["longitude"],
        )
        self.assertLess(
            selected_end_longitude,
            ride["full_variant_geometry"][-1]["longitude"],
        )
        self.assertLess(
            selected_start_longitude,
            selected_end_longitude,
        )
        self.assertGreater(
            ride["approximate_distance_meters"],
            0,
        )

    def test_uses_authoritative_business_location_and_landmark_context(self):
        """Return persisted destination and optional nearby landmark context."""

        landmark = BusinessLandmark.objects.create(
            BLMK_NAME="Nearby Landmark",
            BLMK_ADDRESS="Nearby Landmark Address",
            BLMK_POINT=Point(
                123.8922,
                10.3000,
                srid=4326,
            ),
            BLMK_SOURCE=BusinessLandmark.LandmarkSource.CUSTOM,
            LOCT_ID=self.location,
        )

        journey = self._get_guidance()["journey"]

        self.assertEqual(
            journey["business_location"],
            {
                "latitude": self.location.LOCT_POINT.y,
                "longitude": self.location.LOCT_POINT.x,
            },
        )
        self.assertEqual(
            journey["landmark_context"]["id"],
            landmark.BLMK_ID,
        )

    def test_ride_distance_matches_direct_journey_segment_calculation(self):
        """Reuse the direct-routing projected subline distance semantics."""

        map_journey = self._get_guidance()["journey"]
        search_result = DirectJourneyService.search_direct_journeys(
            business_id=self.business.BUSN_ID,
            latitude=self.boarding.TRPT_POINT.y,
            longitude=self.boarding.TRPT_POINT.x,
        )
        search_journeys = [
            journey
            for route_option in search_result["route_options"]
            for journey in [
                route_option["recommended_journey"],
                *route_option["alternative_journeys"],
            ]
        ]
        selected_search_journey = next(
            journey
            for journey in search_journeys
            if (
                journey["route_variant_id"] == self.variant.JRV_ID
                and journey["boarding_transit_point"]["id"]
                == self.boarding.TRPT_ID
                and journey["alighting_transit_point"]["id"]
                == self.alighting.TRPT_ID
            )
        )

        self.assertAlmostEqual(
            map_journey["ride"]["approximate_distance_meters"],
            selected_search_journey[
                "approximate_ride_distance_meters"
            ],
            places=5,
        )

    def test_rejects_transit_point_from_another_variant(self):
        """Reject a selected point without membership on the chosen variant."""

        unrelated_point = self._create_point(
            "Unrelated",
            123.8840,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "The boarding Transit Point does not belong to the selected route variant.",
        ):
            self._get_guidance(
                boarding_transit_point_id=unrelated_point.TRPT_ID,
            )

    def test_rejects_invalid_boarding_to_alighting_sequence(self):
        """Reject reverse or same-stop travel on the directional variant."""

        with self.assertRaisesMessage(
            ValidationError,
            "The alighting Transit Point must occur after the boarding Transit Point.",
        ):
            self._get_guidance(
                boarding_transit_point_id=self.alighting.TRPT_ID,
                alighting_transit_point_id=self.boarding.TRPT_ID,
            )

    def test_missing_variant_uses_controlled_not_found(self):
        """Raise the established controlled response for an unknown variant."""

        with self.assertRaisesMessage(
            NotFound,
            "The jeepney route variant could not be found.",
        ):
            self._get_guidance(
                route_variant_id=999999,
            )
