# isort: skip_file
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from apps.merchant_application.models import MerchantApplicationDocument
from apps.merchant_application.services.document_service import DocumentService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)


class DocumentServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_save_documents_creates_documents_and_marks_step_complete(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_photo_upload:
            mock_photo_upload.return_value = {
                "secure_url": "https://cloudinary.com/storefront.jpg",
                "public_id": "merchant_application_photos/storefront",
            }

            from apps.merchant_application.services.photo_service import PhotoService

            PhotoService.save_photos(
                application,
                {
                    "storefront": [self._storefront_file()],
                },
            )

        registration_file = self._pdf_file("business-registration.pdf")
        additional_file = self._pdf_file("additional-document.pdf")

        with patch(
            "apps.merchant_application.services.document_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.side_effect = [
                {
                    "secure_url": "https://cloudinary.com/business-registration.pdf",
                    "public_id": "merchant_application_documents/business-registration",
                },
                {
                    "secure_url": "https://cloudinary.com/additional-document.pdf",
                    "public_id": "merchant_application_documents/additional-document",
                },
            ]

            documents = DocumentService.save_documents(
                application,
                {
                    "business_registration": registration_file,
                    "additional_documents": [additional_file],
                },
            )

        application.refresh_from_db()

        self.assertEqual(
            documents.count(),
            2,
        )

        self.assertTrue(
            documents.filter(
                MDOC_DOCUMENT_TYPE=(
                    MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
                )
            ).exists()
        )

        self.assertTrue(
            documents.filter(
                MDOC_DOCUMENT_TYPE=(
                    MerchantApplicationDocument.DocumentType.ADDITIONAL_DOCUMENTS
                )
            ).exists()
        )

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            5,
        )

        self.assertEqual(
            mock_upload.call_count,
            2,
        )

    def test_save_documents_rejects_additional_document_counts_over_the_limit(self):
        application = self._build_complete_application()

        MerchantApplicationDocument.objects.bulk_create(
            [
                MerchantApplicationDocument(
                    MAPP_ID=application,
                    MDOC_DOCUMENT_TYPE=MerchantApplicationDocument.DocumentType.ADDITIONAL_DOCUMENTS,
                    MDOC_DOCUMENT_URL=f"https://example.com/additional-{index}.pdf",
                    MDOC_DOCUMENT_PUBLIC_ID=f"additional-{index}",
                    MDOC_FILE_NAME=f"additional-{index}.pdf",
                )
                for index in range(5)
            ]
        )

        with patch(
            "apps.merchant_application.services.document_service.CloudinaryService.upload_image"
        ) as mock_upload, self.assertRaises(ValueError):
            DocumentService.save_documents(
                application,
                {
                    "additional_documents": [self._pdf_file("extra.pdf")],
                },
            )

        mock_upload.assert_not_called()