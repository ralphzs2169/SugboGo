"""Authenticated demo upgrade/reset routes, deliberately accessible without existing Plus."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from ..serializers.mock_plus_serializers import (
    EmptyPlusInputSerializer, MerchantPlusStatusSerializer, MockPlusActivationSerializer, MockPlusMutationSerializer,
)
from ..services.mock_plus_service import MockPlusService


class MerchantPlusStatusView(APIView):
    """Read owned demo state under normal merchant role and ownership checks."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def get(self, request):
        """Validate the parameter-free status API without mutating entitlement records."""
        query = EmptyPlusInputSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        return success_response(data=MerchantPlusStatusSerializer(MockPlusService.get_status(request.user)).data,
                                message="Merchant Plus status retrieved successfully.")


class MockPlusActivationView(APIView):
    """Simulate a reversible upgrade without accepting or processing payment."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def post(self, request):
        """Reject disabled mode and ownership/payment overrides before applying the chosen demo outcome."""
        MockPlusService.require_mock_enabled()
        query = EmptyPlusInputSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = MockPlusActivationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = MockPlusService.activate(request.user, payload.validated_data["outcome"])
        return success_response(data=MockPlusMutationSerializer(result).data,
                                message="Mock activation processed. No payment was collected.")


class MockPlusResetView(APIView):
    """Return owned demo access to its inactive state without affecting listing eligibility."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))

    def post(self, request):
        """Validate the empty reset request and revoke only the authenticated owner's demo grant."""
        MockPlusService.require_mock_enabled()
        for data in (request.query_params, request.data):
            payload = EmptyPlusInputSerializer(data=data)
            payload.is_valid(raise_exception=True)
        result = MockPlusService.reset(request.user)
        return success_response(data=MockPlusMutationSerializer(result).data,
                                message="Mock access reset. No payment or refund was processed.")
