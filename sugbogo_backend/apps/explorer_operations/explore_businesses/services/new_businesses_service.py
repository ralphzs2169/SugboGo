from apps.business.models import Business


class NewBusinessesService:
    """Service class for retrieving newly added businesses for Explorer."""

    @staticmethod
    def list_new_businesses():
        """Retrieve active businesses ordered by newest creation date."""

        return (
            Business.objects
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .prefetch_related(
                "SPECIALTY_TAGS",
            )
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .order_by(
                "-BUSN_CREATED_AT",
            )
        )