from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.reviews.models import (
    Review,
    ReviewReply,
)
from apps.users.models import User


class ReviewReplyService:
    """Handles creating business-owner replies to business reviews."""

    @staticmethod
    @transaction.atomic
    def create_reply(
        user: User,
        review_id: int,
        text: str,
    ) -> ReviewReply:
        try:
            review = (
                Review.objects
                .select_related("BUSN_ID")
                .get(
                    REVW_ID=review_id,
                )
            )
        except Review.DoesNotExist:
            raise NotFound(
                "The review could not be found.",
            )

        if review.BUSN_ID.USER_ID_id != user.USER_ID:
            raise PermissionDenied(
                "You do not have permission to reply to this review.",
            )

        try:
            return ReviewReply.objects.create(
                REVW_ID=review,
                RPLY_TEXT=text,
            )
        except IntegrityError:
            raise ValidationError(
                "This review already has a reply.",
            )