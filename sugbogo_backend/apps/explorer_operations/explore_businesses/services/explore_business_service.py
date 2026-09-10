from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
)
from apps.reviews.models import (
    ReviewLike,
    Review,
)
from django.db.models import Exists, OuterRef, Prefetch
from rest_framework.exceptions import NotFound


class ExploreBusinessService:
    """Service class for Explorer-facing business discovery queries."""

    @staticmethod
    def get_business_detail(business_id, user):
        """Retrieve an active business and its public Explorer details."""

        user_vouch_exists = BusinessVouch.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
            TAG_ID=OuterRef("TAG_ID"),
        )

        user_pocket_exists = BusinessPocket.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            USER_ID=user,
        )

        user_review_like_exists = ReviewLike.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=user,
        )

        specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
            )
            .select_related(
                "TAG_ID",
            )
            .annotate(
                is_vouched=Exists(
                    user_vouch_exists,
                ),
            )
        )

        reviews = (
            Review.objects
            .select_related(
                "USER_ID",
            )
            .annotate(
                is_liked=Exists(
                    user_review_like_exists,
                ),
            )
            .prefetch_related(
                "photos",
                "reply__photos",
            )
            .order_by(
                "-REVW_CREATED_AT",
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
                        "specialty_tag_links",
                        queryset=specialty_tags,
                        to_attr="active_specialty_tag_links",
                    ),
                    "photos",
                    "operating_hours",
                    Prefetch(
                        "reviews",
                        queryset=reviews,
                    ),
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
