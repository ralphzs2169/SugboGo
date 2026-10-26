from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer
from apps.reviews.serializers.merchant_review_focus_serializers import (
    MerchantReviewFocusQuerySerializer,
)
from apps.reviews.services.merchant_review_focus_service import (
    MerchantReviewFocusService,
)
from apps.users.models import User
from core.responses import success_response


class MerchantReviewFocusView(APIView):
    """Resolve notification review targets for their authenticated business owner."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(
        self,
        request,
        business_id,
        review_id,
    ):
        """Return the target's newest-first page or a controlled unavailable error."""
        query = MerchantReviewFocusQuerySerializer(
            data=request.query_params,
        )
        query.is_valid(raise_exception=True)
        location = MerchantReviewFocusService.locate(
            user=request.user,
            business_id=business_id,
            review_id=review_id,
            **query.validated_data,
        )
        return success_response(
            data=location,
            message="Review location retrieved successfully.",
        )


class MerchantReviewDetailView(APIView):
    """Read one published review for its authenticated business owner."""

    permission_classes = MerchantReviewFocusView.permission_classes

    def get(
        self,
        request,
        business_id,
        review_id,
    ):
        """Return review content without downloading or locating archive pages."""
        review = MerchantReviewFocusService.get_owned_review(
            user=request.user,
            business_id=business_id,
            review_id=review_id,
        )
        return success_response(
            data=ReviewResponseSerializer(
                review,
                context={"request": request},
            ).data,
            message="Review retrieved successfully.",
        )
