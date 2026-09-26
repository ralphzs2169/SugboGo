from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import (
    BusinessReviewSummary,
    Review,
    ReviewPhoto,
    ReviewReply,
)
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_service import ReviewService
from apps.users.models import User


class ReviewViewTests(APITestCase):
    """Tests for business review API endpoints."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-review@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(
            self.explorer,
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

        self.preview_url = (
            f"/api/reviews/business/{self.business.BUSN_ID}/"
        )

        self.list_url = (
            f"/api/reviews/business/{self.business.BUSN_ID}/all/"
        )

    @staticmethod
    def create_test_image(
        filename="test-image.jpg",
        width=100,
        height=100,
    ):
        """Create a valid in-memory JPEG for upload tests."""

        image = Image.new(
            "RGB",
            (width, height),
        )

        image_file = BytesIO()

        image.save(
            image_file,
            format="JPEG",
        )

        image_file.seek(0)

        return SimpleUploadedFile(
            filename,
            image_file.read(),
            content_type="image/jpeg",
        )

    @staticmethod
    def create_large_test_image(
        filename="large-review.jpg",
    ):
        """Create a valid JPEG larger than 10 MB for upload validation."""

        image = Image.new(
            "RGB",
            (100, 100),
        )

        image_file = BytesIO()

        image.save(
            image_file,
            format="JPEG",
        )

        image_data = image_file.getvalue()

        image_data += b"\x00" * (
            10 * 1024 * 1024 + 1 - len(image_data)
        )

        return SimpleUploadedFile(
            filename,
            image_data,
            content_type="image/jpeg",
        )

    def test_create_review_successfully(self):
        payload = {
            "text": "Great food and excellent service.",
            "device_id": "test-device-001",
        }

        response = self.client.post(
            self.preview_url,
            payload,
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        review = Review.objects.get(
            REVW_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            review.USER_ID_id,
            self.explorer.USER_ID,
        )

        self.assertEqual(
            review.BUSN_ID_id,
            self.business.BUSN_ID,
        )

        self.assertEqual(
            review.REVW_TEXT,
            "Great food and excellent service.",
        )

        self.assertEqual(
            review.REVW_DEVICE_ID,
            "test-device-001",
        )

        self.assertEqual(
            response.data["message"],
            "Review added successfully.",
        )

        self.assertEqual(
            response.data["data"]["business_id"],
            self.business.BUSN_ID,
        )

    def test_create_response_succeeds_when_sentiment_broker_is_unavailable(self):
        with patch(
            "apps.reviews.tasks.process_review_sentiment.delay",
            side_effect=ConnectionError("broker unavailable"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.preview_url,
                    {"text": "Great food and excellent service."},
                    format="multipart",
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review = Review.objects.get(REVW_ID=response.data["data"]["id"])
        self.assertIsNone(review.REVW_SENTIMENT_SCORE)
        self.assertIsNone(review.REVW_SENTIMENT_LABEL)

    def test_get_review_preview_returns_maximum_three_reviews(self):
        for index in range(5):
            user = self.explorer

            if index > 0:
                user = User.objects.create_user(
                    email=f"reviewer-{index}@example.com",
                    password="StrongPassword123!",
                    USER_FNAME=f"Reviewer{index}",
                    USER_LNAME="User",
                    USER_ROLE=User.UserRole.EXPLORER,
                    USER_STATUS=User.UserStatus.ACTIVE,
                )

            Review.objects.create(
                USER_ID=user,
                BUSN_ID=self.business,
                REVW_TEXT=f"Review {index + 1}.",
            )

        response = self.client.get(
            self.preview_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review preview retrieved successfully.",
        )

        self.assertEqual(
            len(response.data["data"]["reviews"]),
            3,
        )

    def test_get_all_reviews_returns_all_business_reviews(self):
        reviews = []

        for index in range(4):
            user = self.explorer

            if index > 0:
                user = User.objects.create_user(
                    email=f"all-reviewer-{index}@example.com",
                    password="StrongPassword123!",
                    USER_FNAME=f"Reviewer{index}",
                    USER_LNAME="User",
                    USER_ROLE=User.UserRole.EXPLORER,
                    USER_STATUS=User.UserStatus.ACTIVE,
                )

            reviews.append(
                Review.objects.create(
                    USER_ID=user,
                    BUSN_ID=self.business,
                    REVW_TEXT=f"Review {index + 1}.",
                ),
            )

        response = self.client.get(
            self.list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Success.",
        )

        returned_reviews = response.data["data"]["items"]

        self.assertEqual(
            response.data["data"]["pagination"]["page_size"],
            10,
        )
        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            4,
        )

        self.assertEqual(
            len(returned_reviews),
            4,
        )

        returned_ids = {
            review["id"]
            for review in returned_reviews
        }

        expected_ids = {
            review.REVW_ID
            for review in reviews
        }

        self.assertEqual(
            returned_ids,
            expected_ids,
        )

    def test_review_list_paginates_after_ordering(self):
        """Return stable page boundaries through the standard list envelope."""
        reviews = [
            self._create_list_review(index)
            for index in range(1, 5)
        ]
        moment = timezone.now()

        for index, review in enumerate(reviews):
            Review.objects.filter(pk=review.pk).update(
                REVW_CREATED_AT=moment,
                REVW_LIKE_COUNT=index // 2,
            )

        newest_ids = [
            review.pk
            for review in reversed(reviews)
        ]
        oldest_ids = [
            review.pk
            for review in reviews
        ]

        for ordering, expected in (
            ("newest", newest_ids),
            ("oldest", oldest_ids),
            ("most_liked", newest_ids),
        ):
            with self.subTest(ordering=ordering):
                pages = []

                for page_number in (1, 2):
                    response = self.client.get(
                        self.list_url,
                        {
                            "page": page_number,
                            "page_size": 2,
                            "ordering": ordering,
                        },
                    )
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                    payload = response.data["data"]
                    self.assertEqual(
                        payload["pagination"]["total_items"],
                        4,
                    )
                    self.assertEqual(
                        payload["pagination"]["total_pages"],
                        2,
                    )
                    self.assertEqual(
                        payload["pagination"]["has_next"],
                        page_number == 1,
                    )
                    pages.extend(item["id"] for item in payload["items"])

                self.assertEqual(pages, expected)

    def test_combined_filters_are_applied_before_pagination(self):
        """Paginate the eligible intersection rather than filtering a page."""
        first = self._create_list_review(1, REVW_SENTIMENT_LABEL="negative")
        second = self._create_list_review(2, REVW_SENTIMENT_LABEL="negative")
        excluded = self._create_list_review(3, REVW_SENTIMENT_LABEL="positive")

        for review in (first, second, excluded):
            ReviewPhoto.objects.create(
                REVW_ID=review,
                RPHO_PHOTO_URL=f"https://example.com/{review.pk}.jpg",
                RPHO_PHOTO_PUBLIC_ID=str(review.pk),
            )
            ReviewReply.objects.create(
                REVW_ID=review,
                RPLY_TEXT="Thank you!",
            )

        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_KEYWORD_TAGS=[{
                "text": "Slow service",
                "count": 3,
                "review_ids": [first.pk, second.pk, excluded.pk],
            }],
        )

        params = {
            "sentiment": "negative",
            "topic": "Slow service",
            "has_photos": "true",
            "merchant_replied": "true",
            "ordering": "oldest",
            "page_size": 1,
        }
        first_page = self.client.get(self.list_url, {**params, "page": 1})
        second_page = self.client.get(self.list_url, {**params, "page": 2})

        self.assertEqual(first_page.data["data"]["pagination"]["total_items"], 2)
        self.assertEqual(second_page.data["data"]["pagination"]["total_items"], 2)
        self.assertEqual(first_page.data["data"]["items"][0]["id"], first.pk)
        self.assertEqual(second_page.data["data"]["items"][0]["id"], second.pk)

    def test_preview_includes_user_review_outside_bounded_preview(self):
        """Expose ownership without scanning paginated review results."""
        own_review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="My older review.",
        )
        for index in range(1, 5):
            self._create_list_review(index)

        response = self.client.get(self.preview_url)
        data = response.data["data"]

        self.assertEqual(len(data["reviews"]), 3)
        self.assertNotIn(own_review.pk, [item["id"] for item in data["reviews"]])
        self.assertEqual(data["user_review"]["id"], own_review.pk)
        self.assertTrue(data["user_review"]["is_own_review"])

        filtered = self.client.get(
            self.list_url,
            {"sentiment": "negative", "page_size": 1},
        )
        self.assertEqual(filtered.data["data"]["items"], [])
        self.assertEqual(
            self.client.get(self.preview_url).data["data"]["user_review"]["id"],
            own_review.pk,
        )

        Review.objects.filter(pk=own_review.pk).update(
            REVW_STATUS=Review.ReviewStatus.FLAGGED,
        )
        self.assertEqual(
            self.client.get(self.preview_url).data["data"]["user_review"]["id"],
            own_review.pk,
        )

        self.client.force_authenticate(self.merchant)
        self.assertIsNone(
            self.client.get(self.preview_url).data["data"]["user_review"],
        )

    def _create_list_review(self, index, **fields):
        """Creates an independent review author for list-filter tests."""
        author = User.objects.create_user(
            email=f"filtered-reviewer-{index}@example.com",
            password="StrongPassword123!",
            USER_FNAME=f"Reviewer{index}",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return Review.objects.create(
            USER_ID=author,
            BUSN_ID=self.business,
            REVW_TEXT=f"Review wording {index}.",
            **fields,
        )

    def _list_ids(self, **params):
        """Returns review IDs from the existing list response envelope."""
        response = self.client.get(self.list_url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return [
            item["id"]
            for item in response.data["data"]["items"]
        ]

    def test_sentiment_filters_use_stored_labels_and_leave_null_unfiltered(self):
        positive = self._create_list_review(1, REVW_SENTIMENT_LABEL="positive")
        neutral = self._create_list_review(2, REVW_SENTIMENT_LABEL="neutral")
        negative = self._create_list_review(3, REVW_SENTIMENT_LABEL="negative")
        pending = self._create_list_review(4)

        self.assertEqual(self._list_ids(sentiment="positive"), [positive.pk])
        self.assertEqual(self._list_ids(sentiment="neutral"), [neutral.pk])
        self.assertEqual(self._list_ids(sentiment="negative"), [negative.pk])
        self.assertEqual(
            set(self._list_ids()),
            {positive.pk, neutral.pk, negative.pk, pending.pk},
        )

    def test_invalid_sentiment_and_ordering_use_validation_envelope(self):
        for params, field in (
            ({"sentiment": "mixed"}, "sentiment"),
            ({"ordering": "most_relevant"}, "ordering"),
        ):
            with self.subTest(params=params):
                response = self.client.get(self.list_url, params)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertIn(field, response.data["errors"])

    def test_has_photos_filters_without_duplicate_reviews(self):
        with_photos = self._create_list_review(1)
        self._create_list_review(2)
        for index in range(2):
            ReviewPhoto.objects.create(
                REVW_ID=with_photos,
                RPHO_PHOTO_URL=f"https://example.com/review-{index}.jpg",
                RPHO_PHOTO_PUBLIC_ID=f"review-{index}",
            )

        self.assertEqual(self._list_ids(has_photos="true"), [with_photos.pk])

    def test_merchant_replied_filter_preserves_reply_serialization(self):
        replied = self._create_list_review(1)
        self._create_list_review(2)
        ReviewReply.objects.create(REVW_ID=replied, RPLY_TEXT="Thank you!")

        response = self.client.get(self.list_url, {"merchant_replied": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]["items"]), 1)
        self.assertEqual(response.data["data"]["items"][0]["id"], replied.pk)
        self.assertEqual(
            response.data["data"]["items"][0]["reply"]["text"],
            "Thank you!",
        )

    def test_ordering_is_deterministic_for_dates_and_likes(self):
        oldest = self._create_list_review(1, REVW_LIKE_COUNT=5)
        newest = self._create_list_review(2, REVW_LIKE_COUNT=2)
        tied = self._create_list_review(3, REVW_LIKE_COUNT=5)
        moment = timezone.now()
        Review.objects.filter(pk=oldest.pk).update(REVW_CREATED_AT=moment)
        Review.objects.filter(pk=tied.pk).update(REVW_CREATED_AT=moment)
        Review.objects.filter(pk=newest.pk).update(
            REVW_CREATED_AT=moment + timedelta(minutes=1),
        )

        self.assertEqual(
            self._list_ids(ordering="newest"),
            [newest.pk, tied.pk, oldest.pk],
        )
        self.assertEqual(
            self._list_ids(ordering="oldest"),
            [oldest.pk, tied.pk, newest.pk],
        )
        self.assertEqual(
            self._list_ids(ordering="most_liked"),
            [tied.pk, oldest.pk, newest.pk],
        )

    def test_topic_uses_evidence_not_literal_review_text(self):
        first = self._create_list_review(1)
        second = self._create_list_review(2)
        self._create_list_review(3)
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_KEYWORD_TAGS=[{
                "text": "Friendly service",
                "count": 2,
                "review_ids": [first.pk, second.pk],
            }],
        )

        self.assertEqual(
            set(self._list_ids(topic="  FRIENDLY   service  ")),
            {first.pk, second.pk},
        )
        self.assertEqual(self._list_ids(topic="Unknown topic"), [])

    def test_legacy_topic_without_evidence_returns_empty_list(self):
        self._create_list_review(1)
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_KEYWORD_TAGS=[{"text": "Friendly service", "count": 2}],
        )

        self.assertEqual(self._list_ids(topic="Friendly service"), [])

    def test_topic_intersects_stale_ids_with_current_eligibility(self):
        visible = self._create_list_review(1)
        hidden = self._create_list_review(
            2,
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        spam = self._create_list_review(3, REVW_IS_SPAM_FLAGGED=True)
        device_abuse = self._create_list_review(
            4,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
        )
        deleted = self._create_list_review(5)
        deleted_id = deleted.pk
        deleted.delete()
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_KEYWORD_TAGS=[{
                "text": "Friendly service",
                "count": 5,
                "review_ids": [
                    visible.pk,
                    hidden.pk,
                    spam.pk,
                    device_abuse.pk,
                    deleted_id,
                ],
            }],
        )

        self.assertEqual(self._list_ids(topic="Friendly service"), [visible.pk])
        Review.objects.filter(pk=visible.pk).update(
            REVW_STATUS=Review.ReviewStatus.FLAGGED,
        )
        self.assertEqual(self._list_ids(topic="Friendly service"), [])

    def test_filters_compose_with_ordering(self):
        negative = self._create_list_review(
            1,
            REVW_SENTIMENT_LABEL="negative",
            REVW_LIKE_COUNT=2,
        )
        positive = self._create_list_review(
            2,
            REVW_SENTIMENT_LABEL="positive",
            REVW_LIKE_COUNT=10,
        )
        ReviewPhoto.objects.create(
            REVW_ID=negative,
            RPHO_PHOTO_URL="https://example.com/negative.jpg",
            RPHO_PHOTO_PUBLIC_ID="negative",
        )
        ReviewReply.objects.create(REVW_ID=negative, RPLY_TEXT="Thank you!")
        BusinessReviewSummary.objects.create(
            BUSN_ID=self.business,
            BRSU_KEYWORD_TAGS=[{
                "text": "Friendly service",
                "count": 2,
                "review_ids": [negative.pk, positive.pk],
            }],
        )

        self.assertEqual(
            self._list_ids(sentiment="negative", ordering="newest"),
            [negative.pk],
        )
        self.assertEqual(
            self._list_ids(has_photos="true", ordering="most_liked"),
            [negative.pk],
        )
        self.assertEqual(
            self._list_ids(merchant_replied="true", ordering="newest"),
            [negative.pk],
        )
        self.assertEqual(
            self._list_ids(topic="Friendly service", ordering="oldest"),
            [negative.pk, positive.pk],
        )
        self.assertEqual(
            self._list_ids(
                topic="Friendly service",
                sentiment="negative",
                has_photos="true",
                merchant_replied="true",
            ),
            [negative.pk],
        )

    def test_get_all_reviews_exposes_pending_dispute_id_for_merchant(self):
        review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="A review with a pending merchant dispute.",
        )

        dispute = MerchantReviewDispute.objects.create(
            REVW_ID=review,
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            MRDSP_REASON=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            MRDSP_DESCRIPTION="This review appears to be fabricated.",
        )

        self.client.force_authenticate(
            self.merchant,
        )

        response = self.client.get(
            self.list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_review = next(
            item
            for item in response.data["data"]["items"]
            if item["id"] == review.REVW_ID
        )

        self.assertEqual(
            returned_review["active_dispute_id"],
            dispute.MRDSP_ID,
        )

    def test_get_all_reviews_returns_null_for_resolved_dispute(self):
        review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="A review with a resolved merchant dispute.",
        )

        MerchantReviewDispute.objects.create(
            REVW_ID=review,
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER,
            MRDSP_DESCRIPTION="This dispute was already dismissed.",
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        self.client.force_authenticate(
            self.merchant,
        )

        response = self.client.get(
            self.list_url,
        )

        returned_review = next(
            item
            for item in response.data["data"]["items"]
            if item["id"] == review.REVW_ID
        )

        self.assertIsNone(
            returned_review["active_dispute_id"],
        )

    def test_get_all_reviews_hides_active_dispute_id_from_explorer(self):
        review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="A disputed review viewed by an explorer.",
        )

        MerchantReviewDispute.objects.create(
            REVW_ID=review,
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            MRDSP_REASON=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            MRDSP_DESCRIPTION="This review appears to be fabricated.",
        )

        response = self.client.get(
            self.list_url,
        )

        returned_review = next(
            item
            for item in response.data["data"]["items"]
            if item["id"] == review.REVW_ID
        )

        self.assertIsNone(
            returned_review["active_dispute_id"],
        )

    @patch(
        "apps.reviews.views.review_views.ReviewService.create_review",
    )
    def test_create_review_with_photos(
        self,
        mock_create_review,
    ):
        first_photo = self.create_test_image(
            "review-1.jpg",
        )

        second_photo = self.create_test_image(
            "review-2.jpg",
        )

        mock_review = Review(
            REVW_ID=1,
            BUSN_ID=self.business,
            USER_ID=self.explorer,
        )

        mock_create_review.return_value = mock_review

        response = self.client.post(
            self.preview_url,
            {
                "text": "Great food and excellent service.",
                "photos": [
                    first_photo,
                    second_photo,
                ],
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        mock_create_review.assert_called_once()

        call_kwargs = mock_create_review.call_args.kwargs

        self.assertEqual(
            call_kwargs["user"],
            self.explorer,
        )

        self.assertEqual(
            call_kwargs["business_id"],
            self.business.BUSN_ID,
        )

        self.assertEqual(
            call_kwargs["text"],
            "Great food and excellent service.",
        )

        self.assertEqual(
            len(call_kwargs["photos"]),
            2,
        )

        self.assertEqual(
            call_kwargs["photos"][0].name,
            "review-1.jpg",
        )

        self.assertEqual(
            call_kwargs["photos"][1].name,
            "review-2.jpg",
        )

        self.assertEqual(
            call_kwargs["photos"][0].content_type,
            "image/jpeg",
        )

        self.assertEqual(
            call_kwargs["photos"][1].content_type,
            "image/jpeg",
        )

    def test_create_review_rejects_more_than_three_photos(self):
        photos = [
            self.create_test_image(
                f"review-{index}.jpg",
            )
            for index in range(4)
        ]

        response = self.client.post(
            self.preview_url,
            {
                "text": "Too many photos.",
                "photos": photos,
            },
            format="multipart",
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
            "photos",
            response.data["errors"],
        )

        self.assertFalse(
            Review.objects.exists(),
        )

    def test_create_review_rejects_photo_over_10_mb(self):
        oversized_photo = self.create_large_test_image()

        self.assertGreater(
            oversized_photo.size,
            10 * 1024 * 1024,
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Large photo.",
                "photos": [oversized_photo],
            },
            format="multipart",
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
            "photos",
            response.data["errors"],
        )

        self.assertFalse(
            Review.objects.exists(),
        )

    def test_create_review_rejects_invalid_photo_format(self):
        invalid_photo = SimpleUploadedFile(
            "review.txt",
            b"not an image",
            content_type="text/plain",
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Invalid photo.",
                "photos": [invalid_photo],
            },
            format="multipart",
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
            "photos",
            response.data["errors"],
        )

        self.assertFalse(
            Review.objects.exists(),
        )

    def test_create_review_rejects_duplicate_review(self):
        ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="First review.",
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Second review with enough detail.",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            response.data["message"],
            "You have already reviewed this business.",
        )

        self.assertEqual(
            Review.objects.filter(
                USER_ID=self.explorer,
                BUSN_ID=self.business,
            ).count(),
            1,
        )

    def test_create_review_rejects_missing_text(self):
        response = self.client.post(
            self.preview_url,
            {},
            format="multipart",
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

    def test_create_review_rejects_text_over_1000_characters(self):
        response = self.client.post(
            self.preview_url,
            {
                "text": "a" * 1001,
            },
            format="multipart",
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

    def test_create_review_rejects_invalid_business(self):
        response = self.client.post(
            "/api/reviews/business/999999/",
            {
                "text": "Great food and excellent service.",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertEqual(
            response.data["message"],
            "The business could not be found.",
        )

    def test_create_review_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.preview_url,
            {
                "text": "Great food.",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            Review.objects.exists(),
        )


class ReviewDetailViewTests(APITestCase):
    """Tests for the review update/delete endpoint."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.other_explorer = User.objects.create_user(
            email="other-explorer-detail@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(self.explorer)

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

        self.review = ReviewService.create_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        self.detail_url = f"/api/reviews/{self.review.REVW_ID}/"

    def test_update_review_returns_200_not_500(self):
        """Regression test for the bug where PATCH threw an unhandled
        AttributeError because the object returned by update_review was
        missing is_own_review and vouched_specialties, which
        ReviewResponseSerializer requires."""

        response = self.client.patch(
            self.detail_url,
            {"text": "Updated review text."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

    def test_update_review_response_contains_all_required_fields(self):
        response = self.client.patch(
            self.detail_url,
            {"text": "Updated review text."},
            format="multipart",
        )

        data = response.data["data"]

        self.assertEqual(data["text"], "Updated review text.")
        self.assertIn("is_own_review", data)
        self.assertIn("is_liked", data)
        self.assertIn("vouched_specialties", data)
        self.assertTrue(data["is_own_review"])

    def test_update_review_persists_change(self):
        self.client.patch(
            self.detail_url,
            {"text": "Persisted update."},
            format="multipart",
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_TEXT,
            "Persisted update.",
        )

    def test_update_review_rejects_non_owner(self):
        self.client.force_authenticate(self.other_explorer)

        response = self.client.patch(
            self.detail_url,
            {"text": "Should not be allowed."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_TEXT,
            "Original review.",
        )

    def test_update_review_rejects_nonexistent_review(self):
        response = self.client.patch(
            "/api/reviews/999999/",
            {"text": "Ghost review."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_delete_review_removes_review(self):
        Review.objects.filter(
            REVW_ID=self.review.REVW_ID,
        ).update(
            REVW_SENTIMENT_SCORE=0.8,
            REVW_SENTIMENT_LABEL="positive",
        )
        BusinessReviewSummaryService.recompute_sentiment(
            self.business.BUSN_ID,
        )

        response = self.client.delete(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertFalse(
            Review.objects.filter(REVW_ID=self.review.REVW_ID).exists(),
        )

        summary = BusinessReviewSummary.objects.get(
            BUSN_ID=self.business,
        )
        self.assertEqual(summary.BRSU_REVIEW_COUNT, 0)
        self.assertEqual(summary.BRSU_CLASSIFIED_REVIEW_COUNT, 0)
        self.assertEqual(summary.BRSU_POSITIVE_COUNT, 0)

    def test_delete_review_rejects_non_owner(self):
        self.client.force_authenticate(self.other_explorer)

        response = self.client.delete(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertTrue(
            Review.objects.filter(REVW_ID=self.review.REVW_ID).exists(),
        )

    def test_update_review_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.detail_url,
            {"text": "Unauthorized."},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
