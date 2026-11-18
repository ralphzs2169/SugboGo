from django.core import signing
from django.urls import reverse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.merchant_application.serializers.document_serializers import (
    ApplicationDocumentSaveSerializer,
    ApplicationDocumentSerializer,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.services.document_service import DocumentService
from apps.merchant_application.utils.document_preview import serve_document_preview
from core.responses import error_response, success_response


PREVIEW_TOKEN_SALT = "merchant-application-verification-document"
PREVIEW_TOKEN_AGE_SECONDS = 120


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def document_save_view(request):
    """Step 5. Saves document additions, replacements, and deletions."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before saving documents.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = ApplicationDocumentSaveSerializer(
        data=request.data,
        partial=True
    )
    serializer.is_valid(raise_exception=True)

    try:
        documents = DocumentService.save_documents(
            application,
            serializer.validated_data,
        )
    except ValueError as exc:
        return error_response(
            message=str(exc),
            code="INVALID_DOCUMENT_OPERATION",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    output_serializer = ApplicationDocumentSerializer(
        documents,
        many=True,
    )

    return success_response(
        data=output_serializer.data,
        message="Verification documents saved successfully.",
    )


class ApplicationDocumentAccessView(APIView):
    """Issue a short-lived preview link to the applicant who owns the document."""

    permission_classes = (IsAuthenticated,)

    def get(
        self,
        request,
        document_id,
    ):
        """Authorize the applicant and sign access to a single document."""
        document = DocumentService.get_document_for_applicant(
            document_id=document_id,
            applicant_id=request.user.pk,
        )
        token = signing.dumps(
            {
                "document_id": document.MDOC_ID,
                "applicant_id": request.user.pk,
            },
            salt=PREVIEW_TOKEN_SALT,
        )
        path = reverse(
            "application-document-preview",
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


class ApplicationDocumentPreviewView(APIView):
    """Serve the document while its applicant-scoped viewing token is valid."""

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(
        self,
        request,
        token,
    ):
        """Validate expiration and confirm the document still belongs to the applicant."""
        try:
            payload = signing.loads(
                token,
                salt=PREVIEW_TOKEN_SALT,
                max_age=PREVIEW_TOKEN_AGE_SECONDS,
            )
        except signing.BadSignature:
            raise NotFound("This document link has expired or is unavailable.")

        document = DocumentService.get_document_for_applicant(
            document_id=payload["document_id"],
            applicant_id=payload["applicant_id"],
        )
        return serve_document_preview(document)
