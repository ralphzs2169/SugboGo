from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from core.responses import error_response, success_response

from apps.registration.serializers.photo_document_serializers import (
    MerchantApplicationDocumentSerializer,
    MerchantApplicationDocumentUploadSerializer,
    MerchantApplicationPhotoSerializer,
    MerchantApplicationPhotoUploadSerializer,
)
from apps.registration.services.application_service import ApplicationService
from apps.registration.services.photo_document_service import PhotoDocumentService


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def photo_upload_view(request):
    """Step 5. Uploads one or more photos under the same category."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="Complete Step 1 (Business Identity) before uploading photos.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    serializer = MerchantApplicationPhotoUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    photos = PhotoDocumentService.upload_photos(
        application,
        serializer.validated_data["category"],
        serializer.validated_data["files"],
    )
    output_serializer = MerchantApplicationPhotoSerializer(photos, many=True)

    return success_response(
        data=output_serializer.data,
        message="Photos uploaded successfully.",
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def photo_delete_view(request, photo_id):
    """Step 5. Deletes one photo from the current application."""

    application = ApplicationService.get_current_application(request.user)

    if application is None:
        return error_response(
            message="No application found.",
            code="APPLICATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    photo = PhotoDocumentService.get_photo_for_application(application, photo_id)
    PhotoDocumentService.delete_photo(photo)

    return success_response(message="Photo deleted successfully.")


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