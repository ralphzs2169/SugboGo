from django.db.models import Q
from rest_framework.exceptions import NotFound

from apps.reviews.models import Review
from apps.reviews.services.review_service import ReviewService


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

    @staticmethod
    def get_owned_review(
        *,
        user,
        business_id,
        review_id,
    ):
        """Read one published owned review through the existing serialization path."""
        try:
            review = ReviewService._annotated_review_queryset(user).get(
                BUSN_ID_id=business_id,
                BUSN_ID__USER_ID=user,
                REVW_ID=review_id,
                REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            )
        except Review.DoesNotExist:
            raise NotFound("This review is no longer available.") from None

        return ReviewService._attach_vouched_specialties([review])[0]
