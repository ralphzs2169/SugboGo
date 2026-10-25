from decimal import Decimal

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Case, DecimalField, F, IntegerField, Value, When

from .new_businesses_service import NewBusinessesService
from .operating_hours_filter_service import apply_open_now_filter


class OpenNowBusinessesService:
    """Select a bounded nearby preview using listed hours and measured visibility."""

    RADIUS_KM = 3
    PREVIEW_LIMIT = 6
    NEUTRAL_VISIBILITY_GAP = Decimal("0.50000")

    @staticmethod
    def list_open_now_businesses(
        user,
        latitude,
        longitude,
        at=None,
    ):
        """Rank all eligible businesses before selecting the six-place preview."""
        user_point = Point(
            float(longitude),
            float(latitude),
            srid=4326,
        )
        queryset = NewBusinessesService.list_new_businesses(
            user=user,
        ).filter(
            LOCT_ID__LOCT_POINT__distance_lte=(
                user_point,
                D(km=OpenNowBusinessesService.RADIUS_KM),
            ),
        )
        queryset = apply_open_now_filter(
            queryset,
            at=at,
        ).annotate(
            nearby_distance=Distance(
                "LOCT_ID__LOCT_POINT",
                user_point,
            ),
            # Provisional records start at one without measured evidence.
            nearby_visibility_gap=Case(
                When(
                    discovery_score__DSC_IS_PROVISIONAL=False,
                    discovery_score__DSC_COMPUTED_AT__isnull=False,
                    then=F("discovery_score__DSC_V_SCORE"),
                ),
                default=Value(
                    OpenNowBusinessesService.NEUTRAL_VISIBILITY_GAP,
                ),
                output_field=DecimalField(
                    max_digits=6,
                    decimal_places=5,
                ),
            ),
        ).annotate(
            nearby_distance_band=Case(
                When(
                    nearby_distance__lte=D(km=1),
                    then=Value(0),
                ),
                When(
                    nearby_distance__lte=D(km=2),
                    then=Value(1),
                ),
                default=Value(2),
                output_field=IntegerField(),
            ),
        )

        return queryset.order_by(
            "nearby_distance_band",
            "-nearby_visibility_gap",
            "nearby_distance",
            "BUSN_ID",
        )[:OpenNowBusinessesService.PREVIEW_LIMIT]
