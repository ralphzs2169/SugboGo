from django.core import signing
from django.http import HttpResponse
from django.urls import reverse
from requests.exceptions import RequestException
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
)
from apps.merchant_application.services.document_service import DocumentService
from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)
from apps.users.models import User
from core.responses import success_response


PREVIEW_TOKEN_SALT = "merchant-business-verification-document"
PREVIEW_TOKEN_AGE_SECONDS = 120


class MerchantVerificationDocumentAccessView(APIView):
    """Issue a brief, document-scoped viewing link for the business owner."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request, document_id):
        document = BusinessProfileService.get_verification_document_for_merchant(
            user=request.user,
            document_id=document_id,
        )

        if not document.MDOC_DOCUMENT_PUBLIC_ID:
            raise NotFound("The requested document is unavailable.")

        token = signing.dumps(
            {
                "document_id": document.MDOC_ID,
                "business_id": document.MAPP_ID.BUSN_ID_id,
                "merchant_id": request.user.pk,
            },
            salt=PREVIEW_TOKEN_SALT,
        )
        path = reverse(
            "merchant-verification-document-preview",
            kwargs={"token": token},
        )

        response = success_response(
            data={
                "url": request.build_absolute_uri(path),
                "expires_in": PREVIEW_TOKEN_AGE_SECONDS,
            },
            message="Document access prepared.",
        )
        response["Cache-Control"] = "no-store"
        return response


class MerchantVerificationDocumentPreviewView(APIView):
    """Stream a private document only while its signed viewing token is valid."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request, token):
        try:
            payload = signing.loads(
                token,
                salt=PREVIEW_TOKEN_SALT,
                max_age=PREVIEW_TOKEN_AGE_SECONDS,
            )
            document = MerchantApplicationDocument.objects.select_related(
                "MAPP_ID__BUSN_ID",
            ).get(
                MDOC_ID=payload["document_id"],
                MAPP_ID__BUSN_ID_id=payload["business_id"],
                MAPP_ID__BUSN_ID__USER_ID_id=payload["merchant_id"],
                MAPP_ID__MAPP_STATUS=(
                    MerchantApplication.ApplicationStatus.APPROVED
                ),
            )
        except (
            signing.BadSignature,
            KeyError,
            MerchantApplicationDocument.DoesNotExist,
        ):
            raise NotFound("This document link has expired or is unavailable.")

        try:
            content, content_type = DocumentService.get_document_content(
                document,
            )
        except RequestException:
            response = HttpResponse(
                "Document is temporarily unavailable.",
                status=502,
                content_type="text/plain",
            )
            response["Cache-Control"] = "no-store"
            return response
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = "inline"
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
