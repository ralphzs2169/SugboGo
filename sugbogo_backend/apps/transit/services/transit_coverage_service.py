from django.conf import settings


class TransitCoverageService:
    """Provides the configured Explorer origin-search area."""

    @staticmethod
    def get_autocomplete_location_restriction():
        """Build Google's rectangle from the centralized MVP search scope."""

        search_area = settings.JOURNEY_ORIGIN_SEARCH_AREA
        southwest = search_area["southwest"]
        northeast = search_area["northeast"]

        return {
            "rectangle": {
                "low": {
                    "latitude": southwest["latitude"],
                    "longitude": southwest["longitude"],
                },
                "high": {
                    "latitude": northeast["latitude"],
                    "longitude": northeast["longitude"],
                },
            },
        }
