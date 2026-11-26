"""Load the verified graph pinned to local development settings."""

import ipaddress
import re
from functools import lru_cache

from django.conf import settings
from django.db import connection

from apps.transit.services.development_connection_graph_index import (
    INDEX_NAME,
    DevelopmentConnectionGraphIndex,
)


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


def configured_development_connection_graph():
    """Return the pinned local graph when enabled, or raise if it cannot be verified."""
    if not settings.EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED:
        return None
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
    if not address or not ipaddress.ip_interface(address).is_loopback:
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
    return index
