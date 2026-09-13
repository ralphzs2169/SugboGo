from django.contrib.gis.geos import Point
from django.db import connection
from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.transit.constants import (
    DIRECT_ROUTE_RESULT_LIMIT,
    DIRECT_ROUTE_SEARCH_RADIUS_METERS,
    LANDMARK_CONTEXT_RADIUS_METERS,
)


class DirectJourneyService:
    """Find zero-transfer jeepney journeys using managed transit infrastructure."""

    NO_NEARBY_BOARDING_POINT = "no_nearby_boarding_point"
    NO_NEARBY_ALIGHTING_POINT = "no_nearby_alighting_point"
    NO_DIRECT_ROUTE_MATCH = "no_direct_route_match"

    @staticmethod
    def _get_destination_context(
        business_id,
    ):
        """Retrieve the authoritative point and location ID for a destination."""

        try:
            business = (
                Business.objects
                .select_related(
                    "LOCT_ID",
                )
                .get(
                    BUSN_ID=business_id,
                    BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        location = getattr(
            business,
            "LOCT_ID",
            None,
        )

        if location is None or location.LOCT_POINT is None:
            raise NotFound(
                "The business location could not be found.",
            )

        return (
            location.LOCT_POINT,
            location.LOCT_ID,
        )

    @staticmethod
    def _execute_search_query(
        explorer_point,
        destination_point,
    ):
        """Run the meter-correct PostGIS direct-journey search."""

        query = """
            WITH inputs AS (
                SELECT
                    ST_SetSRID(
                        ST_MakePoint(%s, %s),
                        4326
                    ) AS explorer_point,
                    ST_SetSRID(
                        ST_MakePoint(%s, %s),
                        4326
                    ) AS destination_point
            ),
            boarding_candidates AS (
                SELECT
                    route_point."RVTP_ID" AS route_point_id,
                    route_point."JRV_ID" AS route_variant_id,
                    route_point."TRPT_ID" AS transit_point_id,
                    route_point."RVTP_SEQUENCE" AS sequence,
                    transit_point."TRPT_NAME" AS transit_point_name,
                    transit_point."TRPT_POINT" AS transit_point_geometry,
                    ST_Distance(
                        transit_point."TRPT_POINT"::geography,
                        inputs.explorer_point::geography
                    ) AS access_distance_meters
                FROM "ROUTE_TRANSIT_POINT" AS route_point
                INNER JOIN "TRANSIT_POINT" AS transit_point
                    ON transit_point."TRPT_ID" = route_point."TRPT_ID"
                CROSS JOIN inputs
                WHERE transit_point."TRPT_POINT" && ST_Buffer(
                    inputs.explorer_point::geography,
                    %s
                )::geometry
                AND ST_DWithin(
                    transit_point."TRPT_POINT"::geography,
                    inputs.explorer_point::geography,
                    %s
                )
            ),
            alighting_candidates AS (
                SELECT
                    route_point."RVTP_ID" AS route_point_id,
                    route_point."JRV_ID" AS route_variant_id,
                    route_point."TRPT_ID" AS transit_point_id,
                    route_point."RVTP_SEQUENCE" AS sequence,
                    transit_point."TRPT_NAME" AS transit_point_name,
                    transit_point."TRPT_POINT" AS transit_point_geometry,
                    ST_Distance(
                        transit_point."TRPT_POINT"::geography,
                        inputs.destination_point::geography
                    ) AS egress_distance_meters
                FROM "ROUTE_TRANSIT_POINT" AS route_point
                INNER JOIN "TRANSIT_POINT" AS transit_point
                    ON transit_point."TRPT_ID" = route_point."TRPT_ID"
                CROSS JOIN inputs
                WHERE transit_point."TRPT_POINT" && ST_Buffer(
                    inputs.destination_point::geography,
                    %s
                )::geometry
                AND ST_DWithin(
                    transit_point."TRPT_POINT"::geography,
                    inputs.destination_point::geography,
                    %s
                )
            ),
            valid_journeys AS (
                SELECT
                    route_variant."JRV_ID" AS route_variant_id,
                    jeepney_route."JRT_CODE" AS jeepney_route_code,
                    origin_point."TRPT_ID" AS origin_id,
                    origin_point."TRPT_NAME" AS origin_name,
                    destination_route_point."TRPT_ID" AS destination_id,
                    destination_route_point."TRPT_NAME" AS destination_name,
                    boarding.transit_point_id AS boarding_point_id,
                    boarding.transit_point_name AS boarding_point_name,
                    ST_Y(
                        boarding.transit_point_geometry
                    ) AS boarding_latitude,
                    ST_X(
                        boarding.transit_point_geometry
                    ) AS boarding_longitude,
                    boarding.sequence AS boarding_sequence,
                    boarding.access_distance_meters,
                    alighting.transit_point_id AS alighting_point_id,
                    alighting.transit_point_name AS alighting_point_name,
                    ST_Y(
                        alighting.transit_point_geometry
                    ) AS alighting_latitude,
                    ST_X(
                        alighting.transit_point_geometry
                    ) AS alighting_longitude,
                    alighting.sequence AS alighting_sequence,
                    alighting.egress_distance_meters,
                    (
                        boarding.access_distance_meters
                        + alighting.egress_distance_meters
                    ) AS total_access_egress_distance_meters,
                    ST_Length(
                        ST_LineSubstring(
                            route_variant."JRV_GEOMETRY",
                            LEAST(
                                ST_LineLocatePoint(
                                    route_variant."JRV_GEOMETRY",
                                    boarding.transit_point_geometry
                                ),
                                ST_LineLocatePoint(
                                    route_variant."JRV_GEOMETRY",
                                    alighting.transit_point_geometry
                                )
                            ),
                            GREATEST(
                                ST_LineLocatePoint(
                                    route_variant."JRV_GEOMETRY",
                                    boarding.transit_point_geometry
                                ),
                                ST_LineLocatePoint(
                                    route_variant."JRV_GEOMETRY",
                                    alighting.transit_point_geometry
                                )
                            )
                        )::geography
                    ) AS ride_distance_meters
                FROM boarding_candidates AS boarding
                INNER JOIN alighting_candidates AS alighting
                    ON alighting.route_variant_id = boarding.route_variant_id
                    AND boarding.sequence < alighting.sequence
                INNER JOIN "JEEPNEY_ROUTE_VARIANT" AS route_variant
                    ON route_variant."JRV_ID" = boarding.route_variant_id
                    AND NOT ST_IsEmpty(route_variant."JRV_GEOMETRY")
                INNER JOIN "JEEPNEY_ROUTE" AS jeepney_route
                    ON jeepney_route."JRT_ID" = route_variant."JRT_ID"
                INNER JOIN "TRANSIT_POINT" AS origin_point
                    ON origin_point."TRPT_ID" = route_variant."JRV_ORIGIN_ID"
                INNER JOIN "TRANSIT_POINT" AS destination_route_point
                    ON destination_route_point."TRPT_ID"
                        = route_variant."JRV_DESTINATION_ID"
            ),
            candidate_counts AS (
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM boarding_candidates
                    ) AS boarding_candidate_count,
                    (
                        SELECT COUNT(*)
                        FROM alighting_candidates
                    ) AS alighting_candidate_count
            )
            SELECT
                candidate_counts.boarding_candidate_count,
                candidate_counts.alighting_candidate_count,
                ranked_journeys.*
            FROM candidate_counts
            LEFT JOIN LATERAL (
                SELECT *
                FROM valid_journeys
                ORDER BY
                    total_access_egress_distance_meters,
                    ride_distance_meters,
                    route_variant_id,
                    boarding_sequence,
                    alighting_sequence,
                    boarding_point_id,
                    alighting_point_id
                LIMIT %s
            ) AS ranked_journeys ON TRUE
            ORDER BY
                ranked_journeys.total_access_egress_distance_meters,
                ranked_journeys.ride_distance_meters,
                ranked_journeys.route_variant_id,
                ranked_journeys.boarding_sequence,
                ranked_journeys.alighting_sequence,
                ranked_journeys.boarding_point_id,
                ranked_journeys.alighting_point_id
        """

        parameters = [
            explorer_point.x,
            explorer_point.y,
            destination_point.x,
            destination_point.y,
            DIRECT_ROUTE_SEARCH_RADIUS_METERS,
            DIRECT_ROUTE_SEARCH_RADIUS_METERS,
            DIRECT_ROUTE_SEARCH_RADIUS_METERS,
            DIRECT_ROUTE_SEARCH_RADIUS_METERS,
            DIRECT_ROUTE_RESULT_LIMIT,
        ]

        with connection.cursor() as cursor:
            cursor.execute(
                query,
                parameters,
            )
            columns = [
                column[0]
                for column in cursor.description
            ]

            return [
                dict(
                    zip(
                        columns,
                        row,
                    )
                )
                for row in cursor.fetchall()
            ]

    @staticmethod
    def _serialize_journey(
        row,
    ):
        """Convert one database result into a frontend-friendly journey record."""

        return {
            "journey_type": "direct",
            "jeepney_route_code": row["jeepney_route_code"],
            "route_variant_id": row["route_variant_id"],
            "route_variant_origin": {
                "id": row["origin_id"],
                "name": row["origin_name"],
            },
            "route_variant_destination": {
                "id": row["destination_id"],
                "name": row["destination_name"],
            },
            "boarding_transit_point": {
                "id": row["boarding_point_id"],
                "name": row["boarding_point_name"],
                "latitude": row["boarding_latitude"],
                "longitude": row["boarding_longitude"],
            },
            "boarding_sequence": row["boarding_sequence"],
            "explorer_to_boarding_distance_meters": row[
                "access_distance_meters"
            ],
            "alighting_transit_point": {
                "id": row["alighting_point_id"],
                "name": row["alighting_point_name"],
                "latitude": row["alighting_latitude"],
                "longitude": row["alighting_longitude"],
            },
            "alighting_sequence": row["alighting_sequence"],
            "alighting_to_business_distance_meters": row[
                "egress_distance_meters"
            ],
            "total_access_egress_distance_meters": row[
                "total_access_egress_distance_meters"
            ],
            "approximate_ride_distance_meters": row[
                "ride_distance_meters"
            ],
            "landmark_context": None,
        }

    @staticmethod
    def _find_landmark_contexts(
        location_id,
        alighting_point_ids,
    ):
        """Find the nearest eligible business landmark for each alighting point."""

        unique_alighting_point_ids = sorted(
            set(
                alighting_point_ids,
            )
        )

        if not unique_alighting_point_ids:
            return {}

        id_placeholders = ", ".join(
            [
                "%s"
                for _ in unique_alighting_point_ids
            ]
        )
        query = f"""
            SELECT DISTINCT ON (transit_point."TRPT_ID")
                transit_point."TRPT_ID" AS alighting_point_id,
                landmark."BLMK_ID" AS landmark_id,
                landmark."BLMK_NAME" AS landmark_name,
                ST_Distance(
                    landmark."BLMK_POINT"::geography,
                    transit_point."TRPT_POINT"::geography
                ) AS distance_from_alighting_meters
            FROM "TRANSIT_POINT" AS transit_point
            INNER JOIN "BUSINESS_LANDMARK" AS landmark
                ON landmark."LOCT_ID" = %s
            WHERE transit_point."TRPT_ID" IN ({id_placeholders})
                AND landmark."BLMK_POINT" IS NOT NULL
                AND NOT ST_IsEmpty(landmark."BLMK_POINT")
                AND landmark."BLMK_POINT" && ST_Buffer(
                    transit_point."TRPT_POINT"::geography,
                    %s
                )::geometry
                AND ST_DWithin(
                    landmark."BLMK_POINT"::geography,
                    transit_point."TRPT_POINT"::geography,
                    %s
                )
            ORDER BY
                transit_point."TRPT_ID",
                distance_from_alighting_meters,
                landmark."BLMK_ID"
        """
        parameters = [
            location_id,
            *unique_alighting_point_ids,
            LANDMARK_CONTEXT_RADIUS_METERS,
            LANDMARK_CONTEXT_RADIUS_METERS,
        ]

        with connection.cursor() as cursor:
            cursor.execute(
                query,
                parameters,
            )

            return {
                alighting_point_id: {
                    "id": landmark_id,
                    "name": landmark_name,
                    "distance_from_alighting_meters": distance,
                }
                for (
                    alighting_point_id,
                    landmark_id,
                    landmark_name,
                    distance,
                ) in cursor.fetchall()
            }

    @staticmethod
    def _enrich_landmark_contexts(
        journeys,
        location_id,
    ):
        """Attach optional landmark context without changing journey order."""

        contexts_by_alighting_point_id = (
            DirectJourneyService._find_landmark_contexts(
                location_id,
                [
                    journey["alighting_transit_point"]["id"]
                    for journey in journeys
                ],
            )
        )

        for journey in journeys:
            alighting_point_id = journey[
                "alighting_transit_point"
            ]["id"]
            journey["landmark_context"] = (
                contexts_by_alighting_point_id.get(
                    alighting_point_id,
                )
            )

    @staticmethod
    def search_direct_journeys(
        business_id,
        latitude,
        longitude,
    ):
        """Return ranked direct journeys or a successful no-route reason."""

        explorer_point = Point(
            float(longitude),
            float(latitude),
            srid=4326,
        )
        (
            destination_point,
            destination_location_id,
        ) = DirectJourneyService._get_destination_context(
            business_id,
        )
        rows = DirectJourneyService._execute_search_query(
            explorer_point,
            destination_point,
        )
        metadata = rows[0]
        journeys = [
            DirectJourneyService._serialize_journey(
                row,
            )
            for row in rows
            if row["route_variant_id"] is not None
        ]

        DirectJourneyService._enrich_landmark_contexts(
            journeys,
            destination_location_id,
        )

        if journeys:
            reason = None
        elif metadata["boarding_candidate_count"] == 0:
            reason = DirectJourneyService.NO_NEARBY_BOARDING_POINT
        elif metadata["alighting_candidate_count"] == 0:
            reason = DirectJourneyService.NO_NEARBY_ALIGHTING_POINT
        else:
            reason = DirectJourneyService.NO_DIRECT_ROUTE_MATCH

        return {
            "journeys": journeys,
            "reason": reason,
        }
