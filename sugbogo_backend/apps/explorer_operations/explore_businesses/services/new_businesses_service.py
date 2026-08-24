from django.db.models import Exists, OuterRef, Prefetch

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
    SpecialtyTag,
)


class NewBusinessesService:
    """Service class for retrieving newly added businesses for Explorer."""

    @staticmethod
    def list_new_businesses(user):
        """Retrieve active businesses with the current user's interaction state."""

        user_pocket_exists = BusinessPocket.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
        )

        user_vouch_exists = BusinessVouch.objects.filter(
            BUSN_ID=OuterRef("business_links__BUSN_ID"),
            USER_ID=user,
            TAG_ID=OuterRef("TAG_ID"),
        )

        specialty_tags = (
            SpecialtyTag.objects
            .annotate(
                is_vouched=Exists(
                    user_vouch_exists,
                ),
            )
        )

        return (
            Business.objects
            .select_related(
                "CTGRY_ID",
                "CTGRY_ID__CLUS_ID",
                "LOCT_ID",
            )
            .annotate(
                is_pocketed=Exists(
                    user_pocket_exists,
                ),
            )
            .prefetch_related(
                Prefetch(
                    "SPECIALTY_TAGS",
                    queryset=specialty_tags,
                ),
            )
            .filter(
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .order_by(
                "-BUSN_CREATED_AT",
            )
        )