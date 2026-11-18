# isort: skip_file
from unittest.mock import patch
from urllib.parse import urlsplit

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.merchant_application.models import MerchantApplicationDocument
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.users.models import User
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
        self.assertNotIn(
            "document_url",
            response.data["data"][0],
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

    def _create_preview_document(self):
        application, _ = self._create_identity()
        document = MerchantApplicationDocument.objects.create(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION,
            MDOC_DOCUMENT_URL="https://example.com/internal.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="private-document",
            MDOC_CLOUDINARY_VERSION=1,
            MDOC_FILE_NAME="permit.pdf",
        )
        access_url = reverse(
            "application-document-access",
            kwargs={"document_id": document.pk},
        )
        return document, access_url

    def test_only_the_applicant_can_request_a_document_link(self):
        _, access_url = self._create_preview_document()
        other_user = User.objects.create_user(
            email="other-applicant@example.com",
            password="test-pass",
        )

        self.client.force_authenticate(user=other_user)
        self.assertEqual(self.client.get(access_url).status_code, 404)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(access_url).status_code, 401)

    def test_document_preview_link_expires_and_the_applicant_can_reopen(self):
        document, access_url = self._create_preview_document()

        with patch("django.core.signing.time.time", return_value=1000):
            access = self.client.get(access_url)

        self.assertEqual(access.status_code, 200)
        self.assertEqual(access["Cache-Control"], "no-store")
        self.assertEqual(access.data["data"]["expires_in"], 120)
        self.assertNotIn("private-document", access.data["data"]["url"])
        preview_url = urlsplit(access.data["data"]["url"]).path

        self.client.force_authenticate(user=None)
        with (
            patch("django.core.signing.time.time", return_value=1121),
            patch(
                "apps.merchant_application.services.document_service.DocumentService.get_document_content",
                return_value=(b"%PDF-1.4", "application/pdf"),
            ) as fetch_document,
        ):
            self.assertEqual(self.client.get(preview_url).status_code, 404)
            self.assertEqual(
                self.client.get(f"{preview_url.rstrip('/')}tampered/").status_code,
                404,
            )
            fetch_document.assert_not_called()

            self.client.force_authenticate(user=self.user)
            renewed = self.client.get(access_url)
            self.assertEqual(renewed.status_code, 200)
            new_preview_url = urlsplit(renewed.data["data"]["url"]).path
            self.client.force_authenticate(user=None)
            preview = self.client.get(new_preview_url)

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.content, b"%PDF-1.4")
        self.assertEqual(preview["Content-Disposition"], 'inline; filename="permit.pdf"')
        self.assertEqual(preview["Cache-Control"], "private, no-store")
        self.assertEqual(preview["Referrer-Policy"], "no-referrer")
        fetch_document.assert_called_once_with(document)
