from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyCreateSerializer,
)
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.users.models import User


class ReviewReplyView(APIView):
    """Handle business-owner replies to reviews."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, review_id):
        """Create a reply to a business review."""

        serializer = ReviewReplyCreateSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        reply = ReviewReplyService.create_reply(
            user=request.user,
            review_id=review_id,
            **serializer.validated_data,
        )

        return success_response(
            data={
                "id": reply.RPLY_ID,
                "review_id": reply.REVW_ID_id,
                "text": reply.RPLY_TEXT,
            },
            message="Review reply added successfully.",
        )