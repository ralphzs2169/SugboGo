from apps.business.models import SpecialtyTag
from apps.merchant_application.services.identity_service import IdentityService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from django.test import TestCase


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

    def test_save_identity_does_not_mark_step_complete_when_identity_becomes_incomplete(
        self,
    ):
        application, identity = IdentityService.save_identity(
            self.user,
            self._identity_payload(),
        )

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            1,
        )

        identity.specialty_tags.remove(self.tags[0])

        IdentityService.save_identity(
            self.user,
            {
                "MIDN_BUSINESS_NAME": "Sugbo Bistro Prime",
            },
        )

        application.refresh_from_db()

        self.assertEqual(
            application.MAPP_HIGHEST_COMPLETED_STEP,
            0,
        )

    def test_save_identity_updates_specialty_tags_when_tags_are_provided(self):
        _, identity = IdentityService.save_identity(
            self.user,
            self._identity_payload(),
        )

        new_tags = [
            # Create three new tags rather than reusing the original ones.
            SpecialtyTag.objects.create(TAG_NAME=f"New Tag {index}")
            for index in range(1, 4)
        ]

        IdentityService.save_identity(
            self.user,
            {
                "specialty_tags": new_tags,
            },
        )

        identity.refresh_from_db()

        self.assertEqual(
            identity.specialty_tags.count(),
            3,
        )

        self.assertEqual(
            set(identity.specialty_tags.values_list("TAG_NAME", flat=True)),
            {
                "New Tag 1",
                "New Tag 2",
                "New Tag 3",
            },
        )

    def test_save_identity_preserves_specialty_tags_when_tags_are_omitted(self):
        _, identity = IdentityService.save_identity(
            self.user,
            self._identity_payload(),
        )

        original_tag_ids = set(
            identity.specialty_tags.values_list(
                "TAG_ID",
                flat=True,
            )
        )

        IdentityService.save_identity(
            self.user,
            {
                "MIDN_BUSINESS_NAME": "Sugbo Bistro Prime",
            },
        )

        identity.refresh_from_db()

        self.assertEqual(
            set(
                identity.specialty_tags.values_list(
                    "TAG_ID",
                    flat=True,
                )
            ),
            original_tag_ids,
        )

        self.assertEqual(
            identity.MIDN_BUSINESS_NAME,
            "Sugbo Bistro Prime",
        )