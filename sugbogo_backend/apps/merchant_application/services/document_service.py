from pathlib import Path

import requests
from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.shared.services.cloudinary_service import CloudinaryService


class DocumentService:
    STEP = 5

    ADDITIONAL_DOCUMENT_LIMIT = 5

    @staticmethod
    @transaction.atomic
    def save_documents(application, validated_data):
        """
        Saves Step 5 document changes.

        Only fields included in the request are changed.
        Existing documents remain untouched when their fields are omitted.
        Explicitly deleted documents are removed.
        """

        # Lock the application row to prevent concurrent document saves.
        application = (
            MerchantApplication.objects
            .select_for_update()
            .get(MAPP_ID=application.MAPP_ID)
        )

        ApplicationService.validate_step_access(
            application,
            DocumentService.STEP,
        )

        business_registration = validated_data.pop(
            "business_registration",
            None,
        )
        authorization_document = validated_data.pop(
            "authorization_document",
            None,
        )
        additional_documents = validated_data.pop(
            "additional_documents",
            [],
        )
        deleted_document_ids = validated_data.pop(
            "deleted_document_ids",
            [],
        )

        # Find documents requested for deletion.
        documents_to_delete = MerchantApplicationDocument.objects.filter(
            MAPP_ID=application,
            MDOC_ID__in=deleted_document_ids,
        )

        if documents_to_delete.count() != len(set(deleted_document_ids)):
            raise ValueError(
                "One or more selected documents do not belong to this application."
            )

        # Validate the resulting document state before making changes.
        DocumentService._validate_final_document_state(
            application=application,
            business_registration=business_registration,
            authorization_document=authorization_document,
            additional_documents=additional_documents,
            documents_to_delete=documents_to_delete,
        )

        deleted_public_ids = [
            document.MDOC_DOCUMENT_PUBLIC_ID
            for document in documents_to_delete
            if document.MDOC_DOCUMENT_PUBLIC_ID
        ]

        documents_to_delete.delete()

        for public_id in deleted_public_ids:
            transaction.on_commit(
                lambda public_id=public_id: CloudinaryService.delete_image(
                    public_id
                )
            )

        uploaded_public_ids = []

        try:
            # Replace business registration when supplied.
            if business_registration is not None:
                DocumentService._delete_documents_by_type(
                    application,
                    MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION,
                )

                DocumentService._upload_document(
                    application=application,
                    document_type=(
                        MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
                    ),
                    file=business_registration,
                    uploaded_public_ids=uploaded_public_ids,
                )

            # Replace authorization document when supplied.
            if authorization_document is not None:
                DocumentService._delete_documents_by_type(
                    application,
                    MerchantApplicationDocument.DocumentType.AUTHORIZATION_DOCUMENT,
                )

                DocumentService._upload_document(
                    application=application,
                    document_type=(
                        MerchantApplicationDocument.DocumentType.AUTHORIZATION_DOCUMENT
                    ),
                    file=authorization_document,
                    uploaded_public_ids=uploaded_public_ids,
                )

            # Add new additional documents.
            for file in additional_documents:
                DocumentService._upload_document(
                    application=application,
                    document_type=(
                        MerchantApplicationDocument.DocumentType.ADDITIONAL_DOCUMENTS
                    ),
                    file=file,
                    uploaded_public_ids=uploaded_public_ids,
                )

        except Exception:
            # Cloudinary uploads are outside the database transaction.
            for public_id in uploaded_public_ids:
                CloudinaryService.delete_image(public_id)

            raise

        ApplicationService.mark_section_updated(
            application,
            "MAPP_DOCUMENTS_UPDATED_AT",
        )

        # Step 5 is complete only after the entire save succeeds.
        ApplicationService.mark_step_completed(
            application,
            DocumentService.STEP,
        )

        return MerchantApplicationDocument.objects.filter(
            MAPP_ID=application
        ).order_by("MDOC_ID")


    @staticmethod
    def _validate_final_document_state(
        application,
        business_registration,
        authorization_document,
        additional_documents,
        documents_to_delete,
    ):
        """Validate the complete document state after this PATCH."""

        business_registration_type = (
            MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
        )

        additional_documents_type = (
            MerchantApplicationDocument.DocumentType.ADDITIONAL_DOCUMENTS
        )

        deleted_ids = {
            document.MDOC_ID
            for document in documents_to_delete
        }

        # Business registration must exist after this operation.
        has_existing_registration = (
            MerchantApplicationDocument.objects.filter(
                MAPP_ID=application,
                MDOC_DOCUMENT_TYPE=business_registration_type,
            )
            .exclude(MDOC_ID__in=deleted_ids)
            .exists()
        )

        if (
            business_registration is None
            and not has_existing_registration
        ):
            raise ValueError(
                "Business registration document is required."
            )

        existing_additional_count = (
            MerchantApplicationDocument.objects.filter(
                MAPP_ID=application,
                MDOC_DOCUMENT_TYPE=additional_documents_type,
            )
            .exclude(MDOC_ID__in=deleted_ids)
            .count()
        )

        final_additional_count = (
            existing_additional_count
            + len(additional_documents)
        )

        if final_additional_count > DocumentService.ADDITIONAL_DOCUMENT_LIMIT:
            raise ValueError(
                "You can have up to 5 additional documents."
            )

    @staticmethod
    def _upload_document(
        application,
        document_type,
        file,
        uploaded_public_ids,
    ):
        """Upload one document to Cloudinary and create its database record."""

        result = CloudinaryService.upload_image(
            file=file,
            folder="merchant_application_documents",
            resource_type="auto",
            type="authenticated",
        )
        print("CLOUDINARY DOCUMENT RESULT:", result)
        public_id = result["public_id"]
        uploaded_public_ids.append(public_id)

        return MerchantApplicationDocument.objects.create(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=document_type,
            MDOC_DOCUMENT_URL=result["secure_url"],
            MDOC_DOCUMENT_PUBLIC_ID=public_id,
            MDOC_CLOUDINARY_VERSION=result["version"],
            MDOC_FILE_NAME=getattr(file, "name", None),
        )

    
    @staticmethod
    def _delete_documents_by_type(application, document_type):
        """Remove existing documents of a single replaceable type."""

        documents = MerchantApplicationDocument.objects.filter(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=document_type,
        )

        public_ids = [
            document.MDOC_DOCUMENT_PUBLIC_ID
            for document in documents
            if document.MDOC_DOCUMENT_PUBLIC_ID
        ]

        documents.delete()

        for public_id in public_ids:
            transaction.on_commit(
                lambda public_id=public_id: CloudinaryService.delete_image(
                    public_id
                )
            )

    @staticmethod
    def get_document_for_application(application, document_id):
        return get_object_or_404(
            MerchantApplicationDocument,
            MDOC_ID=document_id,
            MAPP_ID=application,
        )

    @staticmethod
    def get_document_content(document):
        """Fetch an authenticated document from Cloudinary."""

        document_format = Path(
            document.MDOC_FILE_NAME or ""
        ).suffix.lstrip(".")

        document_url = CloudinaryService.generate_authenticated_document_url(
            public_id=document.MDOC_DOCUMENT_PUBLIC_ID,
            format=document_format,
            version=document.MDOC_CLOUDINARY_VERSION,
        )

        response = requests.get(
            document_url,
            timeout=30,
        )
        response.raise_for_status()

        return (
            response.content,
            response.headers.get(
                "Content-Type",
                "application/octet-stream",
            ),
        )