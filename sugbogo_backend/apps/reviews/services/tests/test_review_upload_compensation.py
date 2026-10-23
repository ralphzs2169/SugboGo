from unittest.mock import patch

from django.db import DatabaseError, transaction
from django.test import TestCase, TransactionTestCase, override_settings

from apps.reviews.models import Review, ReviewMediaCleanup, ReviewPhoto
from apps.reviews.services.review_service import ReviewEditConflict, ReviewService
from apps.reviews.services.tests import test_review_service as review_tests


class ReviewUploadFixtureMixin:
    """Isolate upload compensation from providers and derived publication work."""

    def setUp(self):
        super().setUp()
        review_tests.ReviewServiceTests.setUpTestData.__func__(type(self))
        self.upload = self._patch(
            "apps.reviews.services.review_service.CloudinaryService.upload_image",
        )
        self.destroy = self._patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        )
        self._patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={
                "outcome": "safe",
                "checked_at": "2026-10-23T00:00:00+00:00",
                "failure_type": None,
                "findings": [],
            },
        )
        self._patch(
            "apps.reviews.services.review_service.ReviewService._apply_published_effects",
        )
        self._patch(
            "apps.reviews.services.review_service."
            "ReputationService.apply_review_photo_upgrade_reward",
        )
        self.enqueue = self._patch(
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
        )

    def _patch(
        self,
        target,
        **kwargs,
    ):
        patcher = patch(target, **kwargs)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def _upload_result(
        self,
        public_id,
    ):
        return {
            "public_id": public_id,
            "secure_url": f"https://example.com/{public_id}.jpg",
        }

    def _submit(
        self,
        operation,
        photo_count=2,
    ):
        photos = [
            review_tests.ReviewServiceTests.create_test_image(f"{index}.jpg")
            for index in range(photo_count)
        ]
        if operation == "create":
            return ReviewService.create_review(
                user=self.user,
                business_id=self.business.pk,
                text="Friendly staff and delicious food.",
                photos=photos,
            )

        review, _ = Review.objects.get_or_create(
            USER_ID=self.user,
            BUSN_ID=self.business,
            defaults={"REVW_TEXT": "Original published review."},
        )
        return ReviewService.update_review(
            user=self.user,
            review_id=review.pk,
            photos=photos,
        )

    def _assert_no_durable_work(self):
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        self.enqueue.assert_not_called()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ReviewUploadCompensationTests(ReviewUploadFixtureMixin, TestCase):
    """Exercise request upload failures with real attachment transactions."""

    def test_successful_creation_keeps_uploaded_photos(self):
        self.upload.side_effect = [
            self._upload_result("reviews/first"),
            self._upload_result("reviews/second"),
        ]
        review = self._submit("create")

        self.assertEqual(review.photos.count(), 2)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.destroy.assert_not_called()
        self._assert_no_durable_work()

    def test_successful_edit_keeps_existing_and_new_photos(self):
        review = Review.objects.create(
            USER_ID=self.user,
            BUSN_ID=self.business,
            REVW_TEXT="Original published review.",
        )
        original = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_PUBLIC_ID="reviews/original",
            RPHO_PHOTO_URL="https://example.com/original.jpg",
        )
        self.upload.side_effect = [
            self._upload_result("reviews/first"),
            self._upload_result("reviews/second"),
        ]
        updated = self._submit("update")

        self.assertEqual(updated.photos.count(), 3)
        self.assertTrue(updated.photos.filter(pk=original.pk).exists())
        self.assertEqual(updated.REVW_TEXT, "Original published review.")
        self.destroy.assert_not_called()
        self._assert_no_durable_work()

    def test_partial_upload_failure_compensates_known_assets_for_both_operations(self):
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                self.destroy.reset_mock()
                error = RuntimeError("Original upload failure")
                public_id = f"reviews/{operation}"
                self.upload.side_effect = [
                    self._upload_result(public_id),
                    error,
                ]
                with self.assertRaises(RuntimeError) as raised:
                    self._submit(operation)

                self.assertIs(raised.exception, error)
                self.destroy.assert_called_once_with(
                    public_id,
                    resource_type="image",
                    type="upload",
                    timeout=15,
                )
                self.assertFalse(ReviewPhoto.objects.exists())
                self._assert_no_durable_work()

    def test_database_failure_rolls_back_attachments_and_compensates_all_uploads(self):
        create_photo = ReviewPhoto.objects.create
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                self.destroy.reset_mock()
                error = DatabaseError("Attachment transaction failed")
                public_ids = [f"reviews/{operation}-1", f"reviews/{operation}-2"]
                self.upload.side_effect = [
                    self._upload_result(public_id)
                    for public_id in public_ids
                ]

                def fail_after_attachment(**kwargs):
                    photo = create_photo(**kwargs)
                    if photo.RPHO_PHOTO_PUBLIC_ID == public_ids[-1]:
                        raise error
                    return photo

                with patch.object(
                    ReviewPhoto.objects,
                    "create",
                    side_effect=fail_after_attachment,
                ):
                    with self.assertRaises(DatabaseError) as raised:
                        self._submit(operation)

                self.assertIs(raised.exception, error)
                self.assertFalse(ReviewPhoto.objects.exists())
                self.assertEqual(
                    [call.args[0] for call in self.destroy.call_args_list],
                    public_ids,
                )
                if operation == "create":
                    self.assertFalse(Review.objects.exists())
                else:
                    self.assertEqual(
                        Review.objects.get(USER_ID=self.user).REVW_TEXT,
                        "Original published review.",
                    )
                self._assert_no_durable_work()

    def test_failed_compensation_logs_identifiers_and_preserves_original_error(self):
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                self.destroy.reset_mock()
                error = RuntimeError("PRIVATE request text")
                public_ids = [f"reviews/{operation}-1", f"reviews/{operation}-2"]
                self.upload.side_effect = [
                    self._upload_result(public_ids[0]),
                    self._upload_result(public_ids[1]),
                    error,
                ]
                self.destroy.side_effect = [
                    TimeoutError("PRIVATE provider credentials"),
                    {"result": "ok"},
                ]
                with self.assertLogs(
                    "apps.reviews.services.review_service",
                    level="ERROR",
                ) as logs:
                    with self.assertRaises(RuntimeError) as raised:
                        self._submit(operation, photo_count=3)

                self.assertIs(raised.exception, error)
                self.assertEqual(self.destroy.call_count, 2)
                record = logs.records[0]
                self.assertEqual(record.public_id, public_ids[0])
                self.assertEqual(record.operation, operation)
                self.assertEqual(record.business_id, self.business.pk)
                self.assertEqual(record.request_error_type, "RuntimeError")
                self.assertEqual(record.error_type, "TimeoutError")
                self.assertEqual(record.cleanup_stage, "deletion")
                if operation == "create":
                    self.assertIsNone(record.review_id)
                else:
                    self.assertEqual(
                        record.review_id,
                        Review.objects.get(USER_ID=self.user).pk,
                    )
                self.assertNotIn("PRIVATE", " ".join(logs.output))
                self.assertTrue(all(item.exc_info is None for item in logs.records))
                self._assert_no_durable_work()

    def test_unconfirmed_deletion_is_logged_as_failure(self):
        for result in (None, {}, {"result": "error"}):
            with self.subTest(result=result):
                self.upload.side_effect = [
                    self._upload_result("reviews/unconfirmed"),
                    RuntimeError("Upload failed"),
                ]
                self.destroy.return_value = result
                with self.assertLogs(
                    "apps.reviews.services.review_service",
                    level="ERROR",
                ) as logs:
                    with self.assertRaisesMessage(RuntimeError, "Upload failed"):
                        self._submit("create")

                self.assertEqual(logs.records[0].error_type, "RuntimeError")
                self.assertEqual(logs.records[0].public_id, "reviews/unconfirmed")

    def test_already_missing_asset_is_confirmed_compensation(self):
        self.upload.side_effect = [
            self._upload_result("reviews/missing"),
            RuntimeError("Upload failed"),
        ]
        self.destroy.return_value = {"result": "not found"}
        with self.assertLogs(
            "apps.reviews.services.review_service",
            level="INFO",
        ) as logs:
            with self.assertRaisesMessage(RuntimeError, "Upload failed"):
                self._submit("create")

        self.assertEqual(logs.records[-1].cleanup_result, "not found")

    def test_compensation_never_deletes_an_existing_attached_asset(self):
        other_review = Review.objects.create(
            USER_ID=self.second_user,
            BUSN_ID=self.business,
            REVW_TEXT="An existing committed review.",
        )
        attached = ReviewPhoto.objects.create(
            REVW_ID=other_review,
            RPHO_PHOTO_PUBLIC_ID="reviews/attached",
            RPHO_PHOTO_URL="https://example.com/attached.jpg",
        )
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                self.upload.side_effect = [
                    self._upload_result(attached.RPHO_PHOTO_PUBLIC_ID),
                    RuntimeError("Upload failed"),
                ]
                with self.assertLogs(
                    "apps.reviews.services.review_service",
                    level="WARNING",
                ) as logs:
                    with self.assertRaisesMessage(RuntimeError, "Upload failed"):
                        self._submit(operation)

                self.destroy.assert_not_called()
                self.assertTrue(ReviewPhoto.objects.filter(pk=attached.pk).exists())
                self.assertEqual(logs.records[0].public_id, "reviews/attached")
                self._assert_no_durable_work()

    def test_failed_attachment_check_skips_deletion_and_preserves_request_error(self):
        error = RuntimeError("Upload failed")
        self.upload.side_effect = [
            self._upload_result("reviews/uncertain"),
            error,
        ]
        with (
            patch.object(
                ReviewPhoto.objects,
                "filter",
                side_effect=DatabaseError("PRIVATE database details"),
            ),
            self.assertLogs(
                "apps.reviews.services.review_service",
                level="ERROR",
            ) as logs,
        ):
            with self.assertRaises(RuntimeError) as raised:
                self._submit("create")

        self.assertIs(raised.exception, error)
        self.destroy.assert_not_called()
        self.assertEqual(logs.records[0].cleanup_stage, "attachment_check")
        self.assertEqual(logs.records[0].public_id, "reviews/uncertain")
        self.assertNotIn("PRIVATE", " ".join(logs.output))

    def test_repeated_identifier_is_compensated_once(self):
        self.upload.side_effect = [
            self._upload_result("reviews/repeated"),
            self._upload_result("reviews/repeated"),
            RuntimeError("Upload failed"),
        ]
        with self.assertRaisesMessage(RuntimeError, "Upload failed"):
            self._submit("create", photo_count=3)

        self.destroy.assert_called_once()

    def test_edit_conflict_compensates_new_uploads_without_changing_original(self):
        error = ReviewEditConflict()
        self.upload.return_value = self._upload_result("reviews/conflict")
        with patch.object(ReviewService, "_save_review_update", side_effect=error):
            with self.assertRaises(ReviewEditConflict) as raised:
                self._submit("update", photo_count=1)

        self.assertIs(raised.exception, error)
        self.destroy.assert_called_once()
        self.assertFalse(ReviewPhoto.objects.exists())
        self.assertEqual(
            Review.objects.get(USER_ID=self.user).REVW_TEXT,
            "Original published review.",
        )


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ReviewUploadCommitTests(ReviewUploadFixtureMixin, TransactionTestCase):
    """Protect attachments when an exception occurs after the real commit."""

    def test_callback_error_does_not_delete_committed_creation_or_edit_photos(self):
        create_photo = ReviewPhoto.objects.create

        def callback_failed():
            raise RuntimeError("Post-commit callback failed")

        def attach_with_callback(**kwargs):
            photo = create_photo(**kwargs)
            transaction.on_commit(callback_failed)
            return photo

        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                public_id = f"reviews/{operation}-committed"
                self.upload.return_value = self._upload_result(public_id)
                with (
                    patch.object(
                        ReviewPhoto.objects,
                        "create",
                        side_effect=attach_with_callback,
                    ),
                    self.assertLogs(
                        "apps.reviews.services.review_service",
                        level="WARNING",
                    ),
                ):
                    with self.assertRaisesMessage(RuntimeError, "Post-commit"):
                        self._submit(operation, photo_count=1)

                self.destroy.assert_not_called()
                self.assertTrue(
                    ReviewPhoto.objects.filter(
                        RPHO_PHOTO_PUBLIC_ID=public_id,
                    ).exists(),
                )
                self._assert_no_durable_work()
