"""Gate revision-pinned graph access to explicitly enabled local development."""

import ipaddress
import logging
import re
from functools import lru_cache

from django.conf import settings
from django.db import connection
from rest_framework.exceptions import APIException

from apps.transit.services.development_connection_graph_index import INDEX_NAME, DevelopmentConnectionGraphIndex
from apps.transit.services.managed_development_connection_index import ManagedDevelopmentConnectionIndex

logger = logging.getLogger(__name__)


class ItineraryGraphUnavailable(APIException):
    """Fail closed rather than silently switch to unindexed discovery."""

    status_code = 503
    default_code = "itinerary_graph_unavailable"
    default_detail = "The local experimental graph is unavailable or incompatible."


@lru_cache(maxsize=1)
def _reader(
    directory,
    checksum,
    index_identity,
):
    """Reuse compact verified metadata without caching managed database identities."""
    index = DevelopmentConnectionGraphIndex(directory)
    if index.graph_sha256 != checksum:
        raise ValueError("The configured graph checksum does not match its manifest.")
    return index


def experimental_connection_index(
    *,
    route_geometries,
    route_codes,
):
    """Validate the local database, graph pin and current managed inventory."""
    if not settings.EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED:
        return None
    try:
        database = connection.settings_dict
        if (
            not settings.DEBUG
            or connection.vendor != "postgresql"
            or database["HOST"] not in {"localhost", "127.0.0.1", "::1"}
        ):
            raise ValueError("Development graph access requires a local debug backend.")
        with connection.cursor() as cursor:
            cursor.execute("SELECT inet_server_addr()::text")
            address = cursor.fetchone()[0]
        if not address or not ipaddress.ip_interface(address).ip.is_loopback:
            raise ValueError("The connected PostgreSQL server is not local.")
        revision = settings.EXPERIMENTAL_ITINERARY_GRAPH_REVISION
        checksum = settings.EXPERIMENTAL_ITINERARY_GRAPH_SHA256
        if (
            not re.fullmatch(r"[0-9a-f]{64}", revision)
            or not re.fullmatch(r"[0-9a-f]{64}", checksum)
        ):
            raise ValueError("Configure an explicit graph revision and checksum.")
        directory = settings.BASE_DIR / ".connection-graphs" / revision
        stat = (directory / INDEX_NAME).stat()
        index = _reader(
            directory,
            checksum,
            (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns),
        )
        if index.revision != revision:
            raise ValueError("The graph directory does not match its configured revision.")
        return ManagedDevelopmentConnectionIndex(
            index=index,
            route_geometries=route_geometries,
            route_codes=route_codes,
        )
    except (OSError, ValueError, KeyError, TypeError) as error:
        logger.warning("Local experimental graph rejected: %s", error)
        raise ItineraryGraphUnavailable() from error
