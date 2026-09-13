from django.contrib.gis.geos import GEOSGeometry, LineString, Point
from django.db import connection
from django.test import TestCase

from apps.business.models import (
    Business,
    BusinessLandmark,
    Category,
    Cluster,
    Location,
)
from apps.transit.constants import (
    DIRECT_ROUTE_SEARCH_RADIUS_METERS,
    LANDMARK_CONTEXT_RADIUS_METERS,
)
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
)
from apps.transit.services.direct_journey_service import DirectJourneyService
from apps.users.models import User


class DirectJourneyLandmarkContextTests(TestCase):
    """Test optional approved-business landmark context for direct journeys."""

    def setUp(self):
        """Create an active business and one valid direct journey."""

        owner = User.objects.create_user(
            email="landmark-context-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Landmark",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(
            CLUS_NAME="Landmark Context Cluster",
        )
        category = Category.objects.create(
            CTGRY_NAME="Landmark Context Category",
            CLUS_ID=cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8980,
                10.3000,
                srid=4326,
            ),
            LOCT_ADDRESS="Landmark Context Destination",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Landmark Context Business",
            BUSN_DESCRIPTION="A destination used by landmark context tests.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=self.location,
        )
        self.boarding = self._create_transit_point(
            "Boarding",
            123.8800,
            10.3000,
        )
        self.alighting = self._create_transit_point(
            "Alighting",
            123.8980,
            10.3000,
        )
        self.variant_counter = 0
        self.primary_variant = self._create_variant(
            self.boarding,
            self.alighting,
        )

    def _create_transit_point(
        self,
        name,
        longitude,
        latitude,
    ):
        """Create one managed Transit Point fixture."""

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
        boarding,
        alighting,
        geometry=None,
    ):
        """Create one direct variant between two managed Transit Points."""

        self.variant_counter += 1
        route = JeepneyRoute.objects.create(
            JRT_CODE=f"L{self.variant_counter:02d}",
        )

        if geometry is None:
            geometry = [
                (
                    boarding.TRPT_POINT.x,
                    boarding.TRPT_POINT.y,
                ),
                (
                    alighting.TRPT_POINT.x,
                    alighting.TRPT_POINT.y,
                ),
            ]

        variant = JeepneyRouteVariant.objects.create(
            JRT_ID=route,
            JRV_ORIGIN_ID=boarding,
            JRV_DESTINATION_ID=alighting,
            JRV_GEOMETRY=LineString(
                *geometry,
                srid=4326,
            ),
        )
        RouteTransitPoint.objects.bulk_create(
            [
                RouteTransitPoint(
                    JRV_ID=variant,
                    TRPT_ID=boarding,
                    RVTP_SEQUENCE=1,
                ),
                RouteTransitPoint(
                    JRV_ID=variant,
                    TRPT_ID=alighting,
                    RVTP_SEQUENCE=2,
                ),
            ]
        )

        return variant

    def _project_point(
        self,
        origin,
        distance_meters,
        azimuth_radians=0,
    ):
        """Project a WGS 84 point by an exact PostGIS geography distance."""

        with connection.cursor() as cursor:
            cursor.execute(
                """
                    SELECT ST_AsEWKT(
                        ST_Project(
                            %s::geometry::geography,
                            %s,
                            %s
                        )::geometry
                    )
                """,
                [
                    origin.ewkt,
                    distance_meters,
                    azimuth_radians,
                ],
            )
            projected_ewkt = cursor.fetchone()[0]

        return GEOSGeometry(
            projected_ewkt,
        )

    def _create_landmark(
        self,
        name,
        point,
    ):
        """Create one permanent approved-business landmark fixture."""

        return BusinessLandmark.objects.create(
            BLMK_NAME=name,
            BLMK_ADDRESS=f"{name} Address",
            BLMK_POINT=point,
            BLMK_SOURCE=BusinessLandmark.LandmarkSource.CUSTOM,
            LOCT_ID=self.location,
        )

    def _search(self):
        """Search the valid direct journey from the fixture boarding point."""

        return DirectJourneyService.search_direct_journeys(
            business_id=self.business.BUSN_ID,
            latitude=self.boarding.TRPT_POINT.y,
            longitude=self.boarding.TRPT_POINT.x,
        )

    def test_landmark_within_200_meters_is_included(self):
        """Attach a permanent business landmark near the alighting point."""

        landmark = self._create_landmark(
            "Nearby Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                85,
            ),
        )

        result = self._search()
        context = result["journeys"][0]["landmark_context"]

        self.assertEqual(
            LANDMARK_CONTEXT_RADIUS_METERS,
            200,
        )
        self.assertEqual(
            context["id"],
            landmark.BLMK_ID,
        )
        self.assertEqual(
            context["name"],
            "Nearby Landmark",
        )
        self.assertAlmostEqual(
            context["distance_from_alighting_meters"],
            85,
            places=2,
        )

    def test_landmark_beyond_200_meters_is_excluded(self):
        """Exclude a business landmark outside the transit context ceiling."""

        self._create_landmark(
            "Far Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                201,
            ),
        )

        result = self._search()

        self.assertIsNone(
            result["journeys"][0]["landmark_context"],
        )

    def test_landmark_exactly_at_threshold_is_included(self):
        """Treat the configured 200-meter boundary as inclusive."""

        landmark = self._create_landmark(
            "Boundary Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                LANDMARK_CONTEXT_RADIUS_METERS,
            ),
        )

        result = self._search()
        context = result["journeys"][0]["landmark_context"]

        self.assertEqual(
            context["id"],
            landmark.BLMK_ID,
        )
        self.assertAlmostEqual(
            context["distance_from_alighting_meters"],
            LANDMARK_CONTEXT_RADIUS_METERS,
            places=2,
        )

    def test_nearest_eligible_landmark_is_selected(self):
        """Choose the nearest landmark when several are within the threshold."""

        self._create_landmark(
            "Farther Eligible Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                150,
            ),
        )
        nearest = self._create_landmark(
            "Nearest Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                45,
            ),
        )

        result = self._search()

        self.assertEqual(
            result["journeys"][0]["landmark_context"]["id"],
            nearest.BLMK_ID,
        )

    def test_distance_is_from_alighting_point_not_business_location(self):
        """Exclude a landmark at the business when it is far from alighting."""

        business_point = self._project_point(
            self.alighting.TRPT_POINT,
            300,
        )
        self.location.LOCT_POINT = business_point
        self.location.save(
            update_fields=[
                "LOCT_POINT",
                "LOCT_UPDATED_AT",
            ],
        )
        self._create_landmark(
            "At Business But Far From Alighting",
            business_point,
        )

        result = self._search()

        self.assertEqual(
            len(result["journeys"]),
            1,
        )
        self.assertIsNone(
            result["journeys"][0]["landmark_context"],
        )

    def test_business_without_landmarks_keeps_direct_journey(self):
        """Return a valid journey with explicit null landmark context."""

        result = self._search()

        self.assertEqual(
            len(result["journeys"]),
            1,
        )
        self.assertIsNone(
            result["journeys"][0]["landmark_context"],
        )

    def test_landmark_without_usable_coordinates_does_not_break_routing(self):
        """Ignore an empty legacy landmark geometry without dropping the journey."""

        empty_point = Point()
        empty_point.srid = 4326
        self._create_landmark(
            "Empty Landmark",
            empty_point,
        )

        result = self._search()

        self.assertEqual(
            len(result["journeys"]),
            1,
        )
        self.assertIsNone(
            result["journeys"][0]["landmark_context"],
        )

    def test_each_journey_uses_its_own_alighting_point(self):
        """Choose separate landmark context for separate alighting points."""

        second_alighting = self._create_transit_point(
            "Second Alighting",
            123.9010,
            10.3000,
        )
        second_variant = self._create_variant(
            self.boarding,
            second_alighting,
        )
        first_landmark = self._create_landmark(
            "First Journey Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                40,
                azimuth_radians=3.141592653589793,
            ),
        )
        second_landmark = self._create_landmark(
            "Second Journey Landmark",
            self._project_point(
                second_alighting.TRPT_POINT,
                40,
            ),
        )
        self.location.LOCT_POINT = Point(
            123.8995,
            10.3000,
            srid=4326,
        )
        self.location.save(
            update_fields=[
                "LOCT_POINT",
                "LOCT_UPDATED_AT",
            ],
        )

        with self.assertNumQueries(3):
            result = self._search()
        contexts_by_variant_id = {
            journey["route_variant_id"]: journey["landmark_context"]["id"]
            for journey in result["journeys"]
        }

        self.assertEqual(
            contexts_by_variant_id[self.primary_variant.JRV_ID],
            first_landmark.BLMK_ID,
        )
        self.assertEqual(
            contexts_by_variant_id[second_variant.JRV_ID],
            second_landmark.BLMK_ID,
        )

    def test_landmark_presence_does_not_change_ranking_or_ride_distance(self):
        """Enrich presentation after routing without reordering or remeasuring."""

        second_boarding = self._create_transit_point(
            "Second Boarding",
            123.8820,
            10.3000,
        )
        second_variant = self._create_variant(
            second_boarding,
            self.alighting,
        )
        before = self._search()
        before_order = [
            journey["route_variant_id"]
            for journey in before["journeys"]
        ]
        before_ride_distances = {
            journey["route_variant_id"]: journey[
                "approximate_ride_distance_meters"
            ]
            for journey in before["journeys"]
        }
        landmark = self._create_landmark(
            "Ranking-Neutral Landmark",
            self._project_point(
                self.alighting.TRPT_POINT,
                25,
            ),
        )

        after = self._search()
        after_order = [
            journey["route_variant_id"]
            for journey in after["journeys"]
        ]

        self.assertEqual(
            before_order,
            after_order,
        )
        self.assertEqual(
            after_order,
            [
                self.primary_variant.JRV_ID,
                second_variant.JRV_ID,
            ],
        )

        for journey in after["journeys"]:
            self.assertEqual(
                journey["approximate_ride_distance_meters"],
                before_ride_distances[journey["route_variant_id"]],
            )
            self.assertEqual(
                journey["landmark_context"]["id"],
                landmark.BLMK_ID,
            )

    def test_landmarks_do_not_change_no_route_reason_or_search_radius(self):
        """Keep Task 5A no-route behavior and radius unchanged."""

        self._create_landmark(
            "Irrelevant Landmark",
            self.alighting.TRPT_POINT,
        )

        result = DirectJourneyService.search_direct_journeys(
            business_id=self.business.BUSN_ID,
            latitude=10.3060,
            longitude=123.8800,
        )

        self.assertEqual(
            DIRECT_ROUTE_SEARCH_RADIUS_METERS,
            500,
        )
        self.assertEqual(
            result,
            {
                "journeys": [],
                "reason": "no_nearby_boarding_point",
            },
        )
