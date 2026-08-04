from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.registration.models import (
    MerchantApplicationDocument,
    MerchantApplicationPhotos,
)
from apps.registration.services.application_service import ApplicationService
from apps.shared.services.cloudinary_service import CloudinaryService


class PhotoDocumentService:
    STEP = 4

    @staticmethod
    @transaction.atomic
    def save_photos(application, validated_data):
        """
        Saves the complete Step 4 photo changes.

        Only newly added files are uploaded and created.
        Only explicitly deleted photo IDs are removed.
        Existing unchanged photos remain untouched.
        """

        deleted_photo_ids = validated_data.pop("deleted_photo_ids", [])

        new_photos = {
            MerchantApplicationPhotos.PhotoCategory.STOREFRONT: validated_data.pop(
                "storefront", []
            ),
            MerchantApplicationPhotos.PhotoCategory.INTERIOR: validated_data.pop(
                "interior", []
            ),
            MerchantApplicationPhotos.PhotoCategory.PRODUCTS: validated_data.pop(
                "products", []
            ),
            MerchantApplicationPhotos.PhotoCategory.ADDITIONAL: validated_data.pop(
                "additional", []
            ),
        }

        # Validate that every requested deletion belongs to this application.
        photos_to_delete = MerchantApplicationPhotos.objects.filter(
            MAPP_ID=application,
            MPHT_ID__in=deleted_photo_ids,
        )

        if photos_to_delete.count() != len(set(deleted_photo_ids)):
            raise ValueError(
                "One or more selected photos do not belong to this application."
            )

        # Delete the requested database records and their Cloudinary assets
        # after the database transaction successfully commits.
        deleted_public_ids = [
            photo.MPHT_PHOTO_PUBLIC_ID
            for photo in photos_to_delete
            if photo.MPHT_PHOTO_PUBLIC_ID
        ]

        photos_to_delete.delete()

        for public_id in deleted_public_ids:
            transaction.on_commit(
                lambda public_id=public_id: CloudinaryService.delete_image(
                    public_id
                )
            )

        # Upload only newly added photos.
        created_photos = []

        try:
            for category, files in new_photos.items():
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

                    created_photos.append(photo)

        except Exception:
            # Cloudinary uploads cannot participate in the database
            # transaction, so clean up any uploads created before failure.
            for photo in created_photos:
                if photo.MPHT_PHOTO_PUBLIC_ID:
                    CloudinaryService.delete_image(
                        photo.MPHT_PHOTO_PUBLIC_ID
                    )

            raise

        # Step 4 is complete only after the entire save succeeds.
        ApplicationService.mark_step_completed(
            application,
            PhotoDocumentService.STEP,
        )

        return MerchantApplicationPhotos.objects.filter(
            MAPP_ID=application
        ).order_by("MPHT_ID")

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
        """Step 5. Uploads one or more documents under the same type."""
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