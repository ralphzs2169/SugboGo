"""Gate revision-pinned graph access to explicitly enabled local development."""

import logging

from rest_framework.exceptions import APIException

from apps.transit.services.configured_development_connection_graph import (
    configured_development_connection_graph,
)
from apps.transit.services.managed_development_connection_index import ManagedDevelopmentConnectionIndex

logger = logging.getLogger(__name__)


class ItineraryGraphUnavailable(APIException):
    """Fail closed rather than silently switch to unindexed discovery."""

    status_code = 503
    default_code = "itinerary_graph_unavailable"
    default_detail = "The local experimental graph is unavailable or incompatible."


def experimental_connection_index(
    *,
    route_geometries,
    route_codes,
):
    """Validate the local database, graph pin and current managed inventory."""
    try:
        index = configured_development_connection_graph()
        if index is None:
            return None
        return ManagedDevelopmentConnectionIndex(
            index=index,
            route_geometries=route_geometries,
            route_codes=route_codes,
        )
    except (OSError, ValueError, KeyError, TypeError) as error:
        logger.warning("Local experimental graph rejected: %s", error)
        raise ItineraryGraphUnavailable() from error
