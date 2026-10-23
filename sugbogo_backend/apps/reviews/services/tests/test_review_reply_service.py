from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from cloudinary.exceptions import AuthorizationRequired
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import ReplyPhoto, Review, ReviewMediaCleanup, ReviewReply
from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.review_moderation_test_mixin import (
    SafeReviewModerationMixin,
)
from apps.users.models import User


class ReviewReplyServiceTests(SafeReviewModerationMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cls.cluster,
        )

        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

        cls.other_merchant = User.objects.create_user(
            email="other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.other_location = Location.objects.create(
            LOCT_POINT=Point(123.9000, 10.3200, srid=4326),
            LOCT_ADDRESS="Other Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.other_business = Business.objects.create(
            BUSN_NAME="Other Bistro",
            BUSN_DESCRIPTION="A different restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.other_merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.other_location,
        )

    def create_test_image(self, filename):
        image = Image.new(
            "RGB",
            (100, 100),
            "white",
        )

        image_data = BytesIO()

        image.save(
            image_data,
            format="JPEG",
        )

        image_data.seek(0)

        return SimpleUploadedFile(
            filename,
            image_data.read(),
            content_type="image/jpeg",
        )

    def test_create_reply(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food and excellent service.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you for visiting Sugbo Bistro!",
        )

        self.assertEqual(
            reply.REVW_ID_id,
            review.REVW_ID,
        )
        self.assertEqual(
            reply.RPLY_TEXT,
            "Thank you for visiting Sugbo Bistro!",
        )

    def test_create_reply_rejects_nonexistent_review(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review could not be found.",
        ):
            ReviewReplyService.create_reply(
                user=self.merchant,
                review_id=999999,
                text="Thank you for your feedback.",
            )

    def test_create_reply_rejects_merchant_from_different_business(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to reply to this review.",
        ):
            ReviewReplyService.create_reply(
                user=self.other_merchant,
                review_id=review.REVW_ID,
                text="I own a different business.",
            )

        self.assertFalse(
            ReviewReply.objects.filter(REVW_ID=review).exists(),
        )

    def test_update_reply_rejects_merchant_from_different_business(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Original reply.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to manage this review reply.",
        ):
            ReviewReplyService.update_reply(
                user=self.other_merchant,
                reply_id=reply.RPLY_ID,
                text="Tampered reply.",
            )

        reply.refresh_from_db()
        self.assertEqual(reply.RPLY_TEXT, "Original reply.")


    def test_delete_reply_rejects_merchant_from_different_business(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Original reply.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to manage this review reply.",
        ):
            ReviewReplyService.delete_reply(
                user=self.other_merchant,
                reply_id=reply.RPLY_ID,
            )

        self.assertTrue(
            ReviewReply.objects.filter(RPLY_ID=reply.RPLY_ID).exists(),
        )
        
    def test_create_reply_rejects_non_business_owner(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to reply to this review.",
        ):
            ReviewReplyService.create_reply(
                user=self.explorer,
                review_id=review.REVW_ID,
                text="I want to reply to this review.",
            )

    def test_create_reply_rejects_duplicate_reply(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you for your feedback.",
        )

        with self.assertRaisesMessage(
            ValidationError,
            "This review already has a reply.",
        ):
            ReviewReplyService.create_reply(
                user=self.merchant,
                review_id=review.REVW_ID,
                text="Another reply.",
            )

        self.assertEqual(
            ReviewReply.objects.filter(
                REVW_ID=review,
            ).count(),
            1,
        )

    def test_create_reply_is_available_through_review_relation(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you for your feedback.",
        )

        self.assertEqual(
            review.reply.RPLY_ID,
            reply.RPLY_ID,
        )

    @patch("apps.reviews.services.review_reply_service.CloudinaryService.delete_image")
    def test_delete_reply_cleans_up_reply_photos(
        self,
        mock_delete,
    ):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )
        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you.",
        )
        ReplyPhoto.objects.create(
            RPLY_ID=reply,
            RPHO_PHOTO_URL="https://example.com/a.jpg",
            RPHO_PHOTO_PUBLIC_ID="reply/a",
        )

        with patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                ReviewReplyService.delete_reply(
                    user=self.merchant,
                    reply_id=reply.RPLY_ID,
                )

        self.assertFalse(
            ReviewReply.objects.filter(RPLY_ID=reply.RPLY_ID).exists(),
        )
        mock_delete.assert_not_called()
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(record.RMCU_PUBLIC_ID, "reply/a")
        enqueue.assert_called_once_with(args=[record.pk], retry=False)


    @patch("apps.reviews.services.review_reply_service.CloudinaryService.delete_image")
    @patch("apps.reviews.services.review_reply_service.CloudinaryService.upload_image")
    def test_create_reply_cleans_up_uploaded_photos_when_upload_fails(
        self,
        mock_upload,
        mock_delete,
    ):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        first_photo = self.create_test_image("reply-1.jpg")
        second_photo = self.create_test_image("reply-2.jpg")

        mock_upload.side_effect = [
            {
                "public_id": "sugbogo/review-replies/reply-1",
                "secure_url": "https://res.cloudinary.com/test/reply-1.jpg",
            },
            RuntimeError("Cloudinary upload failed."),
        ]

        with self.assertRaises(RuntimeError):
            ReviewReplyService.create_reply(
                user=self.merchant,
                review_id=review.REVW_ID,
                text="Thank you!",
                photos=[first_photo, second_photo],
            )

        mock_delete.assert_called_once_with(
            "sugbogo/review-replies/reply-1",
        )

        self.assertFalse(
            ReviewReply.objects.filter(REVW_ID=review).exists(),
        )

        self.assertFalse(
            ReplyPhoto.objects.exists(),
        )



class ReplyPhotoServiceTests(SafeReviewModerationMixin, TestCase):
    """Tests for deleting individual reply photos."""

    @classmethod
    def setUpTestData(cls):
        cls.merchant = User.objects.create_user(
            email="reply-photo-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.other_merchant = User.objects.create_user(
            email="reply-photo-other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.explorer = User.objects.create_user(
            email="reply-photo-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=cls.cluster,
        )

        cls.location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

    def _create_reply_with_photo(self):
        review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=review.REVW_ID,
            text="Thank you!",
        )

        photo = ReplyPhoto.objects.create(
            RPLY_ID=reply,
            RPHO_PHOTO_URL="https://res.cloudinary.com/test/reply.jpg",
            RPHO_PHOTO_PUBLIC_ID="sugbogo/review-replies/reply",
        )

        return reply, photo

    @patch(
        "apps.reviews.services.review_reply_service.CloudinaryService.delete_image",
    )
    def test_delete_photo(self, mock_delete):
        _, photo = self._create_reply_with_photo()

        ReviewReplyService.delete_photo(
            user=self.merchant,
            photo_id=photo.RPHO_ID,
        )

        self.assertFalse(
            ReplyPhoto.objects.filter(RPHO_ID=photo.RPHO_ID).exists(),
        )

        mock_delete.assert_not_called()
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(record.RMCU_PUBLIC_ID, "sugbogo/review-replies/reply")

    def test_delete_photo_rejects_nonexistent_photo(self):
        with self.assertRaisesMessage(
            NotFound,
            "The reply photo could not be found.",
        ):
            ReviewReplyService.delete_photo(
                user=self.merchant,
                photo_id=999999,
            )

    def test_delete_photo_rejects_non_owner(self):
        _, photo = self._create_reply_with_photo()

        with self.assertRaisesMessage(
            PermissionDenied,
            "You do not have permission to manage this review reply.",
        ):
            ReviewReplyService.delete_photo(
                user=self.other_merchant,
                photo_id=photo.RPHO_ID,
            )

        self.assertTrue(
            ReplyPhoto.objects.filter(RPHO_ID=photo.RPHO_ID).exists(),
        )


class ReplyMediaTransactionTests(TransactionTestCase):
    """Exercise reply cleanup using real commits with isolated provider and broker calls."""

    def setUp(self):
        ReviewReplyServiceTests.setUpTestData.__func__(type(self))
        self.review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="Great food.",
        )
        self.reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=self.review.pk,
            text="Original reply.",
        )
        self.photo = ReplyPhoto.objects.create(
            RPLY_ID=self.reply,
            RPHO_PHOTO_URL="https://example.com/reply.jpg",
            RPHO_PHOTO_PUBLIC_ID="reply/original",
        )
        self.enqueue_patcher = patch(
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
        )
        self.enqueue = self.enqueue_patcher.start()
        self.addCleanup(self.enqueue_patcher.stop)
        self.destroy_patcher = patch(
            "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
            return_value={"result": "ok"},
        )
        self.destroy = self.destroy_patcher.start()
        self.addCleanup(self.destroy_patcher.stop)

    def _remove(
        self,
        operation,
    ):
        if operation == "update":
            ReviewReplyService.update_reply(
                user=self.merchant,
                reply_id=self.reply.pk,
                text="Updated reply.",
                keep_photo_ids=[],
            )
        elif operation == "delete_reply":
            ReviewReplyService.delete_reply(
                user=self.merchant,
                reply_id=self.reply.pk,
            )
        else:
            ReviewReplyService.delete_photo(
                user=self.merchant,
                photo_id=self.photo.pk,
            )

    def test_rollback_preserves_reply_photos_and_discards_cleanup(self):
        for operation in ("update", "delete_reply", "delete_photo"):
            with self.subTest(operation=operation):
                with self.assertRaisesMessage(RuntimeError, "Rollback"):
                    with transaction.atomic():
                        self._remove(operation)
                        self.assertEqual(ReviewMediaCleanup.objects.count(), 1)
                        self.assertFalse(
                            ReplyPhoto.objects.filter(pk=self.photo.pk).exists(),
                        )
                        self.enqueue.assert_not_called()
                        self.destroy.assert_not_called()
                        raise RuntimeError("Rollback")

                self.reply.refresh_from_db()
                self.photo.refresh_from_db()
                self.assertEqual(self.reply.RPLY_TEXT, "Original reply.")
                self.assertFalse(ReviewMediaCleanup.objects.exists())
                self.enqueue.assert_not_called()
                self.destroy.assert_not_called()

    def test_removal_dispatches_only_after_commit_and_preserves_identifiers(self):
        observations = []

        def observe_dispatch(
            *args,
            **kwargs,
        ):
            observations.append(connection.in_atomic_block)

        self.enqueue.side_effect = observe_dispatch

        for operation in ("update", "delete_photo", "delete_reply"):
            with self.subTest(operation=operation):
                if operation != "update":
                    self.photo = ReplyPhoto.objects.create(
                        RPLY_ID=self.reply,
                        RPHO_PHOTO_URL="https://example.com/another.jpg",
                        RPHO_PHOTO_PUBLIC_ID=f"reply/{operation}",
                    )
                self.enqueue.reset_mock()
                with transaction.atomic():
                    self._remove(operation)
                    self.enqueue.assert_not_called()
                    self.destroy.assert_not_called()

                record = ReviewMediaCleanup.objects.get(
                    RMCU_PUBLIC_ID=self.photo.RPHO_PHOTO_PUBLIC_ID,
                )
                self.assertEqual(record.RMCU_REVIEW_ID, self.review.pk)
                self.assertEqual(record.RMCU_RESOURCE_TYPE, "image")
                self.enqueue.assert_called_once_with(
                    args=[record.pk],
                    retry=False,
                )
                self.assertFalse(
                    ReplyPhoto.objects.filter(pk=self.photo.pk).exists(),
                )
                self.assertEqual(
                    ReviewMediaCleanupService.process(record.pk)["status"],
                    "succeeded",
                )
                self.destroy.assert_called_once_with(
                    self.photo.RPHO_PHOTO_PUBLIC_ID,
                    resource_type="image",
                    type="upload",
                    timeout=15,
                )
                self.destroy.reset_mock()

        self.assertEqual(observations, [False, False, False])
        self.assertFalse(ReviewReply.objects.filter(pk=self.reply.pk).exists())

    def test_failure_after_commit_retains_work_and_recovers(self):
        self._remove("delete_reply")
        record = ReviewMediaCleanup.objects.get()
        self.destroy.side_effect = TimeoutError("Unavailable")

        outcome = ReviewMediaCleanupService.process(record.pk)

        self.assertEqual(outcome, {"status": "pending", "retry_after": 60})
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 1)
        self.assertEqual(record.RMCU_LAST_ERROR, "TimeoutError")
        self.assertEqual(record.RMCU_PUBLIC_ID, "reply/original")
        self.assertFalse(ReviewReply.objects.filter(pk=self.reply.pk).exists())
        self.assertEqual(ReviewMediaCleanupService.recover_pending(), 0)

        ReviewMediaCleanup.objects.filter(pk=record.pk).update(
            RMCU_NEXT_ATTEMPT_AT=timezone.now() - timedelta(seconds=1),
        )
        self.enqueue.reset_mock()
        self.assertEqual(ReviewMediaCleanupService.recover_pending(), 1)
        self.enqueue.assert_called_once_with(args=[record.pk], retry=False)
        self.destroy.side_effect = None
        self.assertEqual(
            ReviewMediaCleanupService.process(record.pk)["status"],
            "succeeded",
        )
        record.refresh_from_db()
        self.assertEqual(record.RMCU_ATTEMPTS, 2)

    def test_permanent_failure_can_be_requeued_after_intervention(self):
        self._remove("delete_photo")
        record = ReviewMediaCleanup.objects.get()
        self.destroy.side_effect = AuthorizationRequired("Denied")
        self.assertEqual(
            ReviewMediaCleanupService.process(record.pk)["status"],
            "failed",
        )
        self.enqueue.reset_mock()

        with transaction.atomic():
            ReviewMediaCleanupService.requeue_failed(record.pk)
            self.enqueue.assert_not_called()

        self.enqueue.assert_called_once_with(args=[record.pk], retry=False)
        self.destroy.side_effect = None
        self.assertEqual(
            ReviewMediaCleanupService.process(record.pk)["status"],
            "succeeded",
        )

    def test_lost_publication_is_recoverable(self):
        self.enqueue.side_effect = RuntimeError("Broker unavailable")
        self._remove("update")
        record = ReviewMediaCleanup.objects.get()
        self.assertFalse(ReplyPhoto.objects.filter(pk=self.photo.pk).exists())
        self.assertEqual(record.RMCU_STATUS, "pending")
        self.enqueue.side_effect = None
        self.enqueue.reset_mock()
        self.assertEqual(ReviewMediaCleanupService.recover_pending(), 1)
        self.enqueue.assert_called_once_with(args=[record.pk], retry=False)

    def test_duplicate_registration_and_execution_preserve_database_state(self):
        assets = {("reply/original", "image")}
        with transaction.atomic():
            ReviewMediaCleanupService.register_assets(
                review_id=self.review.pk,
                assets=assets,
            )
            ReviewMediaCleanupService.register_review_assets(self.review)
            self._remove("update")
            ReviewMediaCleanupService.register_assets(
                review_id=self.review.pk,
                assets=assets,
            )

        record = ReviewMediaCleanup.objects.get()
        self.enqueue.assert_called_once_with(args=[record.pk], retry=False)
        self.assertEqual(
            ReviewMediaCleanupService.process(record.pk)["status"],
            "succeeded",
        )
        self.assertEqual(
            ReviewMediaCleanupService.process(record.pk)["status"],
            "skipped",
        )
        ReviewMediaCleanupService.register_assets(
            review_id=self.review.pk,
            assets=assets,
        )
        self.assertEqual(ReviewMediaCleanup.objects.count(), 1)
        self.enqueue.assert_called_once()
        self.destroy.assert_called_once()
        self.reply.refresh_from_db()
        self.assertEqual(self.reply.RPLY_TEXT, "Updated reply.")
        self.assertTrue(Review.objects.filter(pk=self.review.pk).exists())

    @patch("apps.reviews.services.review_reply_service.CloudinaryService.upload_image")
    def test_update_preserves_kept_photos_and_uploads_replacements(
        self,
        upload,
    ):
        upload.return_value = {
            "public_id": "reply/new",
            "secure_url": "https://example.com/new.jpg",
        }
        ReviewReplyService.update_reply(
            user=self.merchant,
            reply_id=self.reply.pk,
            text="Edited reply.",
            keep_photo_ids=[self.photo.pk],
            photos=[object()],
        )
        self.assertEqual(self.reply.photos.count(), 2)
        self.reply.refresh_from_db()
        self.assertEqual(self.reply.RPLY_TEXT, "Edited reply.")
        self.assertTrue(ReplyPhoto.objects.filter(pk=self.photo.pk).exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        self.enqueue.assert_not_called()
        self.destroy.assert_not_called()

        ReviewReplyService.update_reply(
            user=self.merchant,
            reply_id=self.reply.pk,
            keep_photo_ids=[self.photo.pk],
        )
        self.assertEqual(self.reply.photos.count(), 1)
        self.assertEqual(ReviewMediaCleanup.objects.get().RMCU_PUBLIC_ID, "reply/new")

    @patch("apps.reviews.services.review_reply_service.CloudinaryService.upload_image")
    def test_invalid_photo_selection_or_limit_creates_no_cleanup(
        self,
        upload,
    ):
        for keep_ids, photos in (
            ([self.photo.pk + 999999], []),
            ([self.photo.pk], [object(), object(), object()]),
        ):
            with self.subTest(keep_ids=keep_ids):
                with self.assertRaises(ValidationError):
                    ReviewReplyService.update_reply(
                        user=self.merchant,
                        reply_id=self.reply.pk,
                        keep_photo_ids=keep_ids,
                        photos=photos,
                    )

        self.assertTrue(ReplyPhoto.objects.filter(pk=self.photo.pk).exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        upload.assert_not_called()
        self.enqueue.assert_not_called()
        self.destroy.assert_not_called()
