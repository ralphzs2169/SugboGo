from django.db.models import Exists, OuterRef, Subquery

from apps.business.models import Business
from apps.business.services.display_cover_photo import (
    display_cover_photo_expression,
)
from apps.reviews.models import Review, ReviewLike, ReviewPhoto


class CommunityReviewService:
    """Builds the public cross-business review feed for Community."""

    @staticmethod
    def list_reviews_queryset(
        user,
        ordering="newest",
        cluster_id=None,
        has_photos=False,
    ):
        """Return eligible Community reviews in deterministic feed order."""

        user_likes = ReviewLike.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=user,
        )
        owner_likes = ReviewLike.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=OuterRef("BUSN_ID__USER_ID"),
        )
        own_reviews = Review.objects.filter(
            REVW_ID=OuterRef("REVW_ID"),
            USER_ID=user,
        )
        display_business = (
            Business.objects
            .filter(
                BUSN_ID=OuterRef("BUSN_ID_id"),
            )
            .annotate(
                display_cover_photo_url=display_cover_photo_expression(),
            )
            .values("display_cover_photo_url")[:1]
        )

        reviews = (
            Review.objects
            .select_related(
                "USER_ID",
                "BUSN_ID",
                "BUSN_ID__CTGRY_ID",
                "BUSN_ID__LOCT_ID",
            )
            .annotate(
                is_liked=Exists(user_likes),
                is_liked_by_owner=Exists(owner_likes),
                is_own_review=Exists(own_reviews),
                community_display_cover_photo_url=Subquery(
                    display_business,
                ),
            )
            .prefetch_related(
                "photos",
                "reply__photos",
            )
            .filter(
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
                BUSN_ID__BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        )

        if cluster_id is not None:
            reviews = reviews.filter(
                BUSN_ID__CTGRY_ID__CLUS_ID_id=cluster_id,
            )

        if has_photos:
            photos = ReviewPhoto.objects.filter(
                REVW_ID_id=OuterRef("pk"),
            )
            reviews = reviews.filter(
                Exists(photos),
            )

        ordering_fields = {
            "newest": (
                "-REVW_CREATED_AT",
                "-REVW_ID",
            ),
            "most_helpful": (
                "-REVW_LIKE_COUNT",
                "-REVW_CREATED_AT",
                "-REVW_ID",
            ),
        }

        return reviews.order_by(
            *ordering_fields[ordering],
        )
