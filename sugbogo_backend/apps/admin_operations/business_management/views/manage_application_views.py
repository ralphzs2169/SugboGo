
from core.pagination import StandardPagination
from core.responses import success_response
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.analytics.services.merchant_application_analytics_service import (
    MerchantApplicationAnalyticsService,
)
from apps.admin_operations.business_management.serializers.manage_application_serializers import (
    AdminMerchantApplicationDetailSerializer,
    AdminMerchantApplicationListSerializer,
    AdminMerchantApplicationRejectSerializer,
)
from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.authentication.permissions import HasRole
from apps.merchant_application.services.document_service import DocumentService
from apps.users.models import User


class MerchantApplicationListView(APIView):
    """Handle merchant application listing for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Retrieve a paginated list of merchant applications."""

        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering")
        status_filter = request.query_params.get("status")
        queue_status = request.query_params.get("queue_status")

        queryset = ApplicationService.list_applications(
            search=search,
            ordering=ordering,
            status=status_filter,
            queue_status=queue_status,
        )

        paginator = StandardPagination()

        page = paginator.paginate_queryset(
            queryset,
            request,
        )

        serializer = AdminMerchantApplicationListSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )


class MerchantApplicationDetailView(APIView):
    """Handle administrator access to a merchant application for review."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request, application_id):
        """Retrieve the complete application for administrative review."""

        application = ApplicationService.get_application_for_review(
            application_id,
        )

        serializer = AdminMerchantApplicationDetailSerializer(
            application,
        )

        return success_response(
            data=serializer.data,
            message="Application retrieved successfully.",
        )

class MerchantApplicationStatisticsView(APIView):
    """Handle merchant application statistics for administrators."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request):
        """Retrieve aggregate merchant application statistics."""

        statistics = (
            MerchantApplicationAnalyticsService
            .get_application_statistics()
        )

        return success_response(
            data=statistics,
            message="Application statistics retrieved successfully.",
        )

class MerchantApplicationRejectView(APIView):
    """Handle administrator rejection of a merchant application."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def post(self, request, application_id):
        """Reject a submitted application with section-specific feedback."""

        serializer = AdminMerchantApplicationRejectSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        application = ApplicationService.reject_application(
            application_id=application_id,
            feedback=serializer.validated_data["feedback"],
            reviewer=request.user,
        )

        return success_response(
            data={
                "id": application.MAPP_ID,
                "status": application.MAPP_STATUS,
            },
            message="Application rejected successfully.",
        )

class MerchantApplicationApproveView(APIView):
    """Handle administrator approval of a merchant application."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def post(self, request, application_id):
        """Approve a submitted merchant application."""

        application = ApplicationService.approve_application(
            application_id=application_id,
            reviewer=request.user,
        )

        return success_response(
            data={
                "id": application.MAPP_ID,
                "status": application.MAPP_STATUS,
            },
            message="Application approved successfully.",
        )

class MerchantApplicationDocumentPreviewView(APIView):
    """Serve an authorized verification document for administrator preview."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN),
    )

    def get(self, request, application_id, document_id):
        """Fetch and return the requested document for PDF.js."""

        document = ApplicationService.get_document_for_review(
            application_id=application_id,
            document_id=document_id,
        )

        content, content_type = DocumentService.get_document_content(
            document,
        )

        return HttpResponse(
            content,
            content_type=content_type,
        )