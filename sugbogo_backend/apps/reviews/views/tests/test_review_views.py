from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import (
    BusinessReviewSummary,
    Review,
    ReviewMediaCleanup,
    ReviewPhoto,
    ReviewReply,
)
from apps.reviews.services.business_review_summary_service import (
    BusinessReviewSummaryService,
)
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.review_moderation_retry_service import ReviewModerationRetryService
from apps.reviews.services.tests.review_moderation_test_mixin import (
    create_and_moderate_review,
)
from apps.users.models import User


class ReviewViewTests(APITestCase):
    """Tests for business review API endpoints."""

    def setUp(self):
        moderation_patcher = patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={
                "outcome": "safe",
                "model": "omni-moderation-latest",
                "checked_at": "2026-10-11T00:00:00+00:00",
                "failure_type": None,
                "image_count": 0,
                "findings": [],
            },
        )
        self.moderate_review = moderation_patcher.start()
        self.addCleanup(moderation_patcher.stop)
        dispatch_patcher = patch("apps.reviews.tasks.retry_failed_review_moderation.delay")
        dispatch_patcher.start()
        self.addCleanup(dispatch_patcher.stop)

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
            "installation_id": "test-device-001",
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

        self.assertTrue(review.REVW_SHOW_IN_COMMUNITY)

        self.assertEqual(
            review.BUSN_ID_id,
            self.business.BUSN_ID,
        )

        self.assertEqual(
            review.REVW_TEXT,
            "Great food and excellent service.",
        )

        self.assertEqual(
            review.REVW_INSTALLATION_ID,
            "test-device-001",
        )

        self.assertEqual(
            response.data["message"],
            "Review submitted and is under review.",
        )

        self.assertEqual(
            response.data["data"]["business_id"],
            self.business.BUSN_ID,
        )
        self.assertEqual(response.data["data"]["status"], "under_review")
        self.moderate_review.assert_not_called()
        self.assertNotIn("report_count", response.data["data"])
        self.assertNotIn("is_report_flagged", response.data["data"])
        self.assertNotIn("reliability_reasons", response.data["data"])
        self.assertNotIn("reliability_check_outcome", response.data["data"])
        self.assertNotIn("installation_id", response.data["data"])
        self.assertNotIn("is_device_abuse_flagged", response.data["data"])

    def test_legacy_device_id_is_accepted_as_installation_id(self):
        """Older app versions can still submit the previous request key."""
        response = self.client.post(
            self.preview_url,
            {
                "text": "A detailed review from an older app version.",
                "device_id": "legacy-installation",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review = Review.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(review.REVW_INSTALLATION_ID, "legacy-installation")

    def test_conflicting_installation_identifiers_are_rejected(self):
        """A request cannot silently choose between two different IDs."""
        response = self.client.post(
            self.preview_url,
            {
                "text": "A detailed review with conflicting IDs.",
                "installation_id": "new-installation",
                "device_id": "legacy-installation",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Review.objects.filter(USER_ID=self.explorer).exists())

    def test_unchecked_submission_returns_successful_under_review_status(self):
        """The API acknowledges private content without calling the provider."""
        self.moderate_review.return_value["outcome"] = "flagged"
        response = self.client.post(
            self.preview_url,
            {"text": "A review being checked before publication."},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["status"], "under_review")
        self.assertNotIn("moderation", response.data["data"])
        review = Review.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.UNDER_REVIEW)
        preview = self.client.get(self.preview_url).data["data"]
        self.assertEqual(preview["user_review"]["id"], review.pk)
        self.assertEqual(preview["reviews"], [])
        self.assertEqual(preview["total_count"], 0)
        self.moderate_review.assert_not_called()

    def test_create_review_can_opt_out_without_hiding_business_review(self):
        response = self.client.post(
            self.preview_url,
            {
                "text": "Great food and excellent service.",
                "show_in_community": "false",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review = Review.objects.get(pk=response.data["data"]["id"])
        self.assertFalse(review.REVW_SHOW_IN_COMMUNITY)
        preview = self.client.get(self.preview_url).data["data"]
        self.assertEqual(preview["user_review"]["id"], review.pk)
        self.assertFalse(preview["user_review"]["show_in_community"])
        self.assertEqual(preview["reviews"], [])
        self.assertEqual(ReviewModerationRetryService.retry(review.pk), "published")
        preview = self.client.get(self.preview_url).data["data"]
        self.assertIn(review.pk, [item["id"] for item in preview["reviews"]])
        self.client.force_authenticate(self.merchant)
        public_review = self.client.get(self.preview_url).data["data"]["reviews"][0]
        self.assertNotIn("show_in_community", public_review)

    def test_create_review_rejects_invalid_community_boolean(self):
        response = self.client.post(
            self.preview_url,
            {
                "text": "Great food and excellent service.",
                "show_in_community": "sometimes",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Review.objects.filter(USER_ID=self.explorer).exists())

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

    def test_get_review_preview_returns_maximum_two_reviews(self):
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
            2,
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

    def test_review_cards_hide_inactive_vouched_specialties(self):
        Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="Great food and service.",
        )
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Former Specialty",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=tag,
            BST_IS_ACTIVE=False,
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.explorer,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=self.explorer.USER_REPUTATION,
        )

        list_response = self.client.get(self.list_url)
        preview_response = self.client.get(self.preview_url)

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            list_response.data["data"]["items"][0]["vouched_specialties"],
            [],
        )
        self.assertEqual(
            preview_response.data["data"]["reviews"][0]["vouched_specialties"],
            [],
        )
        self.assertTrue(BusinessVouch.objects.exists())

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

        self.assertEqual(len(data["reviews"]), 2)
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

    def test_under_review_is_author_only_and_excluded_from_public_lists(self):
        """The preview exposes a held review solely in its author field."""
        held = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="A held review from this explorer.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        published = self._create_list_review(51)
        self._create_list_review(
            52,
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        preview = self.client.get(self.preview_url).data["data"]
        self.assertEqual(preview["user_review"]["id"], held.pk)
        self.assertEqual(preview["user_review"]["status"], "under_review")
        self.assertEqual([item["id"] for item in preview["reviews"]], [published.pk])
        self.assertEqual(preview["total_count"], 1)
        self.assertEqual(self._list_ids(), [published.pk])
        self.assertEqual(
            ReviewService.get_review_detail(held.pk, self.explorer).pk,
            held.pk,
        )

        self.client.force_authenticate(self.merchant)
        other_preview = self.client.get(self.preview_url).data["data"]
        self.assertIsNone(other_preview["user_review"])
        self.assertEqual(
            [item["id"] for item in other_preview["reviews"]],
            [published.pk],
        )
        with self.assertRaises(NotFound):
            ReviewService.get_review_detail(held.pk, self.merchant)

    def test_under_review_edit_rejected_and_delete_allowed(self):
        """The API blocks held content changes and accepts author withdrawal."""
        held = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="A held review from this explorer.",
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        detail_url = f"/api/reviews/{held.pk}/"
        update = self.client.patch(
            detail_url,
            {"text": "Changed review text after moderation started."},
            format="multipart",
        )
        self.assertEqual(update.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(update.data["code"], "VALIDATION_ERROR")
        held.refresh_from_db()
        self.assertEqual(held.REVW_TEXT, "A held review from this explorer.")

        deleted = self.client.delete(detail_url)
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertFalse(Review.objects.filter(pk=held.pk).exists())

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
        reported = self._create_list_review(3, REVW_IS_REPORT_FLAGGED=True)
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
                    reported.pk,
                    device_abuse.pk,
                    deleted_id,
                ],
            }],
        )

        self.assertEqual(
            self._list_ids(topic="Friendly service"),
            [device_abuse.pk, reported.pk, visible.pk],
        )
        Review.objects.filter(pk=visible.pk).update(
            REVW_STATUS=Review.ReviewStatus.FLAGGED,
        )
        self.assertEqual(
            self._list_ids(topic="Friendly service"),
            [device_abuse.pk, reported.pk],
        )

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
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
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
        create_and_moderate_review(
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
        cleanup_patcher = patch(
            "apps.reviews.tasks.cleanup_review_media_asset.apply_async",
        )
        self.cleanup_enqueue = cleanup_patcher.start()
        self.addCleanup(cleanup_patcher.stop)

        moderation_patcher = patch(
            "apps.reviews.services.review_service.ReviewModerationService.moderate",
            return_value={
                "outcome": "safe",
                "model": "omni-moderation-latest",
                "checked_at": "2026-10-11T00:00:00+00:00",
                "failure_type": None,
                "image_count": 0,
                "findings": [],
            },
        )
        self.moderate_review = moderation_patcher.start()
        self.addCleanup(moderation_patcher.stop)

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

        self.review = create_and_moderate_review(
            user=self.explorer,
            business_id=self.business.BUSN_ID,
            text="Original review.",
        )

        self.detail_url = f"/api/reviews/{self.review.REVW_ID}/"

    def _add_existing_photos(
        self,
        count,
    ):
        """Attach accepted photo records for multipart retention regressions."""
        photos = []
        for index in range(count):
            photos.append(
                ReviewPhoto.objects.create(
                    REVW_ID=self.review,
                    RPHO_PHOTO_URL=f"https://example.com/existing-{index}.jpg",
                    RPHO_PHOTO_PUBLIC_ID=f"existing-{index}",
                ),
            )
        return photos

    @patch("apps.reviews.services.review_service.CloudinaryService.delete_image")
    def test_empty_multipart_retention_removes_final_or_all_photos(
        self,
        delete_image,
    ):
        for count in (1, 3):
            with self.subTest(count=count):
                photos = self._add_existing_photos(count)
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.patch(
                        self.detail_url,
                        {"keep_photo_ids": "[]"},
                        format="multipart",
                    )
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["data"]["photos"], [])
                self.assertFalse(self.review.photos.exists())
                for photo in photos:
                    self.assertTrue(
                        ReviewMediaCleanup.objects.filter(
                            RMCU_REVIEW_ID=self.review.pk,
                            RMCU_PUBLIC_ID=photo.RPHO_PHOTO_PUBLIC_ID,
                            RMCU_RESOURCE_TYPE="image",
                        ).exists(),
                    )
                delete_image.assert_not_called()

    @patch("apps.reviews.services.review_service.CloudinaryService.delete_image")
    @patch("apps.reviews.services.review_service.CloudinaryService.upload_image")
    def test_empty_retention_with_upload_replaces_existing_photos(
        self,
        upload_image,
        delete_image,
    ):
        originals = self._add_existing_photos(3)
        upload_image.return_value = {
            "secure_url": "https://example.com/replacement.jpg",
            "public_id": "replacement",
        }
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.detail_url,
                {
                    "keep_photo_ids": "[]",
                    "photos": [ReviewViewTests.create_test_image()],
                },
                format="multipart",
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [photo["photo_url"] for photo in response.data["data"]["photos"]],
            [upload_image.return_value["secure_url"]],
        )
        self.assertFalse(
            self.review.photos.filter(
                pk__in=[photo.pk for photo in originals],
            ).exists(),
        )
        delete_image.assert_not_called()
        self.assertEqual(
            ReviewMediaCleanup.objects.filter(
                RMCU_REVIEW_ID=self.review.pk,
            ).count(),
            3,
        )
        self.assertEqual(self.cleanup_enqueue.call_count, 3)
        self.assertEqual(self.moderate_review.call_args.kwargs["image_urls"], [])
        self.assertEqual(len(self.moderate_review.call_args.kwargs["photos"]), 1)

    def test_omitted_retention_preserves_existing_photos(self):
        photos = self._add_existing_photos(2)
        response = self.client.patch(
            self.detail_url,
            {"text": "An updated review preserving the accepted photos."},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            {photo["id"] for photo in response.data["data"]["photos"]},
            {photo.pk for photo in photos},
        )

    @patch("apps.reviews.services.review_service.CloudinaryService.delete_image")
    def test_repeated_integer_retention_keeps_only_selected_photos(
        self,
        delete_image,
    ):
        photos = self._add_existing_photos(3)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.detail_url,
                {"keep_photo_ids": [str(photos[0].pk), str(photos[2].pk)]},
                format="multipart",
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            {photo["id"] for photo in response.data["data"]["photos"]},
            {photos[0].pk, photos[2].pk},
        )
        delete_image.assert_not_called()
        cleanup = ReviewMediaCleanup.objects.get(
            RMCU_PUBLIC_ID=photos[1].RPHO_PHOTO_PUBLIC_ID,
        )
        self.cleanup_enqueue.assert_called_once_with(
            args=[cleanup.pk],
            retry=False,
        )

    def test_invalid_or_mixed_retention_values_remain_rejected(self):
        photos = self._add_existing_photos(1)
        for value in ("", "not-an-id", "0", "999999", ["[]", str(photos[0].pk)]):
            with self.subTest(value=value):
                response = self.client.patch(
                    self.detail_url,
                    {"keep_photo_ids": value},
                    format="multipart",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertEqual(self.review.photos.count(), 1)

    @patch("apps.reviews.services.review_service.CloudinaryService.upload_image")
    def test_replacement_photo_limit_and_file_validation_remain_enforced(
        self,
        upload_image,
    ):
        self._add_existing_photos(3)
        cases = (
            [ReviewViewTests.create_test_image() for _ in range(4)],
            [ReviewViewTests.create_large_test_image()],
            [SimpleUploadedFile("invalid.jpg", b"invalid", "image/jpeg")],
        )
        for photos in cases:
            with self.subTest(photo_count=len(photos)):
                response = self.client.patch(
                    self.detail_url,
                    {"keep_photo_ids": "[]", "photos": photos},
                    format="multipart",
                )
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertEqual(self.review.photos.count(), 3)
        upload_image.assert_not_called()

    @patch("apps.reviews.services.review_service.CloudinaryService.upload_image")
    def test_failed_replacement_moderation_preserves_text_and_photos(
        self,
        upload_image,
    ):
        originals = self._add_existing_photos(2)
        cases = (
            ("flagged", 400, "REVIEW_EDIT_CONTENT_FLAGGED"),
            ("provider_failure", 503, "REVIEW_EDIT_MODERATION_UNAVAILABLE"),
        )
        for outcome, status_code, code in cases:
            with self.subTest(outcome=outcome):
                self.moderate_review.return_value["outcome"] = outcome
                response = self.client.patch(
                    self.detail_url,
                    {
                        "text": "A proposed replacement review with enough detail.",
                        "keep_photo_ids": "[]",
                        "photos": [ReviewViewTests.create_test_image()],
                    },
                    format="multipart",
                )
                self.assertEqual(response.status_code, status_code)
                self.assertEqual(response.data["code"], code)
                self.review.refresh_from_db()
                self.assertEqual(self.review.REVW_TEXT, "Original review.")
                self.assertEqual(
                    set(self.review.photos.values_list("pk", flat=True)),
                    {photo.pk for photo in originals},
                )
        upload_image.assert_not_called()

    @patch("apps.reviews.services.review_service.CloudinaryService.delete_image")
    def test_explicit_removal_still_requires_review_ownership(
        self,
        delete_image,
    ):
        self._add_existing_photos(1)
        self.client.force_authenticate(self.other_explorer)
        response = self.client.patch(
            self.detail_url,
            {"keep_photo_ids": "[]"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.review.photos.count(), 1)
        delete_image.assert_not_called()

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

    def test_flagged_edit_returns_stable_code_without_changing_review(self):
        self.moderate_review.return_value["outcome"] = "flagged"

        response = self.client.patch(
            self.detail_url,
            {"text": "Proposed unsafe update."},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "REVIEW_EDIT_CONTENT_FLAGGED")
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_TEXT, "Original review.")
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)

    def test_unavailable_edit_returns_stable_code_without_changing_review(self):
        self.moderate_review.return_value["outcome"] = "provider_failure"

        response = self.client.patch(
            self.detail_url,
            {"text": "Proposed unchecked update."},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "REVIEW_EDIT_MODERATION_UNAVAILABLE")
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_TEXT, "Original review.")

    def test_stale_edit_returns_conflict_code(self):
        def concurrent_change(**kwargs):
            Review.objects.filter(pk=self.review.pk).update(
                REVW_TEXT="Newer accepted update.",
            )
            return {
                "outcome": "safe",
                "checked_at": "2026-10-11T00:00:00+00:00",
                "findings": [],
            }

        self.moderate_review.side_effect = concurrent_change
        response = self.client.patch(
            self.detail_url,
            {"text": "Older proposed update."},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "REVIEW_EDIT_CONFLICT")
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_TEXT, "Newer accepted update.")

    def test_visibility_only_update_round_trips_and_preserves_other_edits(self):
        response = self.client.patch(
            self.detail_url,
            {"show_in_community": "false"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["data"]["show_in_community"])
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_TEXT, "Original review.")
        self.assertFalse(self.review.REVW_SHOW_IN_COMMUNITY)
        community_ids = [
            item["id"]
            for item in self.client.get("/api/reviews/community/").data["data"]["items"]
        ]
        self.assertNotIn(self.review.pk, community_ids)
        business_ids = [
            item["id"]
            for item in self.client.get(
                f"/api/reviews/business/{self.business.pk}/all/"
            ).data["data"]["items"]
        ]
        self.assertIn(self.review.pk, business_ids)

        self.client.patch(
            self.detail_url,
            {"text": "Updated text without a preference."},
            format="multipart",
        )
        self.review.refresh_from_db()
        self.assertFalse(self.review.REVW_SHOW_IN_COMMUNITY)

        response = self.client.patch(
            self.detail_url,
            {"show_in_community": "true"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["data"]["show_in_community"])
        community_ids = [
            item["id"]
            for item in self.client.get("/api/reviews/community/").data["data"]["items"]
        ]
        self.assertIn(self.review.pk, community_ids)

    def test_non_owner_cannot_change_community_preference(self):
        self.client.force_authenticate(self.other_explorer)
        response = self.client.patch(
            self.detail_url,
            {"show_in_community": "false"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.review.refresh_from_db()
        self.assertTrue(self.review.REVW_SHOW_IN_COMMUNITY)

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
