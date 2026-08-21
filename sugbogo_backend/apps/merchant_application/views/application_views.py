from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.merchant_application.serializers.application_serializers import (
    ApplicationDetailSerializer,
    ApplicationSubmissionSerializer,
    MerchantApplicationStatusSerializer,
)
from apps.merchant_application.services.application_service import ApplicationService


class MerchantApplicationView(APIView):
    permission_classes = (IsAuthenticated,)

    def get_application(self, request):
        return ApplicationService.get_current_application(request.user)

    def get(self, request):
        """Return the merchant's current application, fully nested."""

        application = self.get_application(request)

        if application is None:
            return error_response(
                message=(
                    "No application found. "
                    "Start by submitting your business identity."
                ),
                code="APPLICATION_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        serializer = ApplicationDetailSerializer(application)

        return success_response(
            data=serializer.data,
            message="Application retrieved successfully.",
        )

    def post(self, request):
        """Final submit — flips the application status to SUBMITTED."""

        application = self.get_application(request)

        if application is None:
            return error_response(
                message="No application found to submit.",
                code="APPLICATION_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        application = ApplicationService.submit_application(application)

        serializer = ApplicationSubmissionSerializer(application)

        return success_response(
            data=serializer.data,
            message="Application submitted successfully.",
        )


class MerchantApplicationStatusView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        application = ApplicationService.get_current_application(request.user)

        if application is None:
            return success_response(
                data=None,
                message="No merchant application found.",
            )

        serializer = MerchantApplicationStatusSerializer(application)

        return success_response(
            data=serializer.data,
            message="Application status retrieved successfully.",
        )


class MerchantModeAcknowledgeView(APIView):
    permission_classes = (IsAuthenticated,)

    def patch(self, request):
        application = ApplicationService.get_current_application(request.user)

        if application is None:
            return error_response(
                message="No application found.",
                code="APPLICATION_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        application = ApplicationService.acknowledge_merchant_mode(
            application,
            request.user,
        )

        serializer = MerchantApplicationStatusSerializer(application)

        return success_response(
            data=serializer.data,
            message="Merchant mode acknowledged successfully.",
        )