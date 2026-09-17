from django.contrib.gis.db.models.aggregates import Extent
from django.contrib.gis.geos import Point
from rest_framework.exceptions import ValidationError

from apps.business.models import ServiceableBoundary


class ServiceableBoundaryService:
    """Provides authoritative service-area queries for active boundaries."""

    OUTSIDE_SERVICE_AREA_MESSAGE = (
        "The selected location is outside our current service area "
        "(Cebu City). Please choose a location within city limits."
    )

    @staticmethod
    def is_serviceable(latitude, longitude):
        """Return whether coordinates are covered by an active boundary."""

        point = Point(
            x=longitude,
            y=latitude,
            srid=4326,
        )

        return ServiceableBoundary.objects.filter(
            SBND_IS_ACTIVE=True,
            SBND_BOUNDARY__covers=point,
        ).exists()

    @staticmethod
    def validate_serviceable(
        latitude,
        longitude,
        field_label="location",
    ):
        """Return a point or raise the established service-area error."""

        point = Point(
            x=longitude,
            y=latitude,
            srid=4326,
        )

        if not ServiceableBoundaryService.is_serviceable(
            latitude,
            longitude,
        ):
            raise ValidationError({
                field_label: (
                    ServiceableBoundaryService.OUTSIDE_SERVICE_AREA_MESSAGE
                ),
            })

        return point

    @staticmethod
    def get_active_extent():
        """Return the combined extent of all active serviceable boundaries."""

        result = ServiceableBoundary.objects.filter(
            SBND_IS_ACTIVE=True,
        ).aggregate(
            extent=Extent("SBND_BOUNDARY"),
        )

        return result["extent"]

    @staticmethod
    def get_autocomplete_location_restriction():
        """Build a Google Places rectangle from the active boundary extent."""

        extent = ServiceableBoundaryService.get_active_extent()

        if extent is None:
            return None

        minimum_longitude = extent[0]
        minimum_latitude = extent[1]
        maximum_longitude = extent[2]
        maximum_latitude = extent[3]

        return {
            "rectangle": {
                "low": {
                    "latitude": minimum_latitude,
                    "longitude": minimum_longitude,
                },
                "high": {
                    "latitude": maximum_latitude,
                    "longitude": maximum_longitude,
                },
            },
        }
