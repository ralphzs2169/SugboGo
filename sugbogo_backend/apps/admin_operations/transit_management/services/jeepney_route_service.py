from django.db import transaction
from django.db.models import Count, Prefetch
from rest_framework.exceptions import NotFound

from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
)


class JeepneyRouteService:
    """Manage jeepney route codes and route detail retrieval."""

    @staticmethod
    def _variant_queryset():
        """Build the optimized variant queryset used by route details."""

        route_points = (
            RouteTransitPoint.objects
            .select_related(
                "TRPT_ID",
            )
            .order_by(
                "RVTP_SEQUENCE",
            )
        )

        return (
            JeepneyRouteVariant.objects
            .select_related(
                "JRT_ID",
                "JRV_ORIGIN_ID",
                "JRV_DESTINATION_ID",
            )
            .prefetch_related(
                Prefetch(
                    "route_transit_points",
                    queryset=route_points,
                ),
            )
            .order_by(
                "JRV_ID",
            )
        )

    @staticmethod
    def list_routes(
        search=None,
        ordering=None,
    ):
        """List jeepney routes with variant counts."""

        queryset = JeepneyRoute.objects.annotate(
            variant_count=Count(
                "variants",
            ),
        )

        if search:
            queryset = queryset.filter(
                JRT_CODE__icontains=search,
            )

        ordering_map = {
            "code": "JRT_CODE",
            "-code": "-JRT_CODE",
            "created_at": "JRT_CREATED_AT",
            "-created_at": "-JRT_CREATED_AT",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "JRT_CODE",
            ),
        )

    @staticmethod
    def get_route(
        route_id: int,
    ) -> JeepneyRoute:
        """Retrieve a route with its directional variants."""

        try:
            return (
                JeepneyRoute.objects
                .annotate(
                    variant_count=Count(
                        "variants",
                    ),
                )
                .prefetch_related(
                    Prefetch(
                        "variants",
                        queryset=(
                            JeepneyRouteService
                            ._variant_queryset()
                        ),
                    ),
                )
                .get(
                    JRT_ID=route_id,
                )
            )
        except JeepneyRoute.DoesNotExist:
            raise NotFound(
                "The jeepney route could not be found.",
            )

    @staticmethod
    @transaction.atomic
    def create_route(
        validated_data,
    ) -> JeepneyRoute:
        """Create a normalized jeepney route code."""

        return JeepneyRoute.objects.create(
            JRT_CODE=validated_data["code"],
        )

    @staticmethod
    @transaction.atomic
    def update_route(
        route_id: int,
        validated_data,
    ) -> JeepneyRoute:
        """Update a jeepney route code."""

        try:
            route = (
                JeepneyRoute.objects
                .select_for_update()
                .get(
                    JRT_ID=route_id,
                )
            )
        except JeepneyRoute.DoesNotExist:
            raise NotFound(
                "The jeepney route could not be found.",
            )

        if "code" in validated_data:
            route.JRT_CODE = validated_data["code"]
            route.save(
                update_fields=[
                    "JRT_CODE",
                    "JRT_UPDATED_AT",
                ],
            )

        return route
