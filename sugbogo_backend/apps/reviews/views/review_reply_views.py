from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.review_reply_serializers import (
    ReviewReplyCreateSerializer,
    ReviewReplyResponseSerializer,
    ReviewReplyUpdateSerializer,
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
            data={
                "text": request.data.get("text"),
                "photos": request.FILES.getlist("photos"),
            },
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


class ReviewReplyDetailView(APIView):
    """Handle updating and deleting business-owner review replies."""

    permission_classes = ReviewReplyView.permission_classes

    def patch(
        self,
        request,
        reply_id,
    ):
        """Update a business-owner review reply."""

        data = {
            "photos": request.FILES.getlist(
                "photos",
            ),
        }

        if "text" in request.data:
            data["text"] = request.data.get(
                "text",
            )

        if "keep_photo_ids" in request.data:
            if hasattr(
                request.data,
                "getlist",
            ):
                data["keep_photo_ids"] = request.data.getlist(
                    "keep_photo_ids",
                )
            else:
                data["keep_photo_ids"] = request.data.get(
                    "keep_photo_ids",
                )

        serializer = ReviewReplyUpdateSerializer(
            data=data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        reply = ReviewReplyService.update_reply(
            user=request.user,
            reply_id=reply_id,
            **serializer.validated_data,
        )

        return success_response(
            data=ReviewReplyResponseSerializer(
                reply,
            ).data,
            message="Review reply updated successfully.",
        )

    def delete(
        self,
        request,
        reply_id,
    ):
        """Delete a business-owner review reply."""

        ReviewReplyService.delete_reply(
            user=request.user,
            reply_id=reply_id,
        )

        return success_response(
            data={
                "reply_id": reply_id,
            },
            message="Review reply deleted successfully.",
        )


class ReplyPhotoView(APIView):
    """Handle deleting photos attached to business-owner review replies."""

    permission_classes = ReviewReplyView.permission_classes

    def delete(
        self,
        request,
        photo_id,
    ):
        """Delete a reply photo."""

        ReviewReplyService.delete_photo(
            user=request.user,
            photo_id=photo_id,
        )

        return success_response(
            data={
                "photo_id": photo_id,
            },
            message="Reply photo deleted successfully.",
        )