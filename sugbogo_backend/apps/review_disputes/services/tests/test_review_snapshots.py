from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.serializers.manage_review_dispute_serializers import (
    AdminReviewDisputeDetailSerializer,
)
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.moderation.services.tests import (
    test_manage_review_dispute_service as dispute_tests,
)
from apps.notifications.models import Notification
from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
    MerchantReviewDisputeSnapshot,
)
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService
from apps.review_disputes.services.review_snapshot_service import (
    DisputeContentConflict,
    ReviewSnapshotService,
)
from apps.reviews.models import Review, ReviewMediaCleanup, ReviewPhoto
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_service import (
    ReviewEditContentFlagged,
    ReviewEditModerationUnavailable,
    ReviewService,
)
from apps.users.models import ReputationEvent


class SnapshotFixtures:
    def setUp(self):
        dispute_tests.ManageReviewDisputeServiceTests.setUp(self)
        self.photo = ReviewPhoto.objects.create(
            REVW_ID=self.review,
            RPHO_PHOTO_URL="https://example.com/original.jpg",
            RPHO_PHOTO_PUBLIC_ID="review/original",
        )
        for target in (
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
            "apps.reviews.services.review_service.ReviewService._queue_sentiment_after_commit",
        ):
            self.enterContext(patch(target))
        self.moderate = self.enterContext(patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={"outcome": "safe", "findings": []},
        ))
        self.destroy = self.enterContext(patch(
            "apps.shared.services.cloudinary_service.CloudinaryService.destroy_asset",
            return_value={"result": "ok"},
        ))

    def file_dispute(self):
        return ReviewDisputeService.create_dispute(
            user=self.merchant,
            review_id=self.review.pk,
            reason="fake_review",
            description="The reviewer did not visit this business.",
        )

    def token(self):
        self.review.refresh_from_db()
        return ReviewSnapshotService.current_fingerprint(self.review)

    def detail(
        self,
        dispute,
    ):
        return AdminReviewDisputeDetailSerializer(
            ManageReviewDisputeService.get_dispute_detail(dispute.pk),
        ).data

    def edit(
        self,
        **kwargs,
    ):
        return ReviewService.update_review(
            user=self.explorer,
            review_id=self.review.pk,
            **kwargs,
        )

    def decision(
        self,
        dispute,
        *,
        uphold=True,
        **kwargs,
    ):
        method = ManageReviewDisputeService.dismiss_dispute
        if uphold:
            method = ManageReviewDisputeService.uphold_dispute
        return method(
            dispute.pk,
            actor=self.admin,
            expected_fingerprint=kwargs.pop("expected_fingerprint", self.token()),
            admin_notes=kwargs.pop(
                "admin_notes",
                "Current review inspected; the stated violation is still present.",
            ),
            **kwargs,
        )

    def cleanup_record(self):
        ReviewMediaCleanupService.register_assets(
            review_id=self.review.pk,
            assets={(self.photo.RPHO_PHOTO_PUBLIC_ID, "image")},
        )
        return ReviewMediaCleanup.objects.get(
            RMCU_PUBLIC_ID=self.photo.RPHO_PHOTO_PUBLIC_ID,
        )


class ReviewSnapshotTests(SnapshotFixtures, TestCase):
    def test_filing_captures_exact_content_and_identifiers(self):
        dispute = self.file_dispute()
        snapshot = dispute.snapshot
        self.assertEqual(snapshot.MRDS_REVIEW_ID, self.review.pk)
        self.assertEqual(snapshot.MRDS_AUTHOR_ID, self.explorer.pk)
        self.assertEqual(snapshot.MRDS_BUSINESS_ID, self.business.pk)
        self.assertEqual(snapshot.MRDS_TEXT, self.review.REVW_TEXT)
        self.assertEqual(snapshot.MRDS_STATUS, "published")
        self.assertEqual(snapshot.MRDS_SUBMITTED_AT, self.review.REVW_CREATED_AT)
        self.assertIsNone(snapshot.MRDS_EDITED_AT)
        self.assertGreaterEqual(snapshot.MRDS_CAPTURED_AT, snapshot.MRDS_SUBMITTED_AT)
        self.assertEqual(snapshot.MRDS_PHOTOS, [{
            "id": self.photo.pk,
            "url": self.photo.RPHO_PHOTO_URL,
            "public_id": self.photo.RPHO_PHOTO_PUBLIC_ID,
            "resource_type": "image",
            "display_order": 0,
        }])
        self.assertEqual(snapshot.MRDS_FINGERPRINT, self.token())
        self.assertFalse(dispute.evidence.exists())

    def test_each_attempt_keeps_its_own_snapshot_and_number(self):
        first = self.file_dispute()
        self.decision(first, uphold=False)
        self.edit(text="Revised but still disputed review.")
        second = self.file_dispute()
        self.assertEqual(second.attempt_number, 2)
        self.assertNotEqual(first.snapshot.MRDS_TEXT, second.snapshot.MRDS_TEXT)
        self.assertIsNotNone(second.snapshot.MRDS_EDITED_AT)
        data = self.detail(second)
        self.assertEqual(data["previous_dispute_count"], 1)
        self.assertEqual(
            data["previous_disputes"][0]["review_at_filing"]["text"],
            first.snapshot.MRDS_TEXT,
        )

    def test_safe_edit_remains_published_and_keeps_filing_text(self):
        dispute = self.file_dispute()
        self.edit(text="New safe review content.")
        self.moderate.assert_called_once()
        self.review.refresh_from_db()
        dispute.snapshot.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertNotEqual(self.review.REVW_TEXT, dispute.snapshot.MRDS_TEXT)
        self.assertEqual(dispute.MRDSP_STATUS, "pending")
        data = self.detail(dispute)
        self.assertTrue(data["material_content_changed"])
        self.assertTrue(data["decision_eligible"])
        self.assertEqual(data["current_review"]["text"], self.review.REVW_TEXT)
        self.assertEqual(data["review_at_filing"]["text"], dispute.snapshot.MRDS_TEXT)

    def test_photo_replacement_retains_removed_asset(self):
        dispute = self.file_dispute()
        with patch(
            "apps.reviews.services.review_service.CloudinaryService.upload_image",
            return_value={
                "public_id": "review/replacement",
                "secure_url": "https://example.com/replacement.jpg",
            },
        ):
            self.edit(photos=[object()], keep_photo_ids=[])
        self.assertEqual(self.review.photos.count(), 1)
        self.assertFalse(self.review.photos.filter(pk=self.photo.pk).exists())
        record = ReviewMediaCleanup.objects.get(RMCU_PUBLIC_ID="review/original")
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        self.destroy.assert_not_called()
        dispute.snapshot.refresh_from_db()
        self.assertEqual(dispute.snapshot.MRDS_PHOTOS[0]["id"], self.photo.pk)
        self.assertTrue(self.detail(dispute)["material_content_changed"])

    def test_photo_addition_keeps_original_snapshot_and_changes_token(self):
        dispute = self.file_dispute()
        with patch(
            "apps.reviews.services.review_service.CloudinaryService.upload_image",
            return_value={
                "public_id": "review/additional",
                "secure_url": "https://example.com/additional.jpg",
            },
        ):
            self.edit(photos=[object()])
        self.assertEqual(self.review.photos.count(), 2)
        self.assertEqual(len(dispute.snapshot.MRDS_PHOTOS), 1)
        self.assertNotEqual(self.token(), dispute.snapshot.MRDS_FINGERPRINT)

    def test_photo_only_removal_keeps_snapshot_asset(self):
        dispute = self.file_dispute()
        self.edit(keep_photo_ids=[])
        self.moderate.assert_not_called()
        self.assertFalse(self.review.photos.exists())
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        self.assertEqual(len(dispute.snapshot.MRDS_PHOTOS), 1)
        self.destroy.assert_not_called()

    def test_failed_ai_moderation_preserves_both_versions(self):
        dispute = self.file_dispute()
        original = self.token()
        for outcome, exception in (
            ("flagged", ReviewEditContentFlagged),
            ("provider_failure", ReviewEditModerationUnavailable),
        ):
            with self.subTest(outcome=outcome):
                self.moderate.return_value = {"outcome": outcome, "findings": []}
                with self.assertRaises(exception):
                    self.edit(text="Unsafe or unchecked proposed edit.", keep_photo_ids=[])
                self.assertEqual(self.token(), original)
                dispute.snapshot.refresh_from_db()
                self.assertEqual(dispute.snapshot.MRDS_FINGERPRINT, original)
                self.assertFalse(ReviewMediaCleanup.objects.exists())

    def test_snapshot_cannot_be_overwritten_even_by_queryset_update(self):
        dispute = self.file_dispute()
        with self.assertRaises(IntegrityError), transaction.atomic():
            MerchantReviewDisputeSnapshot.objects.filter(MRDSP_ID=dispute).update(
                MRDS_TEXT="Fabricated filing content",
            )
        self.assertEqual(dispute.snapshot.MRDS_TEXT, self.review.REVW_TEXT)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ReviewSnapshotService.capture(dispute)

    def test_fingerprint_ignores_counts_timestamps_status_and_url_changes(self):
        fingerprint = self.token()
        self.review.REVW_LIKE_COUNT = 10
        self.review.REVW_REPORT_COUNT = 5
        self.review.REVW_STATUS = Review.ReviewStatus.REJECTED
        self.review.save()
        self.photo.RPHO_PHOTO_URL = "https://example.com/new-delivery-url.jpg"
        self.photo.save()
        self.assertEqual(self.token(), fingerprint)

    def test_snapshot_failure_rolls_back_dispute(self):
        with patch.object(ReviewSnapshotService, "capture", side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.file_dispute()
        self.assertFalse(MerchantReviewDispute.objects.exists())

    def test_legacy_dispute_does_not_fabricate_evidence(self):
        dispute = MerchantReviewDispute.objects.create(
            REVW_ID=self.review,
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            MRDSP_REASON="fake_review",
            MRDSP_DESCRIPTION="Legacy allegation.",
        )
        data = self.detail(dispute)
        self.assertEqual(data["review_at_filing"], {
            "available": False,
            "message": "Filing-time snapshot unavailable",
        })
        self.assertTrue(data["filing_snapshot_unavailable"])
        self.assertIsNone(data["material_content_changed"])
        self.assertFalse(MerchantReviewDisputeSnapshot.objects.exists())
        with self.assertRaises(ValidationError):
            self.decision(dispute)
        self.decision(dispute, acknowledge_review_changes=True)


class SnapshotRetentionTests(SnapshotFixtures, TestCase):
    def test_old_queued_merchant_evidence_job_retains_correct_resource_type(self):
        dispute = self.file_dispute()
        evidence = MerchantReviewDisputeEvidence.objects.create(
            MRDSP_ID=dispute,
            MRDSE_TYPE="document",
            MRDSE_URL="https://example.com/document.pdf",
            MRDSE_PUBLIC_ID="dispute/document.pdf",
        )
        ReviewMediaCleanupService.register_assets(
            review_id=self.review.pk,
            assets={(evidence.MRDSE_PUBLIC_ID, "raw")},
        )
        record = ReviewMediaCleanup.objects.get(RMCU_PUBLIC_ID=evidence.MRDSE_PUBLIC_ID)
        ReviewService.delete_review(self.explorer, self.review.pk)
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        self.destroy.assert_not_called()
        dispute.delete()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")
        self.destroy.assert_called_once_with(
            public_id=evidence.MRDSE_PUBLIC_ID,
            resource_type="raw",
        )

    def test_late_evidence_upload_is_not_committed_after_author_deletion(self):
        dispute = self.file_dispute()

        def finish_upload(
            *args,
            **kwargs,
        ):
            ReviewService.delete_review(self.explorer, self.review.pk)
            return {
                "public_id": "dispute/late-document.pdf",
                "secure_url": "https://example.com/late-document.pdf",
            }

        with patch(
            "apps.review_disputes.services.review_dispute_service.CloudinaryService.upload_image",
            side_effect=finish_upload,
        ):
            with self.assertRaises(ValidationError):
                ReviewDisputeService.add_evidence(
                    self.merchant,
                    dispute.pk,
                    "document",
                    SimpleUploadedFile("proof.pdf", b"document contents"),
                )
        self.assertFalse(dispute.evidence.exists())
        record = ReviewMediaCleanup.objects.get(RMCU_PUBLIC_ID="dispute/late-document.pdf")
        self.assertEqual(record.RMCU_RESOURCE_TYPE, "raw")
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")

    def test_late_review_upload_compensation_keeps_snapshot_owned_media(self):
        self.file_dispute()
        ReviewService.delete_photo(self.explorer, self.photo.pk)
        ReviewService._compensate_uploaded_photos(
            public_ids=[self.photo.RPHO_PHOTO_PUBLIC_ID],
            operation="update",
            business_id=self.business.pk,
            review_id=self.review.pk,
            request_error=RuntimeError("A late commit callback failed."),
        )
        self.destroy.assert_not_called()

    def test_already_queued_asset_is_retained_without_attempt_or_retry(self):
        record = self.cleanup_record()
        self.file_dispute()
        self.edit(keep_photo_ids=[])
        self.assertEqual(ReviewMediaCleanupService.process(record.pk), {
            "status": "retained",
            "retry_after": 0,
        })
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 0)
        self.assertEqual(ReviewMediaCleanupService.recover_pending(), 0)
        self.destroy.assert_not_called()

    def test_multiple_attempts_retain_asset_until_last_reference_is_purged(self):
        first = self.file_dispute()
        self.decision(first, uphold=False)
        second = self.file_dispute()
        self.edit(keep_photo_ids=[])
        record = ReviewMediaCleanup.objects.get()
        first.delete()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        second.delete()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")
        self.destroy.assert_called_once_with(
            public_id=self.photo.RPHO_PHOTO_PUBLIC_ID,
            resource_type="image",
        )

    def test_live_reference_protects_media_after_snapshot_release(self):
        dispute = self.file_dispute()
        dispute.delete()
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        ReviewService.delete_photo(self.explorer, self.photo.pk)
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")

    def test_unreferenced_photo_uses_normal_cleanup(self):
        ReviewService.delete_photo(self.explorer, self.photo.pk)
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "succeeded")
        self.destroy.assert_called_once()

    def test_author_deletion_preserves_case_snapshot_and_merchant_evidence(self):
        dispute = self.file_dispute()
        evidence = MerchantReviewDisputeEvidence.objects.create(
            MRDSP_ID=dispute,
            MRDSE_TYPE="document",
            MRDSE_URL="https://example.com/evidence.pdf",
            MRDSE_PUBLIC_ID="dispute/evidence.pdf",
        )
        ReviewService.delete_review(self.explorer, self.review.pk)
        dispute.refresh_from_db()
        self.assertIsNone(dispute.REVW_ID_id)
        self.assertEqual(dispute.MRDSP_STATUS, "author_deleted")
        self.assertEqual(dispute.MRDSP_CLOSURE_REASON, "content_removed_by_author")
        self.assertIsNotNone(dispute.MRDSP_RESOLVED_AT)
        self.assertTrue(MerchantReviewDisputeEvidence.objects.filter(pk=evidence.pk).exists())
        self.assertTrue(MerchantReviewDisputeSnapshot.objects.filter(MRDSP_ID=dispute).exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.assertEqual(AdminActivity.objects.get().AACT_ACTION, "review_deleted_by_author")
        self.assertEqual(Notification.objects.get().NOTF_TYPE, "review_dispute_closed_by_author")
        self.assertFalse(
            ReviewMediaCleanup.objects.filter(
                RMCU_PUBLIC_ID="dispute/evidence.pdf",
            ).exists(),
        )
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(ReviewMediaCleanupService.process(record.pk)["status"], "retained")
        data = self.detail(dispute)
        self.assertEqual(data["current_review"], {"exists": False})
        self.assertFalse(data["decision_eligible"])
        self.assertIsNone(data["current_content_fingerprint"])
        self.assertTrue(data["review_at_filing"]["available"])
        for uphold in (True, False):
            with self.assertRaises(ValidationError):
                method = ManageReviewDisputeService.dismiss_dispute
                if uphold:
                    method = ManageReviewDisputeService.uphold_dispute
                method(
                    dispute.pk,
                    actor=self.admin,
                    expected_fingerprint="0" * 64,
                )

    def test_resolved_decision_survives_deletion_with_its_audit_and_notifications(self):
        dispute = self.file_dispute()
        self.decision(dispute, uphold=False)
        audit = AdminActivity.objects.get()
        notices = list(Notification.objects.values())
        ReviewService.delete_review(self.explorer, self.review.pk)
        dispute.refresh_from_db()
        self.assertEqual(dispute.MRDSP_STATUS, "dismissed")
        self.assertTrue(AdminActivity.objects.filter(pk=audit.pk).exists())
        self.assertEqual(list(Notification.objects.values()), notices)
        self.assertTrue(dispute.snapshot.MRDS_PHOTOS)

    def test_business_cascade_keeps_history_and_closes_pending_case(self):
        dispute = self.file_dispute()
        self.business.delete()
        dispute.refresh_from_db()
        self.assertIsNone(dispute.BUSN_ID_id)
        self.assertIsNone(dispute.REVW_ID_id)
        self.assertEqual(dispute.MRDSP_STATUS, "review_removed")
        self.assertEqual(dispute.MRDSP_ORIGINAL_BUSINESS_ID, dispute.snapshot.MRDS_BUSINESS_ID)
        self.assertTrue(self.detail(dispute)["review_at_filing"]["available"])

    def test_account_cascade_keeps_history_without_author_deletion_claim(self):
        dispute = self.file_dispute()
        author_id = self.explorer.pk
        self.explorer.delete()
        dispute.refresh_from_db()
        self.assertEqual(dispute.snapshot.MRDS_AUTHOR_ID, author_id)
        self.assertEqual(dispute.MRDSP_STATUS, "review_removed")
        self.assertIsNone(dispute.REVW_ID_id)

    def test_merchant_account_cascade_does_not_erase_dispute(self):
        dispute = self.file_dispute()
        merchant_id = self.merchant.pk
        with self.assertRaises(ProtectedError):
            self.merchant.delete()
        self.business.delete()
        self.merchant.delete()
        dispute.refresh_from_db()
        self.assertIsNone(dispute.USER_ID_id)
        self.assertEqual(dispute.MRDSP_ORIGINAL_MERCHANT_ID, merchant_id)
        self.assertTrue(self.detail(dispute)["review_at_filing"]["available"])

    def test_attempt_grouping_survives_deletion_without_combining_other_reviews(self):
        first = self.file_dispute()
        self.decision(first, uphold=False)
        second = self.file_dispute()
        other = ReviewDisputeService.create_dispute(
            user=self.second_merchant,
            review_id=self.second_review.pk,
            reason="fake_review",
            description="Other review allegation.",
        )
        ReviewService.delete_review(self.explorer, self.review.pk)
        data = self.detail(second)
        self.assertEqual(data["attempt_number"], 2)
        self.assertEqual([item["id"] for item in data["previous_disputes"]], [first.pk])
        owned = ReviewDisputeService.get_dispute_detail(self.merchant, second.pk)
        self.assertEqual(owned.attempt_number, 2)
        self.assertNotIn(other.pk, [item.pk for item in owned.previous_disputes])


class SnapshotDecisionTests(SnapshotFixtures, TestCase):
    def test_both_stale_decisions_fail_without_any_side_effects(self):
        dispute = self.file_dispute()
        old_token = self.token()
        self.edit(text="A later, revised review.")
        for uphold in (True, False):
            with self.subTest(uphold=uphold):
                with self.assertRaises(DisputeContentConflict):
                    self.decision(dispute, uphold=uphold, expected_fingerprint=old_token)
                dispute.refresh_from_db()
                self.assertEqual(dispute.MRDSP_STATUS, "pending")
                self.assertIsNone(dispute.MRDSP_RESOLVED_AT)
                self.assertFalse(AdminActivity.objects.exists())
                self.assertFalse(Notification.objects.exists())
                self.assertFalse(ReputationEvent.objects.exists())
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "published")

    def test_changed_uphold_requires_acknowledgement_and_notes(self):
        dispute = self.file_dispute()
        self.edit(text="A revised review that needs independent justification.")
        with self.assertRaises(ValidationError):
            self.decision(dispute)
        for notes in (None, "", "   ", "Insufficient"):
            with self.subTest(notes=notes):
                with self.assertRaises(ValidationError):
                    self.decision(dispute, acknowledge_review_changes=True, admin_notes=notes)
        self.assertFalse(AdminActivity.objects.exists())
        self.assertFalse(ReputationEvent.objects.exists())
        self.decision(dispute, acknowledge_review_changes=True)
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "rejected")
        self.assertEqual(ReputationEvent.objects.count(), 1)
        self.assertTrue(AdminActivity.objects.get().AACT_CONTEXT["acknowledged_review_changes"])

    def test_changed_review_can_be_dismissed_without_acknowledgement(self):
        dispute = self.file_dispute()
        self.edit(text="Updated review content.")
        self.decision(dispute, uphold=False)
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "published")
        self.assertFalse(ReputationEvent.objects.exists())

    def test_unchanged_review_can_be_upheld_without_acknowledgement(self):
        dispute = self.file_dispute()
        self.assertFalse(self.detail(dispute)["material_content_changed"])
        self.decision(dispute)
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, "rejected")
        self.assertEqual(Notification.objects.count(), 2)
