from rest_framework.exceptions import NotFound

from apps.business.models import Business
from apps.shared.services.google_routes_service import GoogleRoutesService


class RoadRouteService:
    """Build Explorer road-route results from authoritative business locations."""

    @staticmethod
    def get_road_route(
        *,
        business_id,
        latitude,
        longitude,
    ):
        """Return a normalized driving route from an Explorer to a business."""

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

        destination = location.LOCT_POINT
        route = GoogleRoutesService.compute_road_route(
            origin_latitude=latitude,
            origin_longitude=longitude,
            destination_latitude=destination.y,
            destination_longitude=destination.x,
        )

        if route is None:
            return {
                "route": None,
            }

        return {
            "route": {
                **route,
                "origin": {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                "destination": {
                    "latitude": destination.y,
                    "longitude": destination.x,
                },
            },
        }
