from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.review_serializers import (
    ReviewCreateSerializer,
    ReviewReportSerializer,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewView(APIView):
    """Handle creating reviews for businesses."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, business_id):
        """Create a review for a business."""

        serializer = ReviewCreateSerializer(
            data={
                "text": request.data.get("text"),
                "device_id": request.data.get("device_id"),
                "photos": request.FILES.getlist("photos"),
            },
        )
        serializer.is_valid(raise_exception=True)

        review = ReviewService.create_review(
            user=request.user,
            business_id=business_id,
            **serializer.validated_data,
        )

        return success_response(
            data={
                "id": review.REVW_ID,
                "business_id": review.BUSN_ID_id,
                "user_id": review.USER_ID_id,
            },
            message="Review added successfully.",
        )


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

        like = ReviewService.create_like(
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

        ReviewService.remove_like(
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


class ReviewReportView(APIView):
    """Handle reporting business reviews."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(self, request, review_id):
        """Submit a report against a business review."""

        serializer = ReviewReportSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        report = ReviewService.create_report(
            user=request.user,
            review_id=review_id,
            **serializer.validated_data,
        )

        return success_response(
            data={
                "id": report.RREP_ID,
                "review_id": report.REVW_ID_id,
                "status": report.RREP_STATUS,
            },
            message="Review reported successfully.",
        )