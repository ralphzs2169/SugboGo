from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.users.models import User


class ReviewLikeView(APIView):
    """Handle liking and unliking business reviews."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, review_id):
        """Like a business review."""

        like = ReviewLikeService.create_like(
            user=request.user,
            review_id=review_id,
        )

        return success_response(
            data={
                "id": like.RLIK_ID,
                "review_id": like.REVW_ID_id,
                "is_liked": True,
            },
            message="Review liked successfully.",
        )

    def delete(self, request, review_id):
        """Remove the authenticated user's like from a review."""

        ReviewLikeService.remove_like(
            user=request.user,
            review_id=review_id,
        )

        return success_response(
            data={
                "review_id": review_id,
                "is_liked": False,
            },
            message="Review like removed successfully.",
        )

