from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.business.models import Business, BusinessPhoto, BusinessSpecialtyTag
from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.business.services.pocket_service import PocketService
from apps.business.services.vouch_service import VouchService
from apps.explorer_operations.explore_businesses.services.published_review_count import (
    published_review_count,
)
from apps.reviews.models import Review


class BusinessService:
    """Service class for administrator-facing business management queries."""

    @staticmethod
    def get_business_for_review_insights_refresh(business_id: int) -> Business:
        """Checks that a business exists before its refresh task is queued."""
        try:
            return Business.objects.get(BUSN_ID=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None

    @staticmethod
    def list_businesses(
        search=None,
        ordering=None,
        status=None,
        cluster=None,
        category=None,
        specialty_tag=None,
    ):
        """
        Retrieve businesses for the admin business management table.

        Supports optional business-name search, status filtering, classification
        filtering, specialty-tag filtering, and ordering while eagerly loading
        the relationships required by the list serializer.
        """

        queryset = (
            Business.objects
            .select_related(
                "USER_ID",
                "merchant_application",
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )

        )

        if search:
            queryset = queryset.filter(BUSN_NAME__icontains=search)

        if status:
            queryset = queryset.filter(BUSN_STATUS=status)

        if cluster:
            queryset = queryset.filter(CTGRY_ID__CLUS_ID=cluster)

        if category:
            queryset = queryset.filter(CTGRY_ID=category)

        if specialty_tag:
            queryset = queryset.filter(
                specialty_tag_links__TAG_ID=specialty_tag,
                specialty_tag_links__BST_IS_ACTIVE=True,
            )

        ordering_map = {
            "business_name": "BUSN_NAME",
            "-business_name": "-BUSN_NAME",
            "status": "BUSN_STATUS",
            "-status": "-BUSN_STATUS",
            "created_at": "BUSN_CREATED_AT",
            "-created_at": "-BUSN_CREATED_AT",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "-BUSN_CREATED_AT",
            )
        )

    @staticmethod
    def list_business_locations(
        search=None,
        status=None,
        cluster=None,
        category=None,
        specialty_tag=None,
    ):
        """
        Retrieve businesses with valid coordinates for the administrator map.

        Supports the same filtering criteria as list_businesses so the map
        reflects the same filtered business subset as the table.
        """

        queryset = (
            Business.objects
            .annotate(
                display_cover_photo_url=display_cover_photo_expression(),
            )
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .filter(
                LOCT_ID__LOCT_POINT__isnull=False,
            )
        )

        if search:
            queryset = queryset.filter(
                BUSN_NAME__icontains=search,
            )

        if status:
            queryset = queryset.filter(
                BUSN_STATUS=status,
            )

        if cluster:
            queryset = queryset.filter(
                CTGRY_ID__CLUS_ID=cluster,
            )

        if category:
            queryset = queryset.filter(
                CTGRY_ID=category,
            )

        if specialty_tag:
            queryset = queryset.filter(
                specialty_tag_links__TAG_ID=specialty_tag,
                specialty_tag_links__BST_IS_ACTIVE=True,
            )

        return queryset.order_by("BUSN_NAME")

    @staticmethod
    def get_business_detail(business_id):
        """Load authoritative relational metrics and stored insights without analytics I/O."""
        as_of = timezone.now()
        active_specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
                BST_CREATED_AT__lte=as_of,
            )
            .select_related(
                "TAG_ID",
            )
        )

        latest_reviews = (
            Review.objects
            .filter(
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            )
            .select_related(
                "USER_ID",
            )
            .prefetch_related(
                "photos",
                "reply__photos",
            )
            .order_by("-REVW_CREATED_AT")[:3]
        )

        try:
            business = (
                Business.objects
                .annotate(
                    display_cover_photo_url=display_cover_photo_expression(),
                    published_review_count=published_review_count(),
                )
                .select_related(
                    "USER_ID",
                    "CTGRY_ID",
                    "CTGRY_ID__CLUS_ID",
                    "LOCT_ID",
                    "merchant_application",
                    "merchant_application__identity",
                    "merchant_application__identity__CLUS_ID",
                    "merchant_application__identity__CTGRY_ID",
                    "business_rating",
                    "review_summary",
                    "review_insight_regeneration",
                )
                .prefetch_related(
                    Prefetch(
                        "specialty_tag_links",
                        queryset=active_specialty_tags,
                        to_attr="active_specialty_tag_links",
                    ),
                    Prefetch(
                        "photos",
                        queryset=BusinessPhoto.objects.order_by("BPHO_ID"),
                    ),
                    "LOCT_ID__landmarks",
                    "merchant_application__identity__specialty_tags",
                    "operating_hours",
                    Prefetch(
                        "reviews",
                        queryset=latest_reviews,
                        to_attr="latest_reviews",
                    ),
                )
                .get(
                    BUSN_ID=business_id,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

        business.current_specialty_support = VouchService.get_current_specialty_support(
            business_id,
            as_of=as_of,
        )
        business.current_specialty_vouch_count = sum(
            specialty["valid_vouches"]
            for specialty in business.current_specialty_support
        )
        support_by_id = {
            specialty["specialty_id"]: specialty["valid_vouches"]
            for specialty in business.current_specialty_support
        }
        for link in business.active_specialty_tag_links:
            link.current_valid_vouch_count = support_by_id.get(link.TAG_ID_id, 0)

        business.current_saved_count = PocketService.get_current_holder_count(
            business_id,
            as_of=as_of,
        )
        return business
