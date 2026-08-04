from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from core.responses import error_response, success_response

from apps.registration.serializers.photo_document_serializers import (
    MerchantApplicationDocumentSerializer,
    MerchantApplicationDocumentUploadSerializer,
    MerchantApplicationPhotoSerializer,
    MerchantApplicationPhotoSaveSerializer,
)
from apps.registration.services.application_service import ApplicationService
from apps.registration.services.photo_document_service import PhotoDocumentService


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def photo_save_view(request):
    """Step 4. Saves all photo changes in one request."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before saving photos.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = MerchantApplicationPhotoSaveSerializer(
        data=request.data
    )
    serializer.is_valid(raise_exception=True)

    try:
        photos = PhotoDocumentService.save_photos(
            application,
            serializer.validated_data,
        )
    except ValueError as exc:
        return error_response(
            message=str(exc),
            code="INVALID_PHOTO_OPERATION",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    output_serializer = MerchantApplicationPhotoSerializer(
        photos,
        many=True,
    )

    return success_response(
        data=output_serializer.data,
        message="Business photos saved successfully.",
    )



@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def document_upload_view(request):
    """Step 6. Uploads one or more documents under the same type."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before uploading documents.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = MerchantApplicationDocumentUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    documents = PhotoDocumentService.upload_documents(
        application,
        serializer.validated_data["document_type"],
        serializer.validated_data["files"],
    )
    output_serializer = MerchantApplicationDocumentSerializer(documents, many=True)

    return success_response(
        data=output_serializer.data,
        message="Documents uploaded successfully.",
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def document_delete_view(request, document_id):
    """Step 6. Deletes one document from the current application."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="No application found.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    document = PhotoDocumentService.get_document_for_application(
        application, document_id
    )
    PhotoDocumentService.delete_document(document)

    return success_response(message="Document deleted successfully.")