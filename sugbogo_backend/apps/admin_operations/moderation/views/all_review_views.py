"""Admin-only read endpoints for the All Reviews directory."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers.all_review_serializers import (
    AdminAllReviewDetailSerializer,
    AdminAllReviewFilterSerializer,
    AdminAllReviewListSerializer,
)
from apps.admin_operations.moderation.services.all_review_service import AllReviewService
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class AdminAllReviewListView(APIView):
    """List all retained reviews using the established Admin permissions."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(
        self,
        request,
    ):
        """Validate filters and return a standard paginated directory response."""
        # An omitted query boolean must remain unset, unlike an HTML checkbox.
        filters = AdminAllReviewFilterSerializer(data=request.query_params.dict())
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            AllReviewService.list_reviews(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            AdminAllReviewListSerializer(page, many=True).data,
        )


class AdminAllReviewSummaryView(APIView):
    """Expose global metric cards independently of directory pagination and filters."""

    permission_classes = AdminAllReviewListView.permission_classes

    def get(
        self,
        request,
    ):
        """Return one authoritative aggregate over the retained review inventory."""
        return success_response(
            data=AllReviewService.get_summary(),
            message="Review summary retrieved successfully.",
        )


class AdminAllReviewDetailView(APIView):
    """Inspect any retained review without introducing moderation decisions."""

    permission_classes = AdminAllReviewListView.permission_classes

    def get(
        self,
        request,
        review_id,
    ):
        """Return the directory drawer contract and existing moderation links."""
        review = AllReviewService.get_review(review_id)
        return success_response(
            data=AdminAllReviewDetailSerializer(review).data,
            message="Review retrieved successfully.",
        )
