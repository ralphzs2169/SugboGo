from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.system_configuration.models import (
    AnalyticsPolicyConfiguration,
)
from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import ReplyPhoto, Review, ReviewMediaCleanup, ReviewReply
from apps.reviews.services.review_reply_service import (
    ReviewReplyEditConflict,
    ReviewReplyService,
)
from apps.reviews.services.tests.review_moderation_test_mixin import (
    create_and_moderate_review,
    SafeReviewModerationMixin,
)
from apps.users.models import User


class ReviewReplyViewTests(SafeReviewModerationMixin, APITestCase):
    """Tests for business-owner review reply API endpoints."""

    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.merchant = User.objects.create_user(
            email="merchant-reply@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-reply@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(
            self.merchant,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.review = create_and_moderate_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        self.url = (
            f"/api/reviews/{self.review.REVW_ID}/reply/"
        )

    def test_create_reply_successfully(self):
        response = self.client.post(
            self.url,
            {
                "text": "Thank you for visiting Sugbo Bistro!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        reply = ReviewReply.objects.get(
            RPLY_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            reply.REVW_ID_id,
            self.review.REVW_ID,
        )
        self.assertEqual(
            reply.RPLY_TEXT,
            "Thank you for visiting Sugbo Bistro!",
        )

        self.assertEqual(
            response.data["data"]["review_id"],
            self.review.REVW_ID,
        )

        self.assertEqual(
            response.data["message"],
            "Review reply added successfully.",
        )

    def test_create_reply_hides_nonpublished_reviews(self):
        for review_status in (
            Review.ReviewStatus.UNDER_REVIEW,
            Review.ReviewStatus.FLAGGED,
            Review.ReviewStatus.REJECTED,
        ):
            with self.subTest(status=review_status):
                self.review.REVW_STATUS = review_status
                self.review.save(update_fields=["REVW_STATUS"])
                response = self.client.post(
                    self.url,
                    {"text": "Thank you for visiting Sugbo Bistro!"},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                self.assertFalse(response.data["success"])
                self.assertEqual(response.data["code"], "NOT_FOUND")
                self.assertEqual(
                    response.data["message"],
                    "The review could not be found.",
                )
                self.assertNotIn(self.review.REVW_TEXT, response.content.decode())
                self.assertFalse(ReviewReply.objects.filter(REVW_ID=self.review).exists())

    def test_create_reply_rejects_missing_text(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "text",
            response.data["errors"],
        )

        self.assertFalse(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).exists(),
        )

    def test_create_reply_rejects_text_over_1000_characters(self):
        response = self.client.post(
            self.url,
            {
                "text": "a" * 1001,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "text",
            response.data["errors"],
        )

        self.assertFalse(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).exists(),
        )

    def test_create_reply_rejects_non_owner(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.post(
            self.url,
            {
                "text": "I should not be able to reply.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertEqual(
            response.data["message"],
            "You do not have permission to perform this action.",
        )

        self.assertFalse(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).exists(),
        )

    def test_create_reply_rejects_duplicate(self):
        ReviewReply.objects.create(
            REVW_ID=self.review,
            RPLY_TEXT="Thank you for your feedback.",
        )

        response = self.client.post(
            self.url,
            {
                "text": "Another reply.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "This review already has a reply.",
        )

        self.assertEqual(
            ReviewReply.objects.filter(
                REVW_ID=self.review,
            ).count(),
            1,
        )

    def test_create_reply_rejects_nonexistent_review(self):
        response = self.client.post(
            "/api/reviews/999999/reply/",
            {
                "text": "Thank you for your feedback.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The review could not be found.",
        )

        self.assertFalse(
            ReviewReply.objects.exists(),
        )

    def test_create_reply_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.url,
            {
                "text": "Thank you for your feedback.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            ReviewReply.objects.exists(),
        )

    # add to ReviewReplyViewTests

    @staticmethod
    def create_test_image(filename="reply.jpg", width=100, height=100):
        image = Image.new("RGB", (width, height))
        image_file = BytesIO()
        image.save(image_file, format="JPEG")
        image_file.seek(0)
        return SimpleUploadedFile(filename, image_file.read(), content_type="image/jpeg")

    @patch("apps.reviews.views.review_reply_views.ReviewReplyService.create_reply")
    def test_create_reply_with_photos(self, mock_create_reply):
        first_photo = self.create_test_image("reply-1.jpg")
        second_photo = self.create_test_image("reply-2.jpg")

        mock_reply = ReviewReply(
            RPLY_ID=1,
            REVW_ID=self.review,
            RPLY_TEXT="Thank you!",
        )

        mock_create_reply.return_value = mock_reply

        response = self.client.post(
            self.url,
            {
                "text": "Thank you!",
                "photos": [first_photo, second_photo],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        mock_create_reply.assert_called_once()

        call_kwargs = mock_create_reply.call_args.kwargs

        self.assertEqual(call_kwargs["user"], self.merchant)
        self.assertEqual(call_kwargs["review_id"], self.review.REVW_ID)
        self.assertEqual(call_kwargs["text"], "Thank you!")
        self.assertEqual(len(call_kwargs["photos"]), 2)
        self.assertEqual(call_kwargs["photos"][0].name, "reply-1.jpg")
        self.assertEqual(call_kwargs["photos"][1].name, "reply-2.jpg")

    def test_create_reply_rejects_more_than_three_photos(self):
        photos = [self.create_test_image(f"reply-{i}.jpg") for i in range(4)]

        response = self.client.post(
            self.url,
            {"text": "Too many photos.", "photos": photos},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photos", response.data["errors"])
        self.assertFalse(ReviewReply.objects.filter(REVW_ID=self.review).exists())

# new test class in the reply views test file
class ReviewReplyDetailViewTests(SafeReviewModerationMixin, APITestCase):
    """Tests for the review reply update/delete endpoint."""

    def setUp(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        self.merchant = User.objects.create_user(
            email="merchant-reply-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.other_merchant = User.objects.create_user(
            email="other-merchant-reply-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-reply-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(self.merchant)

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_DESCRIPTION="A Cebu-based local restaurant.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.review = create_and_moderate_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Great food.",
        )

        self.reply = ReviewReplyService.create_reply(
            user=self.merchant,
            review_id=self.review.REVW_ID,
            text="Original reply.",
        )

        self.detail_url = f"/api/reviews/replies/{self.reply.RPLY_ID}/"

    def test_update_reply_returns_200_not_500(self):
        """Regression test mirroring the review-update bug: confirms the
        object returned by update_reply serializes cleanly through
        ReviewReplyResponseSerializer with no missing-field crash."""

        response = self.client.patch(
            self.detail_url,
            {"text": "Updated reply text."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

    def test_update_reply_response_contains_expected_fields(self):
        response = self.client.patch(
            self.detail_url,
            {"text": "Updated reply text."},
            format="multipart",
        )

        data = response.data["data"]

        self.assertEqual(data["text"], "Updated reply text.")
        self.assertIn("id", data)
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)
        self.assertIn("photos", data)

    def test_stale_reply_edit_uses_existing_conflict_envelope(self):
        with patch.object(
            ReviewReplyService,
            "update_reply",
            side_effect=ReviewReplyEditConflict(),
        ):
            response = self.client.patch(
                self.detail_url,
                {"text": "Stale proposed reply."},
                format="multipart",
            )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data, {
            "success": False,
            "message": "This reply changed while you were editing. Reload it and try again.",
            "code": "REVIEW_REPLY_EDIT_CONFLICT",
        })
        self.reply.refresh_from_db()
        self.assertEqual(self.reply.RPLY_TEXT, "Original reply.")

    def test_update_reply_rejects_non_owner_merchant(self):
        self.client.force_authenticate(self.other_merchant)

        response = self.client.patch(
            self.detail_url,
            {"text": "Should not be allowed."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.reply.refresh_from_db()
        self.assertEqual(self.reply.RPLY_TEXT, "Original reply.")

    def test_delete_reply_removes_reply(self):
        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ReviewReply.objects.filter(RPLY_ID=self.reply.RPLY_ID).exists(),
        )

    def test_delete_reply_rejects_non_owner_merchant(self):
        self.client.force_authenticate(self.other_merchant)

        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            ReviewReply.objects.filter(RPLY_ID=self.reply.RPLY_ID).exists(),
        )

    def _photo(
        self,
        name,
        reply=None,
    ):
        """Attach one stored asset to the selected reply."""
        return ReplyPhoto.objects.create(
            RPLY_ID=reply or self.reply,
            RPHO_PHOTO_URL=f"https://example.com/{name}.jpg",
            RPHO_PHOTO_PUBLIC_ID=f"reply/{name}",
        )

    def test_omitted_retention_preserves_photos(self):
        """Keep existing photos for older clients and text-only updates."""
        photo = self._photo("original")
        response = self.client.patch(
            self.detail_url,
            {"text": "Only the text changed."},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["data"]["photos"][0]["id"],
            photo.pk,
        )
        self.assertFalse(ReviewMediaCleanup.objects.exists())

    def test_multipart_empty_marker_removes_all_photos_after_success(self):
        """Persist an explicit empty retained set and register cleanup after commit."""
        self._photo("first")
        self._photo("second")
        with patch(
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
        ) as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.patch(
                    self.detail_url,
                    {"keep_photo_ids": "[]"},
                    format="multipart",
                )
                enqueue.assert_not_called()
            self.assertEqual(enqueue.call_count, 2)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["photos"], [])
        self.assertEqual(self.reply.photos.count(), 0)
        self.assertCountEqual(
            ReviewMediaCleanup.objects.values_list(
                "RMCU_PUBLIC_ID",
                flat=True,
            ),
            ["reply/first", "reply/second"],
        )

    def test_json_empty_retention_also_removes_all_photos(self):
        """Keep JSON's explicit empty list distinct from omission."""
        self._photo("original")
        response = self.client.patch(
            self.detail_url,
            {"keep_photo_ids": []},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["photos"], [])

    def test_partial_retention_keeps_only_selected_photos(self):
        """Preserve repeated multipart IDs and remove only unretained assets."""
        first = self._photo("first")
        second = self._photo("second")
        self._photo("removed")
        response = self.client.patch(
            self.detail_url,
            {
                "keep_photo_ids": [str(first.pk), str(second.pk)],
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(
            [
                photo["id"]
                for photo in response.data["data"]["photos"]
            ],
            [first.pk, second.pk],
        )
        self.assertEqual(
            ReviewMediaCleanup.objects.get().RMCU_PUBLIC_ID,
            "reply/removed",
        )

    @patch(
        "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
    )
    def test_replace_all_uses_final_collection_for_photo_limit(
        self,
        upload,
    ):
        """Replace a full gallery without counting removed assets against the limit."""
        for index in range(3):
            self._photo(f"old-{index}")
        upload.side_effect = [
            {
                "public_id": f"reply/new-{index}",
                "secure_url": f"https://example.com/new-{index}.jpg",
            }
            for index in range(3)
        ]
        response = self.client.patch(
            self.detail_url,
            {
                "keep_photo_ids": "[]",
                "photos": [
                    ReviewReplyViewTests.create_test_image(f"new-{index}.jpg")
                    for index in range(3)
                ],
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["photos"]), 3)
        self.assertCountEqual(
            self.reply.photos.values_list(
                "RPHO_PHOTO_PUBLIC_ID",
                flat=True,
            ),
            ["reply/new-0", "reply/new-1", "reply/new-2"],
        )
        self.assertEqual(ReviewMediaCleanup.objects.count(), 3)

    @patch(
        "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
    )
    def test_adding_without_retention_preserves_existing_photos(
        self,
        upload,
    ):
        """Omitted retention also preserves the old collection during additions."""
        photo = self._photo("original")
        upload.return_value = {
            "public_id": "reply/new",
            "secure_url": "https://example.com/new.jpg",
        }
        response = self.client.patch(
            self.detail_url,
            {"photos": [ReviewReplyViewTests.create_test_image()]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.reply.photos.count(), 2)
        self.assertTrue(self.reply.photos.filter(pk=photo.pk).exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())

    def test_invalid_retention_never_changes_any_reply_photos(self):
        """Reject foreign IDs and ambiguous empty markers before any removal."""
        original = self._photo("original")
        other_review = Review.objects.create(
            USER_ID=self.other_merchant,
            BUSN_ID=self.business,
            REVW_TEXT="Another published review.",
        )
        other_reply = ReviewReply.objects.create(
            REVW_ID=other_review,
            RPLY_TEXT="Another reply.",
        )
        foreign = self._photo(
            "foreign",
            reply=other_reply,
        )
        invalid_selections = (
            [str(foreign.pk)],
            ["999999"],
            ["[]", str(original.pk)],
            ["invalid"],
        )
        for ids in invalid_selections:
            with self.subTest(ids=ids):
                response = self.client.patch(
                    self.detail_url,
                    {"keep_photo_ids": ids},
                    format="multipart",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertTrue(
                    ReplyPhoto.objects.filter(pk=original.pk).exists(),
                )
                self.assertTrue(
                    ReplyPhoto.objects.filter(pk=foreign.pk).exists(),
                )
                self.assertFalse(ReviewMediaCleanup.objects.exists())

    @patch(
        "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
    )
    def test_photo_limit_rejection_preserves_existing_assets(
        self,
        upload,
    ):
        """Enforce the final retained-plus-uploaded limit before uploading."""
        for index in range(3):
            self._photo(f"original-{index}")
        response = self.client.patch(
            self.detail_url,
            {"photos": [ReviewReplyViewTests.create_test_image()]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.reply.photos.count(), 3)
        self.assertFalse(ReviewMediaCleanup.objects.exists())
        upload.assert_not_called()

    def test_remove_all_still_requires_reply_ownership(self):
        """An explicit empty collection never bypasses the existing owner check."""
        photo = self._photo("original")
        self.client.force_authenticate(self.other_merchant)
        response = self.client.patch(
            self.detail_url,
            {"keep_photo_ids": "[]"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(ReplyPhoto.objects.filter(pk=photo.pk).exists())
        self.assertFalse(ReviewMediaCleanup.objects.exists())
