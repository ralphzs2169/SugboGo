# isort: skip_file
from unittest.mock import patch

from django.test import TestCase
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
)
from apps.users.models import User
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
            "apps.merchant_application.services.document_service.CloudinaryService.upload_image",
            autospec=True,
        ) as mock_upload:
            mock_upload.side_effect = [
                {
                    "secure_url": "https://cloudinary.com/business-registration.pdf",
                    "public_id": "merchant_application_documents/business-registration",
                    "version": 1234567890,
                },
                {
                    "secure_url": "https://cloudinary.com/additional-document.pdf",
                    "public_id": "merchant_application_documents/additional-document",
                    "version": 1234567891,
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

        self.assertEqual(documents.count(), 2)

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
                    MDOC_CLOUDINARY_VERSION=1234567894 + index,
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


    def test_save_documents_replaces_existing_business_registration(self):
        application = self._build_complete_application()

        existing_document = MerchantApplicationDocument.objects.get(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
        )

        replacement_file = self._pdf_file("replacement-registration.pdf")

        with patch(
            "apps.merchant_application.services.document_service.CloudinaryService.upload_image"
        ) as mock_upload, patch(
            "apps.merchant_application.services.document_service.CloudinaryService.delete_image"
        ) as mock_delete:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/replacement-registration.pdf",
                "public_id": "merchant_application_documents/replacement-registration",
                "version": 1234567892,
            }

            with self.captureOnCommitCallbacks(execute=True):
                DocumentService.save_documents(
                    application,
                    {
                        "business_registration": replacement_file,
                    },
                )

        documents = MerchantApplicationDocument.objects.filter(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
        )

        self.assertEqual(documents.count(), 1)

        replacement = documents.first()

        self.assertNotEqual(
            replacement.MDOC_ID,
            existing_document.MDOC_ID,
        )

        self.assertEqual(
            replacement.MDOC_DOCUMENT_PUBLIC_ID,
            "merchant_application_documents/replacement-registration",
        )

        mock_delete.assert_called_once_with(
            existing_document.MDOC_DOCUMENT_PUBLIC_ID,
        )


    def test_save_documents_deletes_selected_additional_document(self):
        application = self._build_complete_application()

        additional_document = MerchantApplicationDocument.objects.create(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.ADDITIONAL_DOCUMENTS
            ),
            MDOC_DOCUMENT_URL="https://example.com/additional.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="additional-document",
            MDOC_FILE_NAME="additional.pdf",
            MDOC_CLOUDINARY_VERSION=1234567893,
        )

        with patch(
            "apps.merchant_application.services.document_service.CloudinaryService.delete_image"
        ) as mock_delete:
            with self.captureOnCommitCallbacks(execute=True):
                DocumentService.save_documents(
                    application,
                    {
                        "deleted_document_ids": [
                            additional_document.MDOC_ID,
                        ],
                    },
                )

        self.assertFalse(
            MerchantApplicationDocument.objects.filter(
                MDOC_ID=additional_document.MDOC_ID,
            ).exists()
        )

        mock_delete.assert_called_once_with(
            "additional-document",
        )


    def test_save_documents_rejects_deleting_document_from_another_application(self):
        application = self._build_complete_application()

        other_user = User.objects.create_user(
            email="other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        other_application = MerchantApplication.objects.create(
            USER_ID=other_user,
        )

        other_document = MerchantApplicationDocument.objects.create(
            MAPP_ID=other_application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.ADDITIONAL_DOCUMENTS
            ),
            MDOC_DOCUMENT_URL="https://example.com/other.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="other-document",
            MDOC_FILE_NAME="other.pdf",
            MDOC_CLOUDINARY_VERSION=1234567898,
        )

        with self.assertRaisesMessage(
            ValueError,
            "One or more selected documents do not belong to this application.",
        ):
            DocumentService.save_documents(
                application,
                {
                    "deleted_document_ids": [
                        other_document.MDOC_ID,
                    ],
                },
            )


    def test_save_documents_rejects_removing_only_business_registration(self):
        application = self._build_complete_application()

        registration = MerchantApplicationDocument.objects.get(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
        )

        with self.assertRaisesMessage(
            ValueError,
            "Business registration document is required.",
        ):
            DocumentService.save_documents(
                application,
                {
                    "deleted_document_ids": [
                        registration.MDOC_ID,
                    ],
                },
            )

        self.assertTrue(
            MerchantApplicationDocument.objects.filter(
                MDOC_ID=registration.MDOC_ID,
            ).exists()
        )