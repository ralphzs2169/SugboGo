"""Admin-only GET endpoints with no payment mutation or provider dispatch."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response

from ..serializers.payment_inspection_serializers import (
    PaymentInspectionDetailSerializer,
    PaymentInspectionFilterSerializer,
    PaymentInspectionListSerializer,
)
from ..services.payment_inspection_service import PaymentInspectionService


class AdminPaymentListView(APIView):
    """Expose the Merchant Plus directory to active Admin and Super Admin actors."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )
    http_method_names = ["get", "head", "options"]

    def get(
        self,
        request,
    ):
        """Return validated, server-filtered records in the standard pagination envelope."""
        filters = PaymentInspectionFilterSerializer(data=request.query_params.dict())
        filters.is_valid(raise_exception=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            PaymentInspectionService.list_payments(filters.validated_data),
            request,
        )
        return paginator.get_paginated_response(
            PaymentInspectionListSerializer(page, many=True).data,
        )


class AdminPaymentSummaryView(APIView):
    """Expose global operational counts without loading financial rows into Python."""

    permission_classes = AdminPaymentListView.permission_classes
    http_method_names = AdminPaymentListView.http_method_names

    def get(
        self,
        request,
    ):
        """Return overlapping pending, paid, and stored review counts."""
        return success_response(data=PaymentInspectionService.get_summary())


class AdminPaymentDetailView(APIView):
    """Inspect retained payment evidence without invoking any financial service writes."""

    permission_classes = AdminPaymentListView.permission_classes
    http_method_names = AdminPaymentListView.http_method_names

    def get(
        self,
        request,
        payment_id,
    ):
        """Return only the selected purchase's safe inspection projection."""
        payment = PaymentInspectionService.get_payment(payment_id)
        return success_response(data=PaymentInspectionDetailSerializer(payment).data)
