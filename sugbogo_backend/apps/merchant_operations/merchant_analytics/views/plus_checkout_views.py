"""Merchant-owned checkout creation with no payment confirmation side effects."""

from django.db import transaction
from django.utils.decorators import method_decorator
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.payments.services.checkout_service import CheckoutService
from apps.users.models import User
from core.responses import success_response

from ..serializers.plus_checkout_serializers import (
    MerchantPlusCheckoutInputSerializer,
    MerchantPlusCheckoutSerializer,
)


@method_decorator(transaction.non_atomic_requests, name="dispatch")
class MerchantPlusCheckoutView(APIView):
    """Reserve checkout before provider I/O and return safe resume/wait instructions."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.MERCHANT))
    parser_classes = (JSONParser,)
    throttle_classes = (UserRateThrottle, ScopedRateThrottle)
    throttle_scope = "merchant_plus_checkout"

    def post(
        self,
        request,
    ):
        """Accept only an explicit empty JSON body and server-resolved purchase inputs."""
        if not request.body:
            raise ValidationError("An empty JSON object is required.")
        query = MerchantPlusCheckoutInputSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        serializer = MerchantPlusCheckoutInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data, status_code = CheckoutService.create_checkout(request.user)
        message = "Secure checkout is ready."
        if status_code == 202:
            message = "We're checking your checkout. Please wait and check again later."
        return success_response(
            data=MerchantPlusCheckoutSerializer(data).data,
            message=message,
            status_code=status_code,
        )
