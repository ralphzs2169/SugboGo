from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core import signing
from django.test import TestCase
from django.urls import reverse
from requests.exceptions import RequestException
from rest_framework.test import APIClient

from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
)
from apps.users.models import User


class MerchantVerificationDocumentViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.merchant = User.objects.create_user(
            email="document-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Document",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.other_merchant = User.objects.create_user(
            email="other-document-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )
        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="Local restaurant",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            BUSN_ID=business,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        self.document = MerchantApplicationDocument.objects.create(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE="business_registration",
            MDOC_DOCUMENT_URL="https://example.com/private.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="private-document",
            MDOC_CLOUDINARY_VERSION=1,
            MDOC_FILE_NAME="registration.pdf",
        )

    def access_url(self):
        return reverse(
            "merchant-verification-document-access",
            kwargs={"document_id": self.document.pk},
        )

    def test_owner_receives_short_lived_link_and_can_preview(self):
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get(self.access_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["expires_in"], 120)
        self.assertNotIn("private-document", response.data["data"]["url"])

        self.client.force_authenticate(user=None)
        with patch(
            "apps.merchant_operations.business_profile.views.verification_document_views.DocumentService.get_document_content",
            return_value=(b"%PDF-1.4 test", "application/pdf"),
        ):
            preview = self.client.get(response.data["data"]["url"])

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.content, b"%PDF-1.4 test")
        self.assertEqual(preview["Cache-Control"], "private, no-store")

    def test_other_merchant_cannot_request_document_access(self):
        self.client.force_authenticate(user=self.other_merchant)

        response = self.client.get(self.access_url())

        self.assertEqual(response.status_code, 404)

    def test_access_requires_authentication(self):
        response = self.client.get(self.access_url())

        self.assertEqual(response.status_code, 401)

    def test_missing_stored_file_does_not_issue_link(self):
        self.document.MDOC_DOCUMENT_PUBLIC_ID = ""
        self.document.save(update_fields=["MDOC_DOCUMENT_PUBLIC_ID"])
        self.client.force_authenticate(user=self.merchant)

        response = self.client.get(self.access_url())

        self.assertEqual(response.status_code, 404)

    def test_expired_and_tampered_links_are_rejected(self):
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get(self.access_url())
        token = response.data["data"]["url"].rstrip("/").split("/")[-1]
        preview_url = reverse(
            "merchant-verification-document-preview",
            kwargs={"token": token},
        )

        tampered_url = reverse(
            "merchant-verification-document-preview",
            kwargs={"token": token + "tampered"},
        )
        self.assertEqual(self.client.get(tampered_url).status_code, 404)

        with patch(
            "apps.merchant_operations.business_profile.views.verification_document_views.signing.loads",
            side_effect=signing.SignatureExpired("Expired"),
        ):
            self.assertEqual(self.client.get(preview_url).status_code, 404)

    def test_document_delivery_failure_returns_retryable_error(self):
        self.client.force_authenticate(user=self.merchant)
        access = self.client.get(self.access_url())
        self.client.force_authenticate(user=None)

        with patch(
            "apps.merchant_operations.business_profile.views.verification_document_views.DocumentService.get_document_content",
            side_effect=RequestException("Storage unavailable"),
        ):
            response = self.client.get(access.data["data"]["url"])

        self.assertEqual(response.status_code, 502)
        self.assertNotIn("Storage unavailable", response.content.decode())
