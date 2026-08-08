from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from apps.merchant_application.serializers.document_serializers import (
    ApplicationDocumentSaveSerializer,
    ApplicationDocumentSerializer,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.services.document_service import DocumentService


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