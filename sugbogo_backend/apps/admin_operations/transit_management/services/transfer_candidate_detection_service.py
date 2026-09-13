from django.db import connection, transaction
from django.db.models import Prefetch

from apps.admin_operations.transit_management.constants import (
    TRANSFER_CANDIDATE_DISTANCE_METERS,
)
from apps.admin_operations.transit_management.services.transit_transfer_service import (
    TransitTransferService,
)
from apps.transit.models import (
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
    TransitTransfer,
)


class TransferCandidateDetectionService:
    """Detect pending directed transfer candidates with PostGIS."""

    @staticmethod
    def _find_spatial_candidates():
        """Find spatially eligible ordered variant pairs and connection points."""

        query = """
            WITH spatial_pairs AS (
                SELECT
                    source_variant."JRV_ID" AS source_variant_id,
                    destination_variant."JRV_ID" AS destination_variant_id,
                    ST_ClosestPoint(
                        source_variant."JRV_GEOMETRY",
                        destination_variant."JRV_GEOMETRY"
                    ) AS source_route_point,
                    ST_ClosestPoint(
                        destination_variant."JRV_GEOMETRY",
                        source_variant."JRV_GEOMETRY"
                    ) AS destination_route_point,
                    ST_Distance(
                        source_variant."JRV_GEOMETRY"::geography,
                        destination_variant."JRV_GEOMETRY"::geography
                    ) AS route_separation_meters
                FROM "JEEPNEY_ROUTE_VARIANT" AS source_variant
                INNER JOIN "JEEPNEY_ROUTE_VARIANT" AS destination_variant
                    ON source_variant."JRV_ID" <> destination_variant."JRV_ID"
                    AND source_variant."JRT_ID" <> destination_variant."JRT_ID"
                    AND destination_variant."JRV_GEOMETRY" && ST_Buffer(
                        source_variant."JRV_GEOMETRY"::geography,
                        %s
                    )::geometry
                WHERE ST_DWithin(
                    source_variant."JRV_GEOMETRY"::geography,
                    destination_variant."JRV_GEOMETRY"::geography,
                    %s
                )
            )
            SELECT
                spatial_pairs.source_variant_id,
                spatial_pairs.destination_variant_id,
                source_route_point."TRPT_ID" AS source_transit_point_id,
                destination_route_point."TRPT_ID" AS destination_transit_point_id,
                spatial_pairs.route_separation_meters,
                CASE
                    WHEN source_route_point."TRPT_POINT" IS NULL
                        OR destination_route_point."TRPT_POINT" IS NULL
                    THEN NULL
                    ELSE ST_Distance(
                        source_route_point."TRPT_POINT"::geography,
                        destination_route_point."TRPT_POINT"::geography
                    )
                END AS connection_distance_meters
            FROM spatial_pairs
            LEFT JOIN LATERAL (
                SELECT
                    transit_point."TRPT_ID",
                    transit_point."TRPT_POINT"
                FROM "ROUTE_TRANSIT_POINT" AS route_point
                INNER JOIN "TRANSIT_POINT" AS transit_point
                    ON transit_point."TRPT_ID" = route_point."TRPT_ID"
                WHERE route_point."JRV_ID" = spatial_pairs.source_variant_id
                ORDER BY
                    ST_Distance(
                        transit_point."TRPT_POINT"::geography,
                        spatial_pairs.source_route_point::geography
                    ),
                    route_point."RVTP_SEQUENCE"
                LIMIT 1
            ) AS source_route_point ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    transit_point."TRPT_ID",
                    transit_point."TRPT_POINT"
                FROM "ROUTE_TRANSIT_POINT" AS route_point
                INNER JOIN "TRANSIT_POINT" AS transit_point
                    ON transit_point."TRPT_ID" = route_point."TRPT_ID"
                WHERE route_point."JRV_ID" = spatial_pairs.destination_variant_id
                ORDER BY
                    ST_Distance(
                        transit_point."TRPT_POINT"::geography,
                        spatial_pairs.destination_route_point::geography
                    ),
                    route_point."RVTP_SEQUENCE"
                LIMIT 1
            ) AS destination_route_point ON TRUE
            ORDER BY
                spatial_pairs.source_variant_id,
                spatial_pairs.destination_variant_id
        """

        with connection.cursor() as cursor:
            cursor.execute(
                query,
                [
                    TRANSFER_CANDIDATE_DISTANCE_METERS,
                    TRANSFER_CANDIDATE_DISTANCE_METERS,
                ],
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
    def _load_variants(candidate_rows):
        """Load candidate variants and ordered memberships without N+1 queries."""

        variant_ids = {
            variant_id
            for candidate in candidate_rows
            for variant_id in (
                candidate["source_variant_id"],
                candidate["destination_variant_id"],
            )
        }
        route_points = RouteTransitPoint.objects.select_related(
            "TRPT_ID",
        ).order_by(
            "RVTP_SEQUENCE",
        )

        variants = (
            JeepneyRouteVariant.objects
            .filter(
                JRV_ID__in=variant_ids,
            )
            .select_related(
                "JRT_ID",
            )
            .prefetch_related(
                Prefetch(
                    "route_transit_points",
                    queryset=route_points,
                ),
            )
        )

        return {
            variant.JRV_ID: variant
            for variant in variants
        }

    @staticmethod
    @transaction.atomic
    def detect_candidates():
        """Create missing pending candidates and return a detection summary."""

        candidate_rows = (
            TransferCandidateDetectionService
            ._find_spatial_candidates()
        )
        variants_by_id = (
            TransferCandidateDetectionService
            ._load_variants(
                candidate_rows,
            )
        )
        transit_point_ids = {
            candidate[field_name]
            for candidate in candidate_rows
            for field_name in (
                "source_transit_point_id",
                "destination_transit_point_id",
            )
            if candidate[field_name] is not None
        }
        transit_points_by_id = {
            transit_point.TRPT_ID: transit_point
            for transit_point in TransitPoint.objects.filter(
                TRPT_ID__in=transit_point_ids,
            )
        }
        existing_connections = set(
            TransitTransfer.objects
            .filter(
                TTFR_FROM_VARIANT_ID_id__in=variants_by_id,
                TTFR_TO_VARIANT_ID_id__in=variants_by_id,
            )
            .values_list(
                "TTFR_FROM_VARIANT_ID_id",
                "TTFR_TO_VARIANT_ID_id",
                "TTFR_FROM_TRANSIT_POINT_ID_id",
                "TTFR_TO_TRANSIT_POINT_ID_id",
            )
        )

        summary = {
            "route_pairs_eligible": len(candidate_rows),
            "candidates_created": 0,
            "candidates_skipped_existing": 0,
            "candidates_skipped_no_route_points": 0,
            "candidates_skipped_connection_distance": 0,
        }

        for candidate in candidate_rows:
            source_point_id = candidate["source_transit_point_id"]
            destination_point_id = candidate["destination_transit_point_id"]

            if source_point_id is None or destination_point_id is None:
                summary["candidates_skipped_no_route_points"] += 1
                continue

            if (
                candidate["connection_distance_meters"]
                > TRANSFER_CANDIDATE_DISTANCE_METERS
            ):
                summary["candidates_skipped_connection_distance"] += 1
                continue

            connection_key = (
                candidate["source_variant_id"],
                candidate["destination_variant_id"],
                source_point_id,
                destination_point_id,
            )

            if connection_key in existing_connections:
                summary["candidates_skipped_existing"] += 1
                continue

            source_variant = variants_by_id[
                candidate["source_variant_id"]
            ]
            destination_variant = variants_by_id[
                candidate["destination_variant_id"]
            ]
            alighting_point = transit_points_by_id[source_point_id]
            boarding_point = transit_points_by_id[destination_point_id]

            TransitTransferService.validate_transfer_memberships(
                source_variant,
                destination_variant,
                alighting_point,
                boarding_point,
            )

            _, created = TransitTransfer.objects.get_or_create(
                TTFR_FROM_VARIANT_ID=source_variant,
                TTFR_TO_VARIANT_ID=destination_variant,
                TTFR_FROM_TRANSIT_POINT_ID=alighting_point,
                TTFR_TO_TRANSIT_POINT_ID=boarding_point,
                defaults={
                    "TTFR_STATUS": TransitTransfer.TransferStatus.PENDING,
                },
            )

            if created:
                summary["candidates_created"] += 1
                existing_connections.add(connection_key)
            else:
                summary["candidates_skipped_existing"] += 1

        return summary
