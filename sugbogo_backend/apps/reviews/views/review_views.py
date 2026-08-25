from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.review_serializers import (
    ReviewCreateSerializer,
    ReviewResponseSerializer,
    ReviewUpdateSerializer,
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


    def get(self, request, business_id):
        reviews = ReviewService.list_reviews(
            business_id, 
            request.user
        )
        
        return success_response(
            data=ReviewResponseSerializer(
                reviews, 
                many=True)
            .data,
            message="Reviews retrieved successfully.",
        )


class ReviewDetailView(APIView):
    """Handle updating and deleting explorer business reviews."""

    permission_classes = ReviewView.permission_classes

    def patch(
        self,
        request,
        review_id,
    ):
        """Update an explorer's business review."""

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

        serializer = ReviewUpdateSerializer(
            data=data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        review = ReviewService.update_review(
            user=request.user,
            review_id=review_id,
            **serializer.validated_data,
        )

        review.is_liked = ReviewService.has_liked(
            user=request.user,
            review_id=review.REVW_ID,
        )

        return success_response(
            data=ReviewResponseSerializer(
                review,
            ).data,
            message="Review updated successfully.",
        )

    def delete(
        self,
        request,
        review_id,
    ):
        """Delete an explorer's business review."""

        ReviewService.delete_review(
            user=request.user,
            review_id=review_id,
        )

        return success_response(
            data={
                "review_id": review_id,
            },
            message="Review deleted successfully.",
        )


class ReviewPhotoView(APIView):
    """Handle deleting photos attached to business reviews."""

    permission_classes = ReviewView.permission_classes

    def delete(
        self,
        request,
        photo_id,
    ):
        """Delete a review photo."""

        ReviewService.delete_photo(
            user=request.user,
            photo_id=photo_id,
        )

        return success_response(
            data={
                "photo_id": photo_id,
            },
            message="Review photo deleted successfully.",
        )
