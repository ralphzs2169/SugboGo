"""Merchant-owned payment reconciliation without accepting client financial evidence."""

from django.db import transaction
from django.utils.decorators import method_decorator
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.payments.services.maya_reconciliation_service import reconcile_merchant_plus_payment
from apps.users.models import User
from core.responses import success_response

from ..serializers.plus_checkout_serializers import MerchantPlusCheckoutInputSerializer
from ..serializers.plus_status_serializers import MerchantPlusAccessStatusSerializer
from ..services.merchant_plus_status_service import MerchantPlusStatusService


@method_decorator(transaction.non_atomic_requests, name="dispatch")
class MerchantPlusReconciliationView(APIView):
    """Verify the merchant's current purchase directly with Maya Sandbox."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))
    parser_classes = (JSONParser,)
    throttle_classes = (UserRateThrottle, ScopedRateThrottle)
    throttle_scope = "merchant_plus_checkout"

    def post(
        self,
        request,
    ):
        """Require an empty request and return the resulting authoritative Plus status."""
        if not request.body:
            raise ValidationError("An empty JSON object is required.")
        query = MerchantPlusCheckoutInputSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = MerchantPlusCheckoutInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        reconcile_merchant_plus_payment(request.user)
        return success_response(
            data=MerchantPlusAccessStatusSerializer(
                MerchantPlusStatusService.get_status(request.user),
            ).data,
            message="Merchant Plus payment status checked.",
        )
