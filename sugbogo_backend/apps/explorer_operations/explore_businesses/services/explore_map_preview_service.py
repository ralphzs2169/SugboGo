from apps.business.models import Business
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

MAP_PREVIEW_RADIUS_KM = 3
MAP_PREVIEW_LIMIT = 30


class ExploreMapPreviewService:
    """Service for Explorer-facing business map queries."""

    @staticmethod
    def list_nearby_preview_businesses(
        latitude,
        longitude,
    ):
        """
        Retrieve active businesses near the explorer for the map preview.

        Results are restricted to a small nearby radius and ordered by
        geographic distance to keep the preview payload lightweight.
        """

        user_point = Point(
            float(longitude),
            float(latitude),
            srid=4326,
        )

        return (
            Business.objects
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                LOCT_ID__LOCT_POINT__distance_lte=(
                    user_point,
                    D(km=MAP_PREVIEW_RADIUS_KM),
                ),
            )
            .annotate(
                distance=Distance(
                    "LOCT_ID__LOCT_POINT",
                    user_point,
                ),
            )
            .order_by(
                "distance",
                "BUSN_ID",
            )[:MAP_PREVIEW_LIMIT]
        )