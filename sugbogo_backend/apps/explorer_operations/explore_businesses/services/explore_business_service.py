from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessVouch,
    SpecialtyTag,
)
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from rest_framework.exceptions import NotFound


class ExploreBusinessService:
    """Service class for Explorer-facing business discovery queries."""

    @staticmethod
    def get_business_detail(business_id, user):
        """Retrieve an active business and its public Explorer details."""

        user_vouch_exists = BusinessVouch.objects.filter(
            BUSN_ID=business_id,
            USER_ID=user,
            TAG_ID=OuterRef("TAG_ID"),
        )

        user_pocket_exists = BusinessPocket.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
        )

        specialty_tags = (
            SpecialtyTag.objects
            .annotate(
                vouch_count=Count(
                    "vouches",
                    filter=Q(
                        vouches__BUSN_ID=business_id,
                    ),
                    distinct=True,
                ),
                is_vouched=Exists(
                    user_vouch_exists,
                ),
            )
        )

        try:
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