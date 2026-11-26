"""Load a verified, revision-pinned graph from the configured runtime storage."""

import ipaddress
import re
from functools import lru_cache
from pathlib import Path

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


def _development_graph_root():
    """Resolve the local graph directory after verifying the database is loopback."""
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
    return settings.BASE_DIR / ".connection-graphs"


def configured_development_connection_graph():
    """Load the pinned graph for the explicitly selected environment."""
    development_enabled = settings.EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED
    production_enabled = settings.EXPERIMENTAL_ITINERARY_PRODUCTION_GRAPH_ENABLED
    if not development_enabled and not production_enabled:
        return None
    if development_enabled and production_enabled:
        raise ValueError("Enable only one transfer graph mode.")

    if production_enabled:
        if settings.DEBUG or connection.vendor != "postgresql":
            raise ValueError("Production graph access requires DEBUG=False and PostGIS.")
        root = Path(settings.RAILWAY_VOLUME_MOUNT_PATH)
        if not root.is_absolute():
            raise ValueError("Production graph access requires an absolute Railway volume mount path.")
    else:
        root = _development_graph_root()

    revision = settings.EXPERIMENTAL_ITINERARY_GRAPH_REVISION
    checksum = settings.EXPERIMENTAL_ITINERARY_GRAPH_SHA256
    if (
        not re.fullmatch(r"[0-9a-f]{64}", revision)
        or not re.fullmatch(r"[0-9a-f]{64}", checksum)
    ):
        raise ValueError("Configure an explicit graph revision and checksum.")
    directory = root / revision
    stat = (directory / INDEX_NAME).stat()
    index = _reader(
        directory,
        checksum,
        (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns),
    )
    if index.revision != revision:
        raise ValueError("The graph directory does not match its configured revision.")
    return index
