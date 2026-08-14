# isort: skip_file
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_application.models import MerchantApplicationDocument
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from core.tests.assertions import APIResponseAssertionsMixin


class DocumentViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.url = reverse("application-document-upload")
        self.registration_file = SimpleUploadedFile(
            "business-registration.pdf",
            b"document-bytes",
            content_type="application/pdf",
        )

    def test_document_save_returns_not_found_when_step_one_is_missing(self):
        response = self.client.patch(
            self.url,
            {"business_registration": self.registration_file},
            format="multipart",
        )

        self.assertErrorResponse(
            response,
            message="Complete Step 1 (Business Identity) before saving documents.",
            code="APPLICATION_NOT_FOUND",
            status_code=404,
        )

    def test_document_save_creates_business_registration_document(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)
        application.MAPP_HIGHEST_COMPLETED_STEP = 4
        application.save(update_fields=["MAPP_HIGHEST_COMPLETED_STEP"])

        with patch(
            "apps.merchant_application.services.document_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/business-registration.pdf",
                "public_id": "merchant_application_documents/business-registration",
                "version": 1234567890,
            }

            response = self.client.patch(
                self.url,
                {"business_registration": self.registration_file},
                format="multipart",
            )

        self.assertSuccessResponse(
            response,
            message="Verification documents saved successfully.",
        )

        self.assertEqual(
            response.data["data"][0]["document_type"],
            MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION,
        )

        self.assertEqual(
            MerchantApplicationDocument.objects.count(),
            1,
        )

        mock_upload.assert_called_once()


    def test_document_save_returns_bad_request_for_invalid_document_operation(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)

        application.MAPP_HIGHEST_COMPLETED_STEP = 4
        application.save(
            update_fields=["MAPP_HIGHEST_COMPLETED_STEP"],
        )

        with patch(
            "apps.merchant_application.services.document_service.DocumentService.save_documents"
        ) as mock_save:
            mock_save.side_effect = ValueError(
                "You can have up to 5 additional documents."
            )

            response = self.client.patch(
                self.url,
                {"additional_documents": [self.registration_file]},
                format="multipart",
            )

        self.assertErrorResponse(
            response,
            message="You can have up to 5 additional documents.",
            code="INVALID_DOCUMENT_OPERATION",
            status_code=400,
        )

    def test_document_save_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.url,
            {"business_registration": self.registration_file},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            401,
        )