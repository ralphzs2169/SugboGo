from apps.business.models import Business
from rest_framework.exceptions import NotFound


class ExploreBusinessService:
    """Service class for Explorer-facing business discovery queries."""

    @staticmethod
    def get_business_detail(business_id):
        """Retrieve an active business and its public Explorer details."""

        try:
            return (
                Business.objects
                .select_related(
                    "CTGRY_ID",
                    "CTGRY_ID__CLUS_ID",
                    "LOCT_ID",
                )
                .prefetch_related(
                    "SPECIALTY_TAGS",
                    "photos",
                    "operating_hours",
                )
                .get(
                    BUSN_ID=business_id,
                    BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )