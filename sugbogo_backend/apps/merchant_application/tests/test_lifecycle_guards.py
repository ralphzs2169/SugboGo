from datetime import time
from importlib import import_module
from unittest.mock import patch

from django.apps import apps
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.admin_operations.business_management.serializers.manage_application_serializers import (
    AdminMerchantApplicationReviewSerializer,
)
from apps.business.models import Business, Location
from apps.merchant_application.models import MerchantApplication, MerchantApplicationReview
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.services.document_service import DocumentService
from apps.merchant_application.services.identity_service import IdentityService
from apps.merchant_application.services.location_service import LocationService
from apps.merchant_application.services.operating_hours_service import OperatingHoursService
from apps.merchant_application.services.photo_service import PhotoService
from apps.merchant_application.tests.test_services import MerchantApplicationServiceMixin
from apps.merchant_application.utils.section_fingerprints import get_section_fingerprints
from apps.users.models import User


class MerchantLifecycleGuardTests(MerchantApplicationServiceMixin, APITestCase):
    """Exercise saved corrections and account eligibility through both review APIs."""

    def setUp(self):
        super().setUp()
        self.user.USER_ROLE = User.UserRole.EXPLORER
        self.user.save(update_fields=["USER_ROLE"])
        self.admin = User.objects.create_user(
            email="lifecycle-guard-admin@example.com", password=None,
            USER_FNAME="Admin", USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.application = ApplicationService.submit_application(self._build_complete_application())

    def reject(self, sections):
        self.application = AdminApplicationService.reject_application(
            self.application.pk,
            feedback=[{"section": section, "message": "Please correct this section."}
                      for section in sections],
            reviewer=self.admin,
            expected_submission_id=self.application.submissions.order_by(
                "-MASUB_SUBMISSION_NUMBER",
            ).first().pk,
        )
        return self.application.reviews.first()

    def submit(self):
        self.client.force_authenticate(self.user)
        return self.client.post(reverse("application-submit"))

    def assert_unchanged_submission(self):
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertIn("resubmission", response.data["errors"])
        self.application.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, "rejected")
        self.assertEqual(self.application.submissions.count(), 1)

    def test_empty_identity_patch_does_not_satisfy_feedback(self):
        self.reject(["identity"])
        self.client.force_authenticate(self.user)
        response = self.client.patch(reverse("application-identity"), {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assert_unchanged_submission()

    def test_no_op_saves_recreated_rows_and_reordering_do_not_satisfy_feedback(self):
        sections = ["identity", "location", "operating_hours", "photos", "documents"]
        self.reject(sections)
        identity = self._identity_payload()
        identity["specialty_tags"] = list(reversed(self.tags))
        IdentityService.save_identity(self.user, identity)
        location = self._location_payload()
        location["landmarks"].reverse()
        LocationService.save_location(self.application, location)
        OperatingHoursService.save_hours(self.application, list(reversed(self._hours_payload())))
        PhotoService.save_photos(self.application, {})
        DocumentService.save_documents(self.application, {})
        self.assertEqual(ApplicationService.get_changed_sections(self.application.reviews.first()), [])
        self.assert_unchanged_submission()

    def test_reverting_a_correction_and_whitespace_only_changes_do_not_count(self):
        self.reject(["identity"])
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "Corrected Bistro"})
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "  Sugbo Bistro  "})
        self.assert_unchanged_submission()

    def test_all_feedback_sections_need_actual_saved_changes(self):
        self.reject(["identity", "operating_hours"])
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "Corrected Bistro"})
        self.assert_unchanged_submission()
        hours = self._hours_payload()
        hours[0]["open_time"] = time(8, 0)
        OperatingHoursService.save_hours(self.application, hours)
        self.assertEqual(self.submit().status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.MAPP_SUBMISSION_COUNT, 2)

    def test_landmark_correction_counts_and_both_interfaces_agree(self):
        review = self.reject(["location"])
        location = self._location_payload()
        location["landmarks"][0]["MLMK_NAME"] = "Corrected landmark"
        LocationService.save_location(self.application, location)
        self.client.force_authenticate(self.user)
        merchant = self.client.get(reverse("application-detail"))
        self.assertTrue(merchant.data["data"]["latest_review"]["feedback"][0]["is_changed"])
        self.client.force_authenticate(self.admin)
        admin = AdminMerchantApplicationReviewSerializer(review).data
        self.assertEqual(admin["changed_sections"], ["location"])
        self.assertTrue(admin["feedback"][0]["is_changed"])
        self.assertEqual(self.submit().status_code, 200)

    def test_adding_a_photo_or_document_counts_as_a_correction(self):
        self.reject(["photos", "documents"])
        with patch("apps.merchant_application.services.photo_service.CloudinaryService.upload_image") as upload:
            upload.return_value = {"secure_url": "https://example.com/corrected.jpg", "public_id": "corrected/photo"}
            PhotoService.save_photos(self.application, {"storefront": [self._storefront_file()]})
        with patch("apps.merchant_application.services.document_service.CloudinaryService.upload_image") as upload:
            upload.return_value = {"secure_url": "https://example.com/corrected.pdf", "public_id": "corrected/doc", "version": 2}
            DocumentService.save_documents(self.application, {"business_registration": self._pdf_file()})
        self.assertEqual(self.submit().status_code, 200)

    def test_a_second_rejection_uses_the_new_rejected_version(self):
        first = self.reject(["identity"])
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "Corrected Bistro"})
        self.assertEqual(self.submit().status_code, 200)
        self.application.refresh_from_db()
        second = self.reject(["identity"])
        self.assertNotEqual(first.MAREV_SECTION_FINGERPRINTS, second.MAREV_SECTION_FINGERPRINTS)
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "Corrected Bistro"})
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.application.submissions.count(), 2)

    def test_approval_rechecks_current_status_verification_and_role_on_both_routes(self):
        states = [
            {"USER_STATUS": status} for status in ("disabled", "suspended", "pending")
        ] + [{"EMAIL_VERIFIED": False}, {"USER_ROLE": "admin"}, {"USER_ROLE": "super_admin"}]
        for state in states:
            User.objects.filter(pk=self.user.pk).update(
                USER_STATUS="active", EMAIL_VERIFIED=True, USER_ROLE="explorer",
            )
            User.objects.filter(pk=self.user.pk).update(**state)
            for route in ("merchant-application-approve", "application-review"):
                with self.subTest(state=state, route=route):
                    self.client.force_authenticate(self.admin)
                    with patch("apps.admin_operations.business_management.services.manage_application_service.NotificationEventService.merchant_application_resolved") as notify:
                        request = self.client.patch if route == "application-review" else self.client.post
                        response = request(reverse(route, args=[self.application.pk]), {"action": "approve"}, format="json")
                    self.assertEqual(response.status_code, 400)
                    notify.assert_not_called()
                    self.assertFalse(Business.objects.filter(USER_ID=self.user).exists())
                    self.assertFalse(Location.objects.exists())
                    self.assertFalse(MerchantApplicationReview.objects.filter(MAPP_ID=self.application).exists())
                    self.application.refresh_from_db()
                    self.assertEqual(self.application.MAPP_STATUS, "submitted")

    def test_restoring_active_status_allows_the_existing_pending_application(self):
        User.objects.filter(pk=self.user.pk).update(USER_STATUS="disabled")
        self.client.force_authenticate(self.admin)
        url = reverse("merchant-application-approve", args=[self.application.pk])
        self.assertEqual(self.client.post(url).status_code, 400)
        User.objects.filter(pk=self.user.pk).update(USER_STATUS="active")
        self.assertEqual(self.client.post(url).status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_ROLE, "merchant")

    def test_stale_application_instances_cannot_edit_submitted_content(self):
        stale = MerchantApplication.objects.get(pk=self.application.pk)
        stale.MAPP_STATUS = "draft"
        for operation in (
            lambda: LocationService.save_location(stale, self._location_payload()),
            lambda: OperatingHoursService.save_hours(stale, self._hours_payload()),
        ):
            with self.assertRaises(ValidationError):
                operation()

    def test_rollout_migration_baselines_only_current_latest_rejection(self):
        first = self.reject(["identity"])
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "Corrected before rollout"})
        MerchantApplicationReview.objects.filter(pk=first.pk).update(MAREV_SECTION_FINGERPRINTS={})
        module = import_module("apps.merchant_application.migrations.0017_baseline_existing_rejections")
        historical_apps = MigrationExecutor(connection).loader.project_state([
            ("merchant_application", "0016_merchantapplicationreview_section_fingerprints"),
        ]).apps
        with connection.schema_editor() as editor:
            module.baseline_existing_rejections(historical_apps, editor)
        first.refresh_from_db()
        self.assertEqual(first.MAREV_SECTION_FINGERPRINTS, get_section_fingerprints(self.application.pk))
        self.assert_unchanged_submission()
        IdentityService.save_identity(self.user, {"MIDN_BUSINESS_NAME": "Correction after rollout"})
        self.assertEqual(self.submit().status_code, 200)
