from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.moderation.services.manage_under_review_service import (
    ManageUnderReviewService,
)
from apps.admin_operations.moderation.services.manage_review_report_service import (
    ManageReviewReportService,
)
from apps.admin_operations.moderation.services.manage_reported_review_service import (
    ManageReportedReviewService,
)
from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.admin_operations.system_configuration.models import AnalyticsPolicyConfiguration
from apps.review_disputes.models import MerchantReviewDispute
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService
from apps.review_disputes.services.review_snapshot_service import ReviewSnapshotService
from apps.business.models import (
    Business,
    BusinessPhoto,
    BusinessSpecialtyTag,
    BusinessVouch,
    SpecialtyTag,
)
from apps.reviews.models import ReplyPhoto, Review, ReviewPhoto, ReviewReply, ReviewReport
from apps.reviews.services.review_service import ReviewService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class MyReviewViewTests(
    SummaryFixtureMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Tests private cross-business review history through the actual API."""

    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()
        cls.other_business = cls.create_business(1)
        cls.user = User.objects.create_user(
            email="my-reviews@example.com",
            password=None,
            USER_FNAME="Review",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.admin = User.objects.create_user(
            email="my-reviews-admin@example.com",
            password=None,
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def setUp(self):
        self.url = reverse("my-review-list")
        self.client.force_authenticate(self.user)

    def _create_review(
        self,
        business=None,
        **overrides,
    ):
        """Create an author submission without invoking write-workflow effects."""
        if business is None:
            business = self.business
        values = {
            "BUSN_ID": business,
            "USER_ID": self.user,
            "REVW_TEXT": "My experience at this business was memorable.",
        }
        values.update(overrides)
        return Review.objects.create(**values)

    def _attach_media(
        self,
        review,
    ):
        """Attach review and merchant-response media for serialization checks."""
        photo = ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL=f"https://example.com/review-{review.pk}.jpg",
            RPHO_PHOTO_PUBLIC_ID=f"review-{review.pk}",
        )
        reply = ReviewReply.objects.create(
            REVW_ID=review,
            RPLY_TEXT="Thank you for sharing your experience.",
        )
        reply_photo = ReplyPhoto.objects.create(
            RPLY_ID=reply,
            RPHO_PHOTO_URL=f"https://example.com/reply-{review.pk}.jpg",
            RPHO_PHOTO_PUBLIC_ID=f"reply-{review.pk}",
        )
        return {
            "photo": photo,
            "reply": reply,
            "reply_photo": reply_photo,
        }

    def test_returns_only_requesting_author_across_businesses(self):
        first = self._create_review()
        second = self._create_review(self.other_business)
        other_author = self.business.USER_ID
        private = self._create_review(
            self.other_business,
            USER_ID=other_author,
            REVW_STATUS=Review.ReviewStatus.REJECTED,
            REVW_TEXT="Another author's private submission.",
        )

        response = self.client.get(
            self.url,
            {
                "user_id": other_author.pk,
                "author": other_author.pk,
                "USER_ID": other_author.pk,
            },
        )

        self.assertEqual(self.url, "/api/reviews/mine/")
        self.assertSuccessResponse(response, message="Success.")
        data = response.data["data"]
        self.assertEqual(
            {item["id"] for item in data["items"]},
            {first.pk, second.pk},
        )
        self.assertEqual(data["pagination"]["total_items"], 2)
        self.assertNotIn(private.REVW_TEXT, response.content.decode())
        for item in data["items"]:
            self.assertEqual(item["author"]["id"], self.user.pk)
            self.assertTrue(item["is_own_review"])

        self.client.force_authenticate(other_author)
        merchant_response = self.client.get(self.url)
        self.assertSuccessResponse(merchant_response, message="Success.")
        self.assertEqual(
            [item["id"] for item in merchant_response.data["data"]["items"]],
            [private.pk],
        )

    def test_all_statuses_opt_outs_and_suspended_businesses_are_included(self):
        businesses = [
            self.business,
            self.other_business,
            self.create_business(2),
            self.create_business(3),
        ]
        self.other_business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.other_business.save(update_fields=["BUSN_STATUS"])
        expected_ids = set()
        for business, review_status in zip(businesses, Review.ReviewStatus.values):
            review = self._create_review(
                business,
                REVW_STATUS=review_status,
                REVW_SHOW_IN_COMMUNITY=False,
            )
            expected_ids.add(review.pk)

        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        data = response.data["data"]
        self.assertEqual({item["id"] for item in data["items"]}, expected_ids)
        self.assertEqual(
            {item["status"] for item in data["items"]},
            set(Review.ReviewStatus.values),
        )
        self.assertEqual(data["pagination"]["total_items"], 4)
        for item in data["items"]:
            self.assertFalse(item["show_in_community"])
            if item["business"]["id"] == self.other_business.pk:
                self.assertEqual(item["business"]["status"], "suspended")

    def test_serializes_business_identity_and_prefers_dedicated_cover(self):
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/cover.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])
        BusinessPhoto.objects.create(
            BUSN_ID=self.business,
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
            BPHO_PHOTO_URL="https://example.com/storefront.jpg",
            BPHO_PHOTO_PUBLIC_ID="storefront",
        )
        self._create_review()

        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(response.data["data"]["items"][0]["business"], {
            "id": self.business.pk,
            "business_name": self.business.BUSN_NAME,
            "display_cover_photo_url": self.business.BUSN_COVER_PHOTO_URL,
            "category": {
                "id": self.business.CTGRY_ID_id,
                "name": self.business.CTGRY_ID.CTGRY_NAME,
            },
            "status": "active",
        })

    def test_cover_fallback_is_correlated_to_each_business(self):
        self._create_review()
        self._create_review(self.other_business)
        BusinessPhoto.objects.create(
            BUSN_ID=self.business,
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.INTERIOR,
            BPHO_PHOTO_URL="https://example.com/interior.jpg",
            BPHO_PHOTO_PUBLIC_ID="interior",
        )
        for index, url in enumerate([
            "",
            "https://example.com/first-storefront.jpg",
            "https://example.com/second-storefront.jpg",
        ]):
            BusinessPhoto.objects.create(
                BUSN_ID=self.business,
                BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
                BPHO_PHOTO_URL=url,
                BPHO_PHOTO_PUBLIC_ID=f"storefront-{index}",
            )

        for cover in (None, ""):
            with self.subTest(cover=cover):
                self.business.BUSN_COVER_PHOTO_URL = cover
                self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])
                response = self.client.get(self.url)
                self.assertSuccessResponse(response, message="Success.")
                businesses = {
                    item["business"]["id"]: item["business"]
                    for item in response.data["data"]["items"]
                }
                self.assertEqual(
                    businesses[self.business.pk]["display_cover_photo_url"],
                    "https://example.com/first-storefront.jpg",
                )
                self.assertIsNone(
                    businesses[self.other_business.pk]["display_cover_photo_url"],
                )

    def test_serializes_photos_reply_and_nullable_edited_date(self):
        review = self._create_review()
        media = self._attach_media(review)

        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        item = response.data["data"]["items"][0]
        self.assertEqual(item["text"], review.REVW_TEXT)
        self.assertIsNotNone(item["created_at"])
        self.assertIsNotNone(item["updated_at"])
        self.assertIsNone(item["edited_at"])
        self.assertEqual(item["photos"], [{
            "id": media["photo"].pk,
            "photo_url": media["photo"].RPHO_PHOTO_URL,
        }])
        self.assertEqual(item["reply"]["id"], media["reply"].pk)
        self.assertEqual(item["reply"]["text"], media["reply"].RPLY_TEXT)
        self.assertEqual(item["reply"]["photos"], [{
            "id": media["reply_photo"].pk,
            "photo_url": media["reply_photo"].RPHO_PHOTO_URL,
        }])

        edited_at = timezone.now()
        Review.objects.filter(pk=review.pk).update(REVW_EDITED_AT=edited_at)
        edited = self.client.get(self.url).data["data"]["items"][0]
        self.assertEqual(
            edited["edited_at"],
            edited_at.isoformat().replace("+00:00", "Z"),
        )

    def test_newest_ordering_uses_review_id_for_identical_timestamps(self):
        oldest = self._create_review()
        tied_first = self._create_review(self.other_business)
        tied_second = self._create_review(self.create_business(2))
        reference_time = timezone.now()
        Review.objects.filter(pk=oldest.pk).update(
            REVW_CREATED_AT=reference_time - timedelta(days=1),
        )
        Review.objects.filter(pk__in=[tied_first.pk, tied_second.pk]).update(
            REVW_CREATED_AT=reference_time,
        )

        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [tied_second.pk, tied_first.pk, oldest.pk],
        )

    def test_standard_pagination_counts_only_retained_author_reviews(self):
        first = self._create_review(REVW_SHOW_IN_COMMUNITY=False)
        second = self._create_review(
            self.other_business,
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )
        deleted = self._create_review(self.create_business(2))
        deleted.delete()
        self._create_review(USER_ID=self.other_business.USER_ID)

        response = self.client.get(self.url, {"page": 1, "page_size": 1})

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(response.data["data"]["pagination"], {
            "page": 1,
            "page_size": 1,
            "total_items": 2,
            "total_pages": 2,
            "has_next": True,
            "has_previous": False,
        })
        next_response = self.client.get(self.url, {"page": 2, "page_size": 1})
        self.assertSuccessResponse(next_response, message="Success.")
        pagination = next_response.data["data"]["pagination"]
        self.assertEqual(pagination["page"], 2)
        self.assertEqual(pagination["total_items"], 2)
        self.assertFalse(pagination["has_next"])
        self.assertTrue(pagination["has_previous"])
        page_ids = [
            response.data["data"]["items"][0]["id"],
            next_response.data["data"]["items"][0]["id"],
        ]
        self.assertEqual(set(page_ids), {first.pk, second.pk})

    def test_empty_history_uses_standard_success_envelope(self):
        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"], {
            "page": 1,
            "page_size": 10,
            "total_items": 0,
            "total_pages": 0,
            "has_next": False,
            "has_previous": False,
        })

    def test_rejects_unauthenticated_unsupported_and_inactive_accounts(self):
        self.client.force_authenticate(user=None)
        self.assertAuthenticationError(
            self.client.get(self.url),
            code="NOT_AUTHENTICATED",
        )
        cases = (
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.SUSPENDED),
            (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.EXPLORER, User.UserStatus.DISABLED),
        )
        for role, account_status in cases:
            with self.subTest(role=role, account_status=account_status):
                self.user.USER_ROLE = role
                self.user.USER_STATUS = account_status
                self.user.save(update_fields=["USER_ROLE", "USER_STATUS"])
                self.client.force_authenticate(self.user)
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, 403)
                self.assertFalse(response.data["success"])
                self.assertEqual(response.data["code"], "PERMISSION_DENIED")

    def test_internal_fields_are_excluded_by_explicit_response_contract(self):
        self._create_review(
            REVW_INSTALLATION_ID="private-installation",
            REVW_MODERATION_NOTES="private-admin-notes",
            REVW_MODERATION_DATA={"private": "moderation-evidence"},
            REVW_IS_REPORT_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
            REVW_IS_OUTLIER_SENTIMENT=True,
            REVW_RELIABILITY_REASONS=["duplicate_content"],
            REVW_RELIABILITY_EVIDENCE={"private": "reliability-evidence"},
            REVW_REPORT_COUNT=3,
            REVW_SENTIMENT_SCORE=-0.9,
            REVW_SENTIMENT_LABEL="negative",
        )

        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        item = response.data["data"]["items"][0]
        self.assertEqual(set(item), {
            "id",
            "text",
            "status",
            "moderation_progress",
            "sentiment_aggregate_included",
            "created_at",
            "updated_at",
            "edited_at",
            "photos",
            "author",
            "reply",
            "is_own_review",
            "show_in_community",
            "vouched_specialties",
            "business",
            "non_public_reason",
            "has_pending_merchant_dispute",
        })
        self.assertEqual(set(item["author"]), {
            "id",
            "first_name",
            "last_name",
            "role",
            "avatar_url",
            "avatar_key",
        })
        rendered = response.content.decode()
        for private_value in (
            "private-installation",
            "private-admin-notes",
            "moderation-evidence",
            "reliability-evidence",
        ):
            self.assertNotIn(private_value, rendered)

    def test_vouches_are_attached_to_correct_business_and_author(self):
        self._create_review()
        self._create_review(self.other_business)
        first_tag = SpecialtyTag.objects.create(TAG_NAME="First specialty")
        second_tag = SpecialtyTag.objects.create(TAG_NAME="Second specialty")
        inactive_tag = SpecialtyTag.objects.create(TAG_NAME="Inactive specialty")
        for business, tag, active in (
            (self.business, first_tag, True),
            (self.other_business, second_tag, True),
            (self.business, inactive_tag, False),
        ):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=tag,
                BST_IS_ACTIVE=active,
            )
            BusinessVouch.objects.create(
                BUSN_ID=business,
                USER_ID=self.user,
                TAG_ID=tag,
                VOUCH_REPUTATION_SNAPSHOT="0.20",
            )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.business.USER_ID,
            TAG_ID=first_tag,
            VOUCH_REPUTATION_SNAPSHOT="0.20",
        )

        response = self.client.get(self.url)

        self.assertSuccessResponse(response, message="Success.")
        tags_by_business = {
            item["business"]["id"]: [
                tag["id"]
                for tag in item["vouched_specialties"]
            ]
            for item in response.data["data"]["items"]
        }
        self.assertEqual(tags_by_business, {
            self.business.pk: [first_tag.pk],
            self.other_business.pk: [second_tag.pk],
        })

    def test_query_count_is_bounded_and_enrichment_runs_after_pagination(self):
        first = self._create_review()
        self._attach_media(first)
        for index in range(1, 6):
            if index == 1:
                business = self.other_business
            else:
                business = self.create_business(index)
            review = self._create_review(business)
            self._attach_media(review)

        with (
            patch.object(
                ReviewService,
                "_attach_vouched_specialties",
                wraps=ReviewService._attach_vouched_specialties,
            ) as attach,
            CaptureQueriesContext(connection) as small_queries,
        ):
            small = self.client.get(self.url, {"page_size": 1})
        self.assertSuccessResponse(small, message="Success.")
        self.assertEqual(len(attach.call_args.args[0]), 1)

        with CaptureQueriesContext(connection) as large_queries:
            large = self.client.get(self.url, {"page_size": 6})
        self.assertSuccessResponse(large, message="Success.")
        self.assertEqual(len(large.data["data"]["items"]), 6)
        self.assertEqual(len(small_queries), len(large_queries))
        self.assertLessEqual(len(large_queries), 6)

    def test_invalid_page_uses_existing_not_found_response(self):
        response = self.client.get(self.url, {"page": 2})

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["code"], "NOT_FOUND")

    def _assert_reason(
        self,
        review,
        expected,
    ):
        """Read the author's reason through the actual paginated response."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        item = next(
            item
            for item in response.data["data"]["items"]
            if item["id"] == review.pk
        )
        self.assertEqual(item["non_public_reason"], expected)
        return item

    def test_moderation_rejection_reason_comes_from_actual_admin_transition(self):
        review = self._create_review(
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        ManageUnderReviewService.resolve(
            review.pk,
            actor=self.admin,
            approve=False,
            moderation_notes="Private moderation explanation for this rejection.",
        )
        self._assert_reason(review, "moderation")

    def test_individual_and_grouped_report_rejections_have_community_reason(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        for grouped, business in (
            (False, self.business),
            (True, self.other_business),
        ):
            with self.subTest(grouped=grouped):
                review = self._create_review(business)
                report = ReviewReport.objects.create(
                    REVW_ID=review,
                    USER_ID=business.USER_ID,
                    RREP_TYPE=ReviewReport.ReportType.ABUSE,
                )
                if grouped:
                    ManageReportedReviewService.resolve(
                        review.pk,
                        actor=self.admin,
                        decision="reject",
                        admin_notes="The reported content was independently reviewed.",
                    )
                else:
                    ManageReviewReportService.resolve(
                        report.pk,
                        actor=self.admin,
                        approve=True,
                        admin_notes="The reported content was independently reviewed.",
                    )
                self._assert_reason(review, "community_reports")

    def test_upheld_dispute_reason_and_later_report_resolution_do_not_conflict(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        review = self._create_review()
        report = ReviewReport.objects.create(
            REVW_ID=review,
            USER_ID=self.other_business.USER_ID,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
        )
        dispute = ReviewDisputeService.create_dispute(
            user=self.business.USER_ID,
            review_id=review.pk,
            reason="fake_review",
            description="The merchant disputes this review.",
        )
        ManageReviewDisputeService.uphold_dispute(
            dispute.pk,
            actor=self.admin,
            expected_fingerprint=ReviewSnapshotService.current_fingerprint(review),
            admin_notes="The current review was inspected and the dispute is upheld.",
        )
        self._assert_reason(review, "merchant_dispute")
        ManageReviewReportService.resolve(
            report.pk,
            actor=self.admin,
            approve=True,
            admin_notes="The remaining report is resolved after the original rejection.",
        )
        self._assert_reason(review, "merchant_dispute")

    def test_later_rejected_to_rejected_dispute_preserves_report_reason(self):
        AnalyticsPolicyConfiguration.objects.get_or_create(pk=1)
        review = self._create_review()
        dispute = ReviewDisputeService.create_dispute(
            user=self.business.USER_ID,
            review_id=review.pk,
            reason="fake_review",
            description="The merchant disputes this review.",
        )
        report = ReviewReport.objects.create(
            REVW_ID=review,
            USER_ID=self.other_business.USER_ID,
            RREP_TYPE=ReviewReport.ReportType.ABUSE,
        )
        ManageReviewReportService.resolve(
            report.pk,
            actor=self.admin,
            approve=True,
            admin_notes="The report warrants rejecting the published content.",
        )
        ManageReviewDisputeService.uphold_dispute(
            dispute.pk,
            actor=self.admin,
            expected_fingerprint=ReviewSnapshotService.current_fingerprint(review),
            admin_notes="The pending dispute is resolved after the original rejection.",
        )
        self._assert_reason(review, "community_reports")

    def test_unknown_reason_ignores_unverified_history_and_private_metadata(self):
        review = self._create_review(
            REVW_STATUS=Review.ReviewStatus.REJECTED,
            REVW_MODERATION_DATA={"outcome": "flagged"},
        )
        contexts = [
            {"review_id": review.pk},
            {
                "review_id": review.pk,
                "previous_review_status": "rejected",
                "review_status": "rejected",
            },
            {
                "review_id": review.pk,
                "previous_review_status": "published",
                "review_status": "published",
            },
            {
                "review_id": review.pk + 1000,
                "previous_review_status": "published",
                "review_status": "rejected",
            },
        ]
        for context in contexts:
            AdminActivity.objects.create(
                ACTOR_ID=self.admin,
                TARGET_USER_ID=self.user,
                AACT_ACTION=AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
                AACT_CONTEXT=context,
            )
        self._assert_reason(review, "unknown")
        flagged = self._create_review(
            self.other_business,
            REVW_STATUS=Review.ReviewStatus.FLAGGED,
        )
        self._assert_reason(flagged, "unknown")

    def test_pending_dispute_notice_is_author_scoped_and_published_only(self):
        review = self._create_review()
        item = self._assert_reason(review, "unknown")
        self.assertFalse(item["has_pending_merchant_dispute"])
        dispute = ReviewDisputeService.create_dispute(
            user=self.business.USER_ID,
            review_id=review.pk,
            reason="fake_review",
            description="A pending merchant dispute.",
        )
        item = self._assert_reason(review, "unknown")
        self.assertTrue(item["has_pending_merchant_dispute"])
        self.assertNotIn("active_dispute_id", item)
        self.assertNotIn("evidence", item)
        Review.objects.filter(pk=review.pk).update(REVW_STATUS="rejected")
        item = self._assert_reason(review, "unknown")
        self.assertFalse(item["has_pending_merchant_dispute"])
        Review.objects.filter(pk=review.pk).update(REVW_STATUS="published")
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            MRDSP_STATUS="withdrawn",
        )
        item = self._assert_reason(review, "unknown")
        self.assertFalse(item["has_pending_merchant_dispute"])
        public = self.client.get(
            reverse("review-preview", args=[self.business.pk]),
        )
        for item in public.data["data"]["reviews"]:
            self.assertNotIn("non_public_reason", item)
            self.assertNotIn("has_pending_merchant_dispute", item)
