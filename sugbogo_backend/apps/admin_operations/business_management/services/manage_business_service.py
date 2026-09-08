from django.db.models import Prefetch
from rest_framework.exceptions import NotFound

from apps.business.models import Business, BusinessSpecialtyTag
from apps.reviews.models import Review


class BusinessService:
    """Service class for administrator-facing business management queries."""

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

        active_specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
            )
            .select_related(
                "TAG_ID",
            )
        )

        queryset = (
            Business.objects
            .select_related(
                "USER_ID",
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .prefetch_related(
                Prefetch(
                    "specialty_tag_links",
                    queryset=active_specialty_tags,
                    to_attr="active_specialty_tag_links",
                ),
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
        active_specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
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
            return (
                Business.objects
                .select_related(
                    "USER_ID",
                    "CTGRY_ID",
                    "CTGRY_ID__CLUS_ID",
                    "LOCT_ID",
                    "merchant_application",
                )
                .prefetch_related(
                    Prefetch(
                        "specialty_tag_links",
                        queryset=active_specialty_tags,
                        to_attr="active_specialty_tag_links",
                    ),
                    "photos",
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
