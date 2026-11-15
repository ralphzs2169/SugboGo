"""Accept authenticated Maya Sandbox webhook notifications."""

from time import time_ns

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, RequestDataTooBig
from django.db import DatabaseError, transaction
from django.http import UnreadablePostError
from django.utils.decorators import method_decorator
from rest_framework.exceptions import NotFound, ParseError, PermissionDenied, UnsupportedMediaType
from rest_framework.views import APIView

from apps.shared.services.maya_payment_evidence import InvalidMayaPayment
from apps.shared.services.maya_webhook_security import (
    MAX_WEBHOOK_BYTES,
    InvalidMayaWebhook,
    verify_maya_webhook,
)
from core.responses import error_response, success_response

from ..services.maya_webhook_service import accept_maya_delivery, maya_webhook_enabled


@method_decorator(transaction.non_atomic_requests, name="dispatch")
class MayaSandboxWebhookView(APIView):
    """Verify the provider delivery before writing it to the durable inbox."""

    authentication_classes = ()
    permission_classes = ()
    parser_classes = ()
    throttle_classes = ()
    http_method_names = ["post"]

    def post(
        self,
        request,
    ):
        """Acknowledge only after the signature check and durable inbox transaction."""
        if not maya_webhook_enabled():
            raise NotFound()
        if request.content_type.partition(";")[0].strip().lower() != "application/json":
            raise UnsupportedMediaType("non-JSON content")
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0)
            if length > MAX_WEBHOOK_BYTES:
                raise RequestDataTooBig()
            stream = request.stream
            body = stream.read(MAX_WEBHOOK_BYTES + 1) if stream is not None else b""
            if len(body) > MAX_WEBHOOK_BYTES:
                raise RequestDataTooBig()
        except RequestDataTooBig:
            return error_response(
                message="Webhook body exceeds the size limit.",
                code="webhook_too_large",
                status_code=413,
            )
        except (ValueError, UnreadablePostError):
            raise ParseError("Invalid webhook request.") from None
        try:
            payload = verify_maya_webhook(
                body,
                timestamp=request.headers.get("X-Maya-Webhook-Timestamp", ""),
                signature=request.headers.get("X-Maya-Webhook-Signature", ""),
                verification_keys=settings.MAYA_SANDBOX_WEBHOOK_VERIFICATION_KEYS,
                now_ms=time_ns() // 1_000_000,
            )
        except InvalidMayaWebhook:
            raise PermissionDenied("Webhook verification failed.") from None
        except ImproperlyConfigured:
            return error_response(
                message="Webhook verification is unavailable.",
                code="webhook_unavailable",
                status_code=503,
            )
        try:
            accept_maya_delivery(payload, body)
        except InvalidMayaPayment:
            raise ParseError("Invalid Maya payment evidence.") from None
        except DatabaseError:
            return error_response(
                message="Webhook storage is unavailable.",
                code="webhook_unavailable",
                status_code=503,
            )
        return success_response(message="Webhook accepted.")
