"""Read-only Admin API for advisory review signals."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.moderation.serializers.suspicious_review_serializers import (
    SuspiciousReviewDetailSerializer,
    SuspiciousReviewFilterSerializer,
    SuspiciousReviewListSerializer,
)
from apps.admin_operations.moderation.services.suspicious_review_service import (
    SuspiciousReviewService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response


class AdminSuspiciousReviewListView(APIView):
    """List published reviews with advisory reliability findings."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Return a filtered and paginated investigation queue."""
        filters = SuspiciousReviewFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            SuspiciousReviewService.list_reviews(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            SuspiciousReviewListSerializer(page, many=True).data,
        )


class AdminSuspiciousReviewDetailView(APIView):
    """Show one investigation without changing the review."""

    permission_classes = AdminSuspiciousReviewListView.permission_classes

    def get(self, request, review_id):
        """Return stored evidence and current relationships separately."""
        review = SuspiciousReviewService.get_review(review_id)
        related_reviews = SuspiciousReviewService.related_reviews(review)
        return success_response(
            data=SuspiciousReviewDetailSerializer(
                review,
                context={"related_reviews": related_reviews},
            ).data,
            message="Suspicious review retrieved successfully.",
        )
