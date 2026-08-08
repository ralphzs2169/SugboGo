from django.test import TestCase

from apps.merchant_application.services.identity_service import IdentityService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)


class IdentityServiceTests(MerchantApplicationServiceMixin, TestCase):
    def test_save_identity_creates_application_and_marks_step_complete(self):
        application, _identity = IdentityService.save_identity(
            self.user,
            self._identity_payload(),
        )

        application.refresh_from_db()
        _identity.refresh_from_db()

        self.assertEqual(
            application.USER_ID,
            self.user,
        )

        self.assertEqual(
            _identity.MIDN_BUSINESS_NAME,
            "Sugbo Bistro",
        )

        self.assertEqual(
            _identity.specialty_tags.count(),
            3,
        )

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            1,
        )

    def test_save_identity_updates_existing_identity_without_replacing_tags(self):
        application, _identity = IdentityService.save_identity(
            self.user,
            self._identity_payload(),
        )

        updated_application, updated_identity = IdentityService.save_identity(
            self.user,
            {
                "MIDN_BUSINESS_NAME": "Sugbo Bistro Prime",
            },
        )

        application.refresh_from_db()
        updated_application.refresh_from_db()
        updated_identity.refresh_from_db()

        self.assertEqual(
            updated_identity.MIDN_BUSINESS_NAME,
            "Sugbo Bistro Prime",
        )

        self.assertEqual(
            updated_identity.specialty_tags.count(),
            3,
        )

        self.assertEqual(
            updated_application.MAPP_HIGHEST_COMPLETED_STEP,
            1,
        )