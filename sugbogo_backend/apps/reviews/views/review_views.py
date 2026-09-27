from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.review_serializers import (
    ReviewCreateSerializer,
    ReviewListQuerySerializer,
    ReviewResponseSerializer,
    ReviewUpdateSerializer,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewView(APIView):
    """Handle creating and retrieving business reviews."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )

    def post(
        self,
        request,
        business_id,
    ):
        """Create a review for a business."""

        serializer = ReviewCreateSerializer(
            data={
                "text": request.data.get("text"),
                "device_id": request.data.get("device_id"),
                "photos": request.FILES.getlist("photos"),
            },
        )
        serializer.is_valid(
            raise_exception=True,
        )

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
        preview = ReviewService.get_review_preview(
            business_id,
            request.user,
        )

        return success_response(
            data={
                "reviews": ReviewResponseSerializer(
                    preview["reviews"],
                    many=True,
                ).data,
                "total_count": preview["total_count"],
                "user_review": (
                    ReviewResponseSerializer(preview["user_review"]).data
                    if preview["user_review"] is not None
                    else None
                ),
            },
            message="Review preview retrieved successfully.",
        )


class ReviewListView(APIView):
    """Handle retrieving all reviews for a business."""

    permission_classes = ReviewView.permission_classes

    def get(
        self,
        request,
        business_id,
    ):
        """Retrieve all reviews for a business."""

        query = ReviewListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)

        reviews = ReviewService.list_reviews_queryset(
            business_id=business_id,
            user=request.user,
            **query.validated_data,
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            reviews,
            request,
        )
        page = ReviewService._attach_vouched_specialties(page)

        return paginator.get_paginated_response(
            ReviewResponseSerializer(
                page,
                many=True,
            ).data,
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

        serializer = ReviewUpdateSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        ReviewService.update_review(
            user=request.user,
            review_id=review_id,
            **serializer.validated_data,
        )

        review = ReviewService.get_review_detail(
            review_id=review_id,
            user=request.user,
        )

        return success_response(
            data=ReviewResponseSerializer(review).data,
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
