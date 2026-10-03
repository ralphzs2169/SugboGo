from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationIdentity,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.test import APIClient


class BusinessInformationViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/merchant/business-profile/information/"

        self.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Food and Dining")
        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="Original description",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_EMAIL="original@example.com",
            BUSN_WEBSITE="https://example.com",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            BUSN_ID=self.business,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        self.identity = MerchantApplicationIdentity.objects.create(
            MAPP_ID=application,
            MIDN_BUSINESS_NAME="Sugbo Bistro",
            MIDN_BUSINESS_DESCRIPTION="Original description",
            MIDN_CONTACT_NUMBER="09171234567",
            MIDN_BUSINESS_EMAIL="original@example.com",
            MIDN_WEBSITE="https://example.com",
            MIDN_REPRESENTATIVE_NAME="Juan Dela Cruz",
            MIDN_REPRESENTATIVE_ROLE="owner",
            CLUS_ID=cluster,
            CTGRY_ID=category,
        )

        self.client.force_authenticate(user=self.merchant)

    def test_each_allowed_field_updates_without_changing_other_fields(self):
        cases = (
            ("description", "New description for diners", "BUSN_DESCRIPTION"),
            ("contact_number", "+639181234567", "BUSN_CONTACT_NUMBER"),
            ("business_email", "new@example.com", "BUSN_EMAIL"),
            ("website", "https://new.example.com", "BUSN_WEBSITE"),
        )

        for field, value, model_field in cases:
            with self.subTest(field=field):
                original_name = self.business.BUSN_NAME
                response = self.client.patch(
                    self.url,
                    {field: value},
                    format="json",
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["data"][field], value)
                self.business.refresh_from_db()
                self.assertEqual(getattr(self.business, model_field), value)
                self.assertEqual(self.business.BUSN_NAME, original_name)
                self.assertNotIn("status", response.data["data"])

        self.identity.refresh_from_db()
        self.assertEqual(
            self.identity.MIDN_BUSINESS_DESCRIPTION,
            "Original description",
        )
        self.assertEqual(
            self.identity.MIDN_CONTACT_NUMBER,
            "09171234567",
        )

    def test_partial_patch_preserves_unspecified_information(self):
        response = self.client.patch(
            self.url,
            {"description": "Updated description"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_CONTACT_NUMBER, "09171234567")
        self.assertEqual(self.business.BUSN_EMAIL, "original@example.com")
        self.assertEqual(self.business.BUSN_WEBSITE, "https://example.com")

    def test_optional_email_and_website_can_be_cleared(self):
        response = self.client.patch(
            self.url,
            {"business_email": None, "website": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.business.refresh_from_db()
        self.assertIsNone(self.business.BUSN_EMAIL)
        self.assertEqual(self.business.BUSN_WEBSITE, "")

    def test_invalid_information_returns_field_errors(self):
        cases = (
            ("description", "short"),
            ("contact_number", "1234"),
            ("business_email", "not-an-email"),
            ("website", "not-a-url"),
        )

        for field, value in cases:
            with self.subTest(field=field):
                response = self.client.patch(
                    self.url,
                    {field: value},
                    format="json",
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertIn(field, response.data["errors"])

    def test_sensitive_and_unknown_fields_are_rejected(self):
        for field, value in (
            ("business_name", "Changed Name"),
            ("status", "suspended"),
            ("category", 999),
            ("BUSN_NAME", "Changed Name"),
        ):
            with self.subTest(field=field):
                response = self.client.patch(
                    self.url,
                    {field: value},
                    format="json",
                )

                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data["errors"])

        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Bistro")
        self.assertEqual(self.business.BUSN_STATUS, "active")

    def test_suspended_business_cannot_update(self):
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])

        response = self.client.patch(
            self.url,
            {"description": "New description for diners"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["message"],
            "Business information cannot be edited while your business is suspended.",
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_DESCRIPTION, "Original description")

    def test_missing_owned_business_cannot_update_another_business(self):
        other_merchant = User.objects.create_user(
            email="other@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(user=other_merchant)

        response = self.client.patch(
            self.url,
            {"description": "New description for diners"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.data["message"],
            "Your business could not be found.",
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_DESCRIPTION, "Original description")

    def test_authentication_and_merchant_role_are_required(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.patch(self.url, {}, format="json").status_code,
            401,
        )

        self.client.force_authenticate(user=self.explorer)
        self.assertEqual(
            self.client.patch(self.url, {}, format="json").status_code,
            403,
        )
