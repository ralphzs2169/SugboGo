from django.shortcuts import get_object_or_404

from apps.registration.models import (
    MerchantApplicationDocument,
    MerchantApplicationPhotos,
)
from apps.shared.services.cloudinary_service import CloudinaryService


class PhotoDocumentService:
    @staticmethod
    def upload_photos(application, category, files):
        """Step 5. Uploads one or more photos under the same category."""
        photos = []

        for file in files:
            result = CloudinaryService.upload_image(
                file=file,
                folder="merchant_application_photos",
            )
            photo = MerchantApplicationPhotos.objects.create(
                MAPP_ID=application,
                MPHT_CATEGORY=category,
                MPHT_PHOTO_URL=result["secure_url"],
                MPHT_PHOTO_PUBLIC_ID=result["public_id"],
                MPHT_FILE_NAME=getattr(file, "name", None),
            )
            photos.append(photo)

        return photos

    @staticmethod
    def get_photo_for_application(application, photo_id):
        return get_object_or_404(
            MerchantApplicationPhotos,
            MPHT_ID=photo_id,
            MAPP_ID=application,
        )

    @staticmethod
    def delete_photo(photo):
        if photo.MPHT_PHOTO_PUBLIC_ID:
            CloudinaryService.delete_image(photo.MPHT_PHOTO_PUBLIC_ID)
        photo.delete()

    @staticmethod
    def upload_documents(application, document_type, files):
        """Step 6. Uploads one or more documents under the same type."""
        documents = []

        for file in files:
            result = CloudinaryService.upload_image(
                file=file,
                folder="merchant_application_documents",
                resource_type="auto",
            )
            document = MerchantApplicationDocument.objects.create(
                MAPP_ID=application,
                MDOC_DOCUMENT_TYPE=document_type,
                MDOC_DOCUMENT_URL=result["secure_url"],
                MDOC_DOCUMENT_PUBLIC_ID=result["public_id"],
                MDOC_FILE_NAME=getattr(file, "name", None),
            )
            documents.append(document)

        return documents

    @staticmethod
    def get_document_for_application(application, document_id):
        return get_object_or_404(
            MerchantApplicationDocument,
            MDOC_ID=document_id,
            MAPP_ID=application,
        )

    @staticmethod
    def delete_document(document):
        if document.MDOC_DOCUMENT_PUBLIC_ID:
            CloudinaryService.delete_image(document.MDOC_DOCUMENT_PUBLIC_ID)
        document.delete()