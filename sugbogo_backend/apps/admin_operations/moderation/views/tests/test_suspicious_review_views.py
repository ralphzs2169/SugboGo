"""Focused Admin API tests for read-only reliability investigation."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from apps.admin_operations.moderation.services.tests.test_manage_under_review_service import (
    create_under_review_context,
)
from apps.admin_operations.business_management.serializers.manage_business_serializers import (
    AdminReviewResponseSerializer,
)
from apps.admin_operations.moderation.serializers.manage_under_review_serializers import (
    AdminUnderReviewDetailSerializer,
)
from apps.business.models import Business
from apps.reviews.models import Review, ReviewReply
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer
from apps.users.models import User


class SuspiciousReviewViewTests(TestCase):
    """Cover queue filtering, role access, and evidence separation."""

    @classmethod
    def setUpTestData(cls):
        """Create existing-style review identities and Admin accounts."""
        cls.owner, cls.author, cls.business = create_under_review_context()
        cls.admin = User.objects.create(
            USER_EMAIL="suspicious-admin@example.com",
            USER_FNAME="Queue",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.super_admin = User.objects.create(
            USER_EMAIL="suspicious-super@example.com",
            USER_FNAME="Super",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def setUp(self):
        """Authenticate an Admin for each read-only request."""
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def create_review(
        self,
        text,
        reasons=None,
        status=Review.ReviewStatus.PUBLISHED,
        user=None,
        business=None,
        installation_id=None,
        evidence=None,
    ):
        """Create a review with deliberate reliability history."""
        if user is None:
            user = User.objects.create(
                USER_EMAIL=f"related-{User.objects.count()}@example.com",
                USER_FNAME="Related",
                USER_LNAME="Explorer",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
                password="!",
            )
        return Review.objects.create(
            USER_ID=user,
            BUSN_ID=business or self.business,
            REVW_TEXT=text,
            REVW_STATUS=status,
            REVW_INSTALLATION_ID=installation_id,
            REVW_RELIABILITY_REASONS=reasons or [],
            REVW_RELIABILITY_EVIDENCE=evidence or {},
        )

    def create_business(self):
        """Add another business so one author can have prior reviews."""
        owner = User.objects.create(
            USER_EMAIL=f"business-owner-{User.objects.count()}@example.com",
            USER_FNAME="Related",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        return Business.objects.create(
            BUSN_NAME=f"Related Business {Business.objects.count()}",
            BUSN_DESCRIPTION="A related business for investigation tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=self.business.CTGRY_ID,
            LOCT_ID=self.business.LOCT_ID,
        )

    def test_admin_roles_and_status_scope(self):
        """Only published signaled reviews appear for both Admin roles."""
        reason = Review.ReliabilityReason.RAPID_SUBMISSION
        included = self.create_review("Included", [reason])
        self.create_review("Unsignaled")
        held = self.create_review(
            "Held",
            [reason],
            status=Review.ReviewStatus.UNDER_REVIEW,
        )
        rejected = self.create_review(
            "Rejected",
            [reason],
            status=Review.ReviewStatus.REJECTED,
        )
        for actor in (self.admin, self.super_admin):
            with self.subTest(actor=actor.USER_ROLE):
                self.client.force_authenticate(actor)
                response = self.client.get(reverse("admin-suspicious-review-list"))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
                self.assertEqual(response.data["data"]["items"][0]["id"], included.pk)
                self.assertNotIn("detection_evidence", response.data["data"]["items"][0])
                for excluded in (held, rejected):
                    detail = reverse("admin-suspicious-review-detail", args=[excluded.pk])
                    self.assertEqual(self.client.get(detail).status_code, 404)

    def test_non_admin_access_is_denied(self):
        """Explorer, merchant, and anonymous callers cannot inspect signals."""
        review = self.create_review(
            "Private evidence",
            [Review.ReliabilityReason.DUPLICATE_CONTENT],
        )
        detail = reverse("admin-suspicious-review-detail", args=[review.pk])
        for actor in (self.author, self.owner, None):
            with self.subTest(actor=actor):
                self.client.force_authenticate(actor)
                expected = 401 if actor is None else 403
                self.assertEqual(
                    self.client.get(reverse("admin-suspicious-review-list")).status_code,
                    expected,
                )
                self.assertEqual(self.client.get(detail).status_code, expected)

    def test_admin_reliability_outcome_is_separate_from_queue_eligibility(self):
        """Only saved signals enter Suspicious, regardless of check outcome."""
        reason = Review.ReliabilityReason.RAPID_SUBMISSION
        signaled = self.create_review("Signaled review", [reason])
        clean_failure = self.create_review("Unsignaled failed check")
        held = self.create_review(
            "Held review",
            status=Review.ReviewStatus.UNDER_REVIEW,
        )

        for outcome in Review.ReliabilityCheckOutcome.values:
            with self.subTest(outcome=outcome):
                Review.objects.filter(pk=signaled.pk).update(
                    REVW_RELIABILITY_CHECK_OUTCOME=outcome,
                )
                detail = self.client.get(
                    reverse("admin-suspicious-review-detail", args=[signaled.pk]),
                )
                self.assertEqual(detail.status_code, 200)
                self.assertEqual(
                    detail.data["data"]["reliability_check_outcome"],
                    outcome,
                )
                self.assertNotIn("error_type", str(detail.data["data"]))

        Review.objects.filter(pk=clean_failure.pk).update(
            REVW_RELIABILITY_CHECK_OUTCOME=(
                Review.ReliabilityCheckOutcome.UNAVAILABLE
            ),
        )
        queue = self.client.get(reverse("admin-suspicious-review-list"))
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(
            [item["id"] for item in queue.data["data"]["items"]],
            [signaled.pk],
        )

        clean_failure.refresh_from_db()
        self.assertEqual(
            AdminReviewResponseSerializer(clean_failure).data[
                "reliability_check_outcome"
            ],
            Review.ReliabilityCheckOutcome.UNAVAILABLE,
        )
        self.assertEqual(
            AdminUnderReviewDetailSerializer(held).data[
                "reliability_check_outcome"
            ],
            Review.ReliabilityCheckOutcome.UNKNOWN,
        )

    def test_admin_presentation_context_is_kept_in_admin_responses(self):
        """Queue context and full review identity use existing review records."""
        review = self.create_review(
            "Review with presentation context",
            [Review.ReliabilityReason.RAPID_SUBMISSION],
        )
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/cover.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])
        edited_at = timezone.now()
        Review.objects.filter(pk=review.pk).update(
            REVW_EDITED_AT=edited_at,
            REVW_LIKE_COUNT=3,
        )
        ReviewReply.objects.create(
            REVW_ID=review,
            RPLY_TEXT="Thank you for the feedback.",
        )

        queue = self.client.get(
            reverse("admin-suspicious-review-list"),
        ).data["data"]["items"][0]
        self.assertTrue(queue["has_reply"])
        self.assertTrue(queue["is_edited"])
        self.assertNotIn("like_count", queue)

        detail = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        ).data["data"]
        self.assertEqual(detail["like_count"], 3)
        self.assertTrue(detail["is_edited"])
        self.assertEqual(parse_datetime(detail["edited_at"]), edited_at)
        self.assertEqual(detail["reply"]["text"], "Thank you for the feedback.")
        self.assertEqual(
            detail["business"]["cover_photo_url"],
            "https://example.com/cover.jpg",
        )
        self.assertEqual(
            detail["business"]["cluster_name"],
            self.business.CTGRY_ID.CLUS_ID.CLUS_NAME,
        )
        self.assertEqual(
            detail["business"]["category_name"],
            self.business.CTGRY_ID.CTGRY_NAME,
        )

    def test_search_signal_sort_and_pagination(self):
        """Filter in the database before applying stable pagination."""
        duplicate = Review.ReliabilityReason.DUPLICATE_CONTENT
        rapid = Review.ReliabilityReason.RAPID_SUBMISSION
        first = self.create_review("Great coffee", [duplicate], user=self.author)
        second = self.create_review("Friendly service", [rapid])
        third = self.create_review("Coffee and service", [duplicate, rapid])
        now = timezone.now()
        for review, age in ((first, 3), (second, 2), (third, 1)):
            Review.objects.filter(pk=review.pk).update(
                REVW_CREATED_AT=now - timedelta(days=age),
            )
        list_url = reverse("admin-suspicious-review-list")
        newest = self.client.get(list_url, {"page_size": 1})
        self.assertEqual(newest.data["data"]["items"][0]["id"], third.pk)
        self.assertEqual(newest.data["data"]["pagination"]["total_items"], 3)
        self.assertTrue(newest.data["data"]["pagination"]["has_next"])
        oldest = self.client.get(list_url, {"ordering": "oldest"})
        self.assertEqual(oldest.data["data"]["items"][0]["id"], first.pk)
        filtered = self.client.get(list_url, {"signal": duplicate})
        self.assertEqual(
            {item["id"] for item in filtered.data["data"]["items"]},
            {first.pk, third.pk},
        )
        for search in (
            "coffee",
            f"{self.author.USER_FNAME} {self.author.USER_LNAME}",
            self.business.BUSN_NAME,
        ):
            with self.subTest(search=search):
                response = self.client.get(list_url, {"search": search})
                self.assertEqual(response.status_code, 200)
                self.assertGreater(response.data["data"]["pagination"]["total_items"], 0)
        invalid = self.client.get(list_url, {"signal": "unknown"})
        self.assertEqual(invalid.status_code, 400)

    def test_detail_separates_stored_evidence_from_current_matches(self):
        """Deleted and edited matches change live context but not the snapshot."""
        duplicate = Review.ReliabilityReason.DUPLICATE_CONTENT
        prior_business = self.create_business()
        deleted_business = self.create_business()
        prior = self.create_review(
            "Same  WORDS",
            user=self.author,
            business=prior_business,
        )
        deleted = self.create_review(
            "same words",
            user=self.author,
            business=deleted_business,
        )
        evidence = {
            duplicate: {
                "observed_at": timezone.now().isoformat(),
                "prior_match_count": 2,
                "matched_review_ids": [prior.pk, deleted.pk],
                "basis": "same_user",
            },
        }
        review = self.create_review(
            "same words",
            [duplicate],
            user=self.author,
            evidence=evidence,
        )
        deleted_id = deleted.pk
        deleted.delete()
        response = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        )
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["detection_evidence"][duplicate]["prior_match_count"], 2)
        self.assertEqual(
            data["detection_evidence"][duplicate]["matched_reviews"],
            [
                {"id": prior.pk, "available": True},
                {"id": deleted_id, "available": False},
            ],
        )
        self.assertEqual(data["current_related_activity"][duplicate]["review_count"], 1)
        self.assertFalse(
            data["current_related_activity"][duplicate].get("window_unavailable", False)
        )
        self.assertEqual(
            [item["id"] for item in data["current_related_activity"]["referenced_reviews"]],
            [prior.pk],
        )
        Review.objects.filter(pk=prior.pk).update(REVW_TEXT="Changed later")
        changed = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        ).data["data"]
        self.assertEqual(changed["detection_evidence"][duplicate]["prior_match_count"], 2)
        self.assertEqual(changed["current_related_activity"][duplicate]["review_count"], 0)
        self.assertEqual(
            changed["current_related_activity"]["referenced_reviews"][0]["text"],
            "Changed later",
        )

    def test_edit_duplicate_activity_uses_detection_time_window(self):
        """Live matches use the edit detection time, not submission time."""
        duplicate = Review.ReliabilityReason.DUPLICATE_CONTENT
        detected_at = timezone.now()
        matching = self.create_review(
            "SAME words",
            user=self.author,
            business=self.create_business(),
        )
        changed = self.create_review(
            "same words",
            user=self.author,
            business=self.create_business(),
        )
        older = self.create_review(
            "same words",
            user=self.author,
            business=self.create_business(),
        )
        later = self.create_review(
            "same words",
            user=self.author,
            business=self.create_business(),
        )
        Review.objects.filter(pk=matching.pk).update(
            REVW_CREATED_AT=detected_at - timedelta(days=2),
        )
        Review.objects.filter(pk=changed.pk).update(
            REVW_CREATED_AT=detected_at - timedelta(days=3),
            REVW_TEXT="Changed after detection",
        )
        Review.objects.filter(pk=older.pk).update(
            REVW_CREATED_AT=detected_at - timedelta(days=31),
        )
        Review.objects.filter(pk=later.pk).update(
            REVW_CREATED_AT=detected_at + timedelta(days=1),
        )
        evidence = {
            duplicate: {
                "observed_at": detected_at.isoformat(),
                "detected_during": "edit",
                "prior_match_count": 2,
                "matched_review_ids": [matching.pk, changed.pk],
                "basis": "same_user",
            },
        }
        review = self.create_review(
            "same words",
            [duplicate],
            user=self.author,
            evidence=evidence,
        )
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=detected_at - timedelta(days=10),
            REVW_EDITED_AT=detected_at,
        )

        data = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        ).data["data"]

        self.assertEqual(
            data["detection_evidence"][duplicate]["observed_at"],
            detected_at.isoformat(),
        )
        self.assertEqual(
            data["detection_evidence"][duplicate]["detected_during"],
            "edit",
        )
        self.assertEqual(
            [item["id"] for item in data["current_related_activity"][duplicate]["reviews"]],
            [matching.pk],
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_RELIABILITY_EVIDENCE, evidence)
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)

    def test_missing_duplicate_detection_time_does_not_invent_live_window(self):
        """Historical evidence without a time cannot define a live window."""
        duplicate = Review.ReliabilityReason.DUPLICATE_CONTENT
        matching = self.create_review(
            "same words",
            user=self.author,
            business=self.create_business(),
        )
        evidence = {
            duplicate: {
                "prior_match_count": 1,
                "matched_review_ids": [matching.pk],
                "basis": "same_user",
            },
        }
        review = self.create_review(
            "same words",
            [duplicate],
            user=self.author,
            evidence=evidence,
        )

        data = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        ).data["data"]

        self.assertTrue(
            data["current_related_activity"][duplicate]["window_unavailable"]
        )
        self.assertEqual(
            data["current_related_activity"][duplicate]["reviews"],
            [],
        )
        self.assertEqual(
            data["current_related_activity"]["referenced_reviews"][0]["id"],
            matching.pk,
        )
        review.refresh_from_db()
        self.assertEqual(review.REVW_RELIABILITY_EVIDENCE, evidence)

    def test_installation_activity_uses_original_window_and_business(self):
        """Live rapid and account views use the saved review's relationships."""
        rapid = Review.ReliabilityReason.RAPID_SUBMISSION
        shared = Review.ReliabilityReason.SHARED_INSTALLATION_ACCOUNTS
        review = self.create_review(
            "Current review",
            [rapid, shared],
            installation_id="private-installation",
            evidence={
                rapid: {"review_count": 11, "window_hours": 24},
                shared: {"distinct_account_count": 4},
            },
        )
        evidence = review.REVW_RELIABILITY_EVIDENCE
        evidence[rapid]["observed_at"] = review.REVW_CREATED_AT.isoformat()
        Review.objects.filter(pk=review.pk).update(
            REVW_RELIABILITY_EVIDENCE=evidence,
        )
        related = self.create_review(
            "Related review",
            installation_id="private-installation",
            user=self.owner,
        )
        Review.objects.filter(pk=related.pk).update(
            REVW_CREATED_AT=review.REVW_CREATED_AT - timedelta(hours=1),
        )
        older = self.create_review(
            "Old review",
            installation_id="private-installation",
        )
        Review.objects.filter(pk=older.pk).update(
            REVW_CREATED_AT=review.REVW_CREATED_AT - timedelta(hours=25),
        )
        data = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        ).data["data"]
        self.assertEqual(data["detection_evidence"][rapid]["review_count"], 11)
        self.assertEqual(data["detection_evidence"][shared]["distinct_account_count"], 4)
        activity = data["current_related_activity"]
        rapid_ids = {item["id"] for item in activity[rapid]["reviews"]}
        self.assertEqual(rapid_ids, {review.pk, related.pk})
        self.assertEqual(activity[shared]["distinct_account_count"], 3)
        self.assertEqual(activity[shared]["review_count"], 3)
        self.assertNotIn("private-installation", str(data))
        review.refresh_from_db()
        self.assertEqual(review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertEqual(review.REVW_RELIABILITY_REASONS, [rapid, shared])

    def test_rapid_activity_uses_detection_observation_window(self):
        """Live activity uses the saved observation and inclusive boundaries."""
        rapid = Review.ReliabilityReason.RAPID_SUBMISSION
        review = self.create_review(
            "Detected review",
            [rapid],
            installation_id="rapid-installation",
        )
        observed_at = timezone.now()
        window_start = observed_at - timedelta(hours=24)
        evidence = {
            rapid: {
                "observed_at": observed_at.isoformat(),
                "review_count": 11,
                "window_hours": 24,
            },
        }
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=observed_at - timedelta(days=10),
            REVW_RELIABILITY_EVIDENCE=evidence,
        )
        candidates = [
            (
                "At start",
                window_start,
                "rapid-installation",
                Review.ReviewStatus.PUBLISHED,
            ),
            (
                "At end",
                observed_at,
                "rapid-installation",
                Review.ReviewStatus.PUBLISHED,
            ),
            (
                "Rejected related",
                observed_at - timedelta(hours=1),
                "rapid-installation",
                Review.ReviewStatus.REJECTED,
            ),
            (
                "Before start",
                window_start - timedelta(microseconds=1),
                "rapid-installation",
                Review.ReviewStatus.PUBLISHED,
            ),
            (
                "After end",
                observed_at + timedelta(microseconds=1),
                "rapid-installation",
                Review.ReviewStatus.PUBLISHED,
            ),
            (
                "Different installation",
                observed_at - timedelta(hours=1),
                "other-installation",
                Review.ReviewStatus.PUBLISHED,
            ),
        ]
        included_ids = set()
        for text, created_at, installation_id, status in candidates:
            related = self.create_review(
                text,
                status=status,
                installation_id=installation_id,
            )
            Review.objects.filter(pk=related.pk).update(
                REVW_CREATED_AT=created_at,
            )
            if text in {"At start", "At end", "Rejected related"}:
                included_ids.add(related.pk)

        data = self.client.get(
            reverse("admin-suspicious-review-detail", args=[review.pk]),
        ).data["data"]

        activity = data["current_related_activity"][rapid]
        self.assertEqual(
            {item["id"] for item in activity["reviews"]},
            included_ids,
        )
        self.assertEqual(activity["review_count"], 3)
        self.assertEqual(data["detection_evidence"][rapid]["review_count"], 11)
        review.refresh_from_db()
        self.assertEqual(review.REVW_RELIABILITY_EVIDENCE, evidence)

    def test_rapid_activity_without_valid_observation_has_no_live_window(self):
        """Legacy or invalid evidence must not invent a creation-time window."""
        rapid = Review.ReliabilityReason.RAPID_SUBMISSION
        observations = [
            None,
            "not-a-date",
            "2026-10-10T12:00:00",
        ]
        for observed_at in observations:
            with self.subTest(observed_at=observed_at):
                rapid_evidence = {
                    "review_count": 11,
                    "window_hours": 24,
                }
                if observed_at is not None:
                    rapid_evidence["observed_at"] = observed_at
                evidence = {rapid: rapid_evidence}
                review = self.create_review(
                    "Legacy rapid review",
                    [rapid],
                    installation_id="rapid-installation",
                    evidence=evidence,
                )

                data = self.client.get(
                    reverse("admin-suspicious-review-detail", args=[review.pk]),
                ).data["data"]

                self.assertEqual(
                    data["current_related_activity"][rapid],
                    {
                        "reviews": [],
                        "review_count": 0,
                        "window_unavailable": True,
                    },
                )
                review.refresh_from_db()
                self.assertEqual(review.REVW_RELIABILITY_EVIDENCE, evidence)

    def test_ordinary_review_response_omits_reliability_evidence(self):
        """The public review serializer exposes no investigation data."""
        review = self.create_review(
            "Ordinary response",
            [Review.ReliabilityReason.RAPID_SUBMISSION],
            evidence={"rapid_submission": {"review_count": 11}},
        )
        data = ReviewResponseSerializer(review).data
        self.assertNotIn("reliability_evidence", data)
        self.assertNotIn("detection_evidence", data)
