"""Controlled app-reported opening origins, separate from visit identity."""

from enum import StrEnum


class DiscoverySource(StrEnum):
    EXPLORE_DISCOVERY = "EXPLORE_DISCOVERY"
    SEARCH_RESULTS = "SEARCH_RESULTS"
    MAP = "MAP"
    COLLECTION = "COLLECTION"
    SIMILAR_BUSINESSES = "SIMILAR_BUSINESSES"
    COMMUNITY = "COMMUNITY"
    UNKNOWN = "UNKNOWN"


DISCOVERY_SOURCE_LABELS = {
    DiscoverySource.EXPLORE_DISCOVERY: "Explore",
    DiscoverySource.SEARCH_RESULTS: "Search & filtered results",
    DiscoverySource.MAP: "Map",
    DiscoverySource.COLLECTION: "Discovery lists",
    DiscoverySource.SIMILAR_BUSINESSES: "Similar places",
    DiscoverySource.COMMUNITY: "Community",
    DiscoverySource.UNKNOWN: "Source not recorded",
}


def normalize_discovery_source(value):
    """Keep only approved exact strings; unsupported revisit origins stay unknown."""
    if isinstance(value, str) and value in DISCOVERY_SOURCE_LABELS:
        return value
    return DiscoverySource.UNKNOWN.value
