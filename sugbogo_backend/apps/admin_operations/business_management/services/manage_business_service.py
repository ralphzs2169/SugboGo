from rest_framework.exceptions import NotFound

from apps.business.models import Business


class BusinessService:
    """Service class for administrator-facing business management queries."""

    @staticmethod
    def list_businesses(
        search=None,
        ordering=None,
        status=None,
    ):
        """
        Retrieve businesses for the admin business management table.

        Supports optional business-name search, status filtering, and
        ordering while eagerly loading the relationships required
        by the list serializer.
        """

        queryset = (
            Business.objects
            .select_related(
                "USER_ID",
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .prefetch_related(
                "SPECIALTY_TAGS",
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

        ordering_map = {
            "business_name": "BUSN_NAME",
            "-business_name": "-BUSN_NAME",
            "status": "BUSN_STATUS",
            "-status": "-BUSN_STATUS",
            "created_at": "BUSN_CREATED_AT",
            "-created_at": "-BUSN_CREATED_AT",
        }

        if ordering:
            return queryset.order_by(
                ordering_map.get(
                    ordering,
                    "-BUSN_CREATED_AT",
                )
            )

        return queryset.order_by(
            "-BUSN_CREATED_AT",
        )

    @staticmethod
    def list_business_locations():
        """
        Retrieve businesses with valid coordinates for the administrator map.
        """

        return (
            Business.objects
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .filter(
                LOCT_ID__LOCT_POINT__isnull=False,
            )
            .order_by(
                "BUSN_NAME",
            )
        )

    @staticmethod
    def get_business_detail(business_id):
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
                    "SPECIALTY_TAGS",
                    "photos",
                    "operating_hours",
                )
                .get(
                    BUSN_ID=business_id,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )