from django.contrib.gis.geos import Polygon
from django.db.models import (
    BooleanField,
    Case,
    Prefetch,
    Subquery,
    Value,
    When,
)

from apps.business.models import BusinessSpecialtyTag
from apps.business.services.display_cover_photo import display_cover_photo_expression

from .discovery_feed_service import DiscoveryFeedService


class MapDiscoveryService:
    """Build bounded public map queries independently of global gem membership."""

    @staticmethod
    def list_viewport_businesses(
        *,
        north,
        south,
        east,
        west,
    ):
        """Return a lazy, optimized queryset inside previously validated map bounds."""
        viewport = Polygon.from_bbox(
            (
                west,
                south,
                east,
                north,
            ),
        )
        viewport.srid = 4326

        active_specialties = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
            )
            .select_related(
                "TAG_ID",
            )
            .only(
                "BUSN_ID",
                "TAG_ID__TAG_ID",
                "TAG_ID__TAG_NAME",
                "TAG_ID__TAG_COLOR",
                "TAG_ID__TAG_ICON",
            )
            .order_by(
                "TAG_ID_id",
            )
        )

        # Keep this subquery global: map bounds and future filters only narrow
        # the outer queryset, never the homepage's Top 10 membership.
        hidden_gem_ids = DiscoveryFeedService.list_global_hidden_gem_ids()

        return (
            DiscoveryFeedService.list_eligible_businesses()
            .filter(
                LOCT_ID__LOCT_POINT__intersects=viewport,
            )
            .select_related(
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .only(
                "BUSN_ID",
                "BUSN_NAME",
                "BUSN_COVER_PHOTO_URL",
                "CTGRY_ID__CTGRY_ID",
                "CTGRY_ID__CTGRY_NAME",
                "CTGRY_ID__CLUS_ID__CLUS_ID",
                "CTGRY_ID__CLUS_ID__CLUS_NAME",
                "CTGRY_ID__CLUS_ID__CLUS_ICON",
                "LOCT_ID__LOCT_ID",
                "LOCT_ID__LOCT_ADDRESS",
                "LOCT_ID__LOCT_CITY",
                "LOCT_ID__LOCT_PROVINCE",
                "LOCT_ID__LOCT_POINT",
            )
            .annotate(
                display_cover_photo_url=display_cover_photo_expression(),
                is_hidden_gem=Case(
                    When(
                        BUSN_ID__in=Subquery(
                            hidden_gem_ids,
                        ),
                        then=Value(True),
                    ),
                    default=Value(False),
                    output_field=BooleanField(),
                ),
            )
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=active_specialties,
                    to_attr="active_specialty_tag_links",
                ),
            )
            .order_by(
                "-is_hidden_gem",
                "BUSN_ID",
            )
        )
