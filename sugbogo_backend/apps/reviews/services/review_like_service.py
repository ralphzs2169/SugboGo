from django.db import IntegrityError, models, transaction
from django.db.models.functions import Greatest
from rest_framework.exceptions import NotFound, ValidationError

from apps.reviews.models import Review, ReviewLike
from apps.users.models import User


class ReviewLikeService:
    """Handles liking and unliking business reviews."""

    @staticmethod
    @transaction.atomic
    def create_like(
        user: User,
        review_id: int,
    ) -> ReviewLike:
        try:
            review = Review.objects.get(
                REVW_ID=review_id,
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        try:
            like = ReviewLike.objects.create(
                REVW_ID=review,
                USER_ID=user,
            )
        except IntegrityError:
            raise ValidationError(
                "You have already liked this review.",
            ) from None

        Review.objects.filter(
            REVW_ID=review.REVW_ID,
        ).update(
            REVW_LIKE_COUNT=models.F(
                "REVW_LIKE_COUNT",
            ) + 1,
        )

        return like


    @staticmethod
    @transaction.atomic
    def remove_like(
        user: User,
        review_id: int,
    ) -> None:
        try:
            like = ReviewLike.objects.get(
                REVW_ID=review_id,
                USER_ID=user,
            )
        except ReviewLike.DoesNotExist:
            raise NotFound(
                "Your like could not be found.",
            )

        like.delete()

        Review.objects.filter(
            REVW_ID=review_id,
        ).update(
            REVW_LIKE_COUNT=Greatest(
                models.F(
                    "REVW_LIKE_COUNT",
                ) - 1,
                0,
            ),
        )

    @staticmethod
    def has_liked(
        user: User,
        review_id: int,
    ) -> bool:
        return ReviewLike.objects.filter(
            REVW_ID=review_id,
            USER_ID=user,
        ).exists()