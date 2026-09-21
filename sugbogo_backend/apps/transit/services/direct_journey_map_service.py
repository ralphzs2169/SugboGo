from django.contrib.gis.geos import GEOSGeometry
from django.db import connection
from rest_framework.exceptions import NotFound, ValidationError

from apps.transit.models import JeepneyRouteVariant, RouteTransitPoint
from apps.transit.services.direct_journey_service import DirectJourneyService


class DirectJourneyMapService:
    """Build map guidance for one structurally valid direct journey."""

    @staticmethod
    def _get_variant(
        route_variant_id,
    ):
        """Retrieve one directional variant with its route and endpoints."""

        try:
            return (
                JeepneyRouteVariant.objects
                .select_related(
                    "JRT_ID",
                    "JRV_ORIGIN_ID",
                    "JRV_DESTINATION_ID",
                )
                .get(
                    JRV_ID=route_variant_id,
                )
            )
        except JeepneyRouteVariant.DoesNotExist:
            raise NotFound(
                "The jeepney route variant could not be found.",
            )

    @staticmethod
    def _get_selected_route_points(
        route_variant_id,
        boarding_transit_point_id,
        alighting_transit_point_id,
    ):
        """Retrieve and validate the selected ordered route memberships."""

        route_points = {
            route_point.TRPT_ID_id: route_point
            for route_point in (
                RouteTransitPoint.objects
                .select_related(
                    "TRPT_ID",
                )
                .filter(
                    JRV_ID_id=route_variant_id,
                    TRPT_ID_id__in=[
                        boarding_transit_point_id,
                        alighting_transit_point_id,
                    ],
                )
            )
        }

        boarding_route_point = route_points.get(
            boarding_transit_point_id,
        )
        alighting_route_point = route_points.get(
            alighting_transit_point_id,
        )

        if boarding_route_point is None:
            raise ValidationError(
                {
                    "boarding_transit_point_id": (
                        "The boarding Transit Point does not belong to "
                        "the selected route variant."
                    ),
                },
            )

        if alighting_route_point is None:
            raise ValidationError(
                {
                    "alighting_transit_point_id": (
                        "The alighting Transit Point does not belong to "
                        "the selected route variant."
                    ),
                },
            )

        if (
            boarding_route_point.RVTP_SEQUENCE
            >= alighting_route_point.RVTP_SEQUENCE
        ):
            raise ValidationError(
                {
                    "alighting_transit_point_id": (
                        "The alighting Transit Point must occur after "
                        "the boarding Transit Point."
                    ),
                },
            )

        return (
            boarding_route_point,
            alighting_route_point,
        )

    @staticmethod
    def _get_selected_segment(
        route_geometry,
        boarding_point,
        alighting_point,
    ):
        """Project selected stops onto the route and return its directed subline."""

        with connection.cursor() as cursor:
            cursor.execute(
                """
                    SELECT
                        ST_AsEWKT(
                            ST_LineSubstring(
                                %s::geometry,
                                LEAST(
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    ),
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    )
                                ),
                                GREATEST(
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    ),
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    )
                                )
                            )
                        ),
                        ST_Length(
                            ST_LineSubstring(
                                %s::geometry,
                                LEAST(
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    ),
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    )
                                ),
                                GREATEST(
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    ),
                                    ST_LineLocatePoint(
                                        %s::geometry,
                                        %s::geometry
                                    )
                                )
                            )::geography
                        )
                """,
                [
                    route_geometry.ewkt,
                    route_geometry.ewkt,
                    boarding_point.ewkt,
                    route_geometry.ewkt,
                    alighting_point.ewkt,
                    route_geometry.ewkt,
                    boarding_point.ewkt,
                    route_geometry.ewkt,
                    alighting_point.ewkt,
                    route_geometry.ewkt,
                    route_geometry.ewkt,
                    boarding_point.ewkt,
                    route_geometry.ewkt,
                    alighting_point.ewkt,
                    route_geometry.ewkt,
                    boarding_point.ewkt,
                    route_geometry.ewkt,
                    alighting_point.ewkt,
                ],
            )
            segment_ewkt, distance_meters = cursor.fetchone()

        return (
            GEOSGeometry(
                segment_ewkt,
            ),
            distance_meters,
        )

    @staticmethod
    def _serialize_geometry(
        geometry,
    ):
        """Return LineString coordinates in frontend map order."""

        if geometry.geom_type == "Point":
            longitude, latitude = geometry.coords
            return [
                {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                {
                    "latitude": latitude,
                    "longitude": longitude,
                },
            ]

        return [
            {
                "latitude": latitude,
                "longitude": longitude,
            }
            for longitude, latitude in geometry.coords
        ]

    @staticmethod
    def _serialize_route_point(
        route_point,
    ):
        """Return one selected Transit Point with authoritative sequence."""

        transit_point = route_point.TRPT_ID

        return {
            "id": transit_point.TRPT_ID,
            "name": transit_point.TRPT_NAME,
            "latitude": transit_point.TRPT_POINT.y,
            "longitude": transit_point.TRPT_POINT.x,
            "sequence": route_point.RVTP_SEQUENCE,
        }

    @staticmethod
    def get_map_guidance(
        *,
        business_id,
        route_variant_id,
        boarding_transit_point_id,
        alighting_transit_point_id,
    ):
        """Return authoritative geometry and context for a selected journey."""

        (
            business_point,
            business_location_id,
        ) = DirectJourneyService._get_destination_context(
            business_id,
        )
        variant = DirectJourneyMapService._get_variant(
            route_variant_id,
        )
        (
            boarding_route_point,
            alighting_route_point,
        ) = DirectJourneyMapService._get_selected_route_points(
            route_variant_id,
            boarding_transit_point_id,
            alighting_transit_point_id,
        )
        (
            selected_segment,
            ride_distance_meters,
        ) = DirectJourneyMapService._get_selected_segment(
            variant.JRV_GEOMETRY,
            boarding_route_point.TRPT_ID.TRPT_POINT,
            alighting_route_point.TRPT_ID.TRPT_POINT,
        )
        landmark_contexts = DirectJourneyService._find_landmark_contexts(
            business_location_id,
            [
                alighting_transit_point_id,
            ],
        )

        return {
            "journey": {
                "jeepney_route_code": variant.JRT_ID.JRT_CODE,
                "route_variant": {
                    "id": variant.JRV_ID,
                    "origin": {
                        "id": variant.JRV_ORIGIN_ID.TRPT_ID,
                        "name": variant.JRV_ORIGIN_ID.TRPT_NAME,
                    },
                    "destination": {
                        "id": variant.JRV_DESTINATION_ID.TRPT_ID,
                        "name": variant.JRV_DESTINATION_ID.TRPT_NAME,
                    },
                },
                "boarding_transit_point": (
                    DirectJourneyMapService._serialize_route_point(
                        boarding_route_point,
                    )
                ),
                "alighting_transit_point": (
                    DirectJourneyMapService._serialize_route_point(
                        alighting_route_point,
                    )
                ),
                "ride": {
                    "approximate_distance_meters": ride_distance_meters,
                    "full_variant_geometry": (
                        DirectJourneyMapService._serialize_geometry(
                            variant.JRV_GEOMETRY,
                        )
                    ),
                    "selected_segment_geometry": (
                        DirectJourneyMapService._serialize_geometry(
                            selected_segment,
                        )
                    ),
                },
                "business_location": {
                    "latitude": business_point.y,
                    "longitude": business_point.x,
                },
                "landmark_context": landmark_contexts.get(
                    alighting_transit_point_id,
                ),
            },
        }
