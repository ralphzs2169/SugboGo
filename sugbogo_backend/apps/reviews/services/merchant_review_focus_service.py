from django.db.models import Q
from rest_framework.exceptions import NotFound

from apps.reviews.models import Review


class MerchantReviewFocusService:
    """Locate an owned business's published review within its newest-first feed."""

    @staticmethod
    def locate(
        *,
        user,
        business_id,
        review_id,
        page_size,
    ):
        """Return a page location without exposing another merchant's reviews."""
        reviews = Review.objects.filter(
            BUSN_ID_id=business_id,
            BUSN_ID__USER_ID=user,
            REVW_STATUS=Review.ReviewStatus.PUBLISHED,
        )
        try:
            review = reviews.get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound("This review is no longer available.") from None

        newer_count = reviews.filter(
            Q(REVW_CREATED_AT__gt=review.REVW_CREATED_AT)
            | Q(
                REVW_CREATED_AT=review.REVW_CREATED_AT,
                REVW_ID__gt=review.REVW_ID,
            ),
        ).count()
        return {
            "review_id": review.REVW_ID,
            "page": newer_count // page_size + 1,
            "page_size": page_size,
        }
