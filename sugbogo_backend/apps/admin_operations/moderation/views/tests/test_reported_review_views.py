"""Focused grouped Admin API tests for community-reported reviews."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.admin_operations.moderation.services.tests.test_manage_review_report_service import (
    ReportFixtures,
)
from apps.reviews.models import Review, ReviewReport
from apps.reviews.serializers.review_serializers import ReviewResponseSerializer
from apps.reviews.services.review_report_service import ReviewReportService
from apps.users.models import User


class ReportedReviewViewTests(ReportFixtures, TestCase):
    """Verify grouping, filters, role access, and existing decisions."""

    def setUp(self):
        """Authenticate an Admin with one pending report fixture."""
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def create_review(
        self,
        text,
    ):
        """Create a second review on the fixture business."""
        author = User.objects.create_user(
            email=f"reported-author-{User.objects.count()}@example.com",
            password=None,
            USER_FNAME="Reported",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return Review.objects.create(
            USER_ID=author,
            BUSN_ID=self.business,
            REVW_TEXT=text,
        )

    def create_report(
        self,
        review,
        report_type,
    ):
        """Create an independent reporter through the canonical service."""
        reporter = User.objects.create_user(
            email=f"reported-reporter-{User.objects.count()}@example.com",
            password=None,
            USER_FNAME="Community",
            USER_LNAME="Reporter",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return ReviewReportService.create_report(
            user=reporter,
            review_id=review.pk,
            report_type=report_type,
        )

    def test_one_review_group_contains_all_pending_reports(self):
        """One pending report is enough and siblings share one queue item."""
        self.create_report(self.review, ReviewReport.ReportType.SPAM)
        self.create_report(self.review, ReviewReport.ReportType.ABUSE)
        response = self.client.get(reverse("admin-reported-review-list"))
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["pagination"]["total_items"], 1)
        item = data["items"][0]
        self.assertEqual(item["id"], self.review.pk)
        self.assertEqual(item["pending_report_count"], 3)
        self.assertEqual(item["reason_counts"]["abuse"], 2)
        self.assertEqual(item["reason_counts"]["spam"], 1)
        self.assertTrue(item["needs_attention"])
        self.assertLessEqual(item["first_pending_at"], item["latest_pending_at"])
        self.assertNotIn("private-device", str(item))

        detail = self.client.get(
            reverse("admin-reported-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(detail["text"], self.review.REVW_TEXT)
        self.assertEqual(len(detail["reports"]), 3)
        self.assertNotIn("reporter", detail["reports"][0])

    def test_single_pending_report_appears_without_attention(self):
        """The attention threshold does not gate the report queue."""
        response = self.client.get(reverse("admin-reported-review-list"))
        self.assertEqual(response.status_code, 200)
        item = response.data["data"]["items"][0]
        self.assertEqual(item["pending_report_count"], 1)
        self.assertFalse(item["needs_attention"])

    def test_public_review_serializer_has_no_report_moderation_data(self):
        """Grouped state and report decisions stay outside public review data."""
        fields = ReviewResponseSerializer().fields
        for name in (
            "pending_report_count",
            "reason_counts",
            "needs_attention",
            "reports",
            "reporter",
        ):
            with self.subTest(name=name):
                self.assertNotIn(name, fields)

    def test_admin_roles_and_unauthorized_access(self):
        """Grouped queue and detail remain Admin-only."""
        list_url = reverse("admin-reported-review-list")
        detail_url = reverse("admin-reported-review-detail", args=[self.review.pk])
        self.admin.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.admin.save(update_fields=["USER_ROLE"])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(list_url).status_code, 200)
        self.assertEqual(self.client.get(detail_url).status_code, 200)

        for actor in (self.user, self.second_user, None):
            with self.subTest(actor=actor):
                self.client.force_authenticate(actor)
                expected = 401 if actor is None else 403
                self.assertEqual(self.client.get(list_url).status_code, expected)
                self.assertEqual(self.client.get(detail_url).status_code, expected)

    def test_search_reason_filter_and_grouped_pagination(self):
        """Filters select review groups before pagination."""
        self.create_report(self.review, ReviewReport.ReportType.SPAM)
        other = self.create_review("A very different place")
        self.create_report(other, ReviewReport.ReportType.OTHER)
        list_url = reverse("admin-reported-review-list")

        page = self.client.get(list_url, {"page_size": 1})
        self.assertEqual(page.data["data"]["pagination"]["total_items"], 2)
        self.assertTrue(page.data["data"]["pagination"]["has_next"])
        self.assertEqual(page.data["data"]["items"][0]["id"], self.review.pk)

        filtered = self.client.get(list_url, {"reason": "spam"})
        self.assertEqual(filtered.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(filtered.data["data"]["items"][0]["id"], self.review.pk)
        self.assertEqual(filtered.data["data"]["items"][0]["reason_counts"]["abuse"], 1)
        for search, expected_count in (
            ("different place", 1),
            ("Reported Author", 1),
            (self.business.BUSN_NAME, 2),
        ):
            with self.subTest(search=search):
                response = self.client.get(list_url, {"search": search})
                self.assertEqual(
                    response.data["data"]["pagination"]["total_items"],
                    expected_count,
                )
        self.assertEqual(self.client.get(list_url, {"reason": "invalid"}).status_code, 400)

    def test_all_sort_orders_use_pending_report_aggregates(self):
        """Sort by group count, first pending time, or latest pending time."""
        second = self.create_review("Second reported review")
        third = self.create_review("Third reported review")
        second_report = self.create_report(second, ReviewReport.ReportType.SPAM)
        third_report = self.create_report(third, ReviewReport.ReportType.OTHER)
        extra = self.create_report(third, ReviewReport.ReportType.ABUSE)
        now = timezone.now()
        for report, age in (
            (self.report, 3),
            (second_report, 2),
            (third_report, 1),
            (extra, 0),
        ):
            ReviewReport.objects.filter(pk=report.pk).update(
                RREP_CREATED_AT=now - timedelta(days=age),
            )
        list_url = reverse("admin-reported-review-list")
        expected = {
            "most_reported": third.pk,
            "oldest": self.review.pk,
            "newest": third.pk,
        }
        for ordering, review_id in expected.items():
            with self.subTest(ordering=ordering):
                response = self.client.get(list_url, {"ordering": ordering})
                self.assertEqual(response.data["data"]["items"][0]["id"], review_id)

    def test_dismiss_refreshes_group_and_attention(self):
        """Existing rejection removes one report and recalculates attention."""
        self.create_report(self.review, ReviewReport.ReportType.SPAM)
        self.create_report(self.review, ReviewReport.ReportType.OTHER)
        self.review.refresh_from_db()
        self.assertTrue(self.review.REVW_IS_REPORT_FLAGGED)

        decision = self.client.post(
            reverse("admin-review-report-reject", args=[self.report.pk]),
            {"admin_notes": "No violation found after inspecting the review."},
        )
        self.assertEqual(decision.status_code, 200)
        self.review.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.PUBLISHED)
        self.assertFalse(self.review.REVW_IS_REPORT_FLAGGED)
        detail = self.client.get(
            reverse("admin-reported-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(detail["pending_report_count"], 2)
        self.assertFalse(detail["needs_attention"])
        self.assertEqual(detail["reports"][-1]["status"], "rejected")
        filtered = self.client.get(
            reverse("admin-reported-review-list"),
            {"reason": "abuse"},
        )
        self.assertEqual(filtered.data["data"]["items"], [])

    def test_confirm_keeps_pending_sibling_group_after_rejection(self):
        """Canonical approval rejects the review while siblings remain pending."""
        sibling = self.create_report(self.review, ReviewReport.ReportType.SPAM)
        decision = self.client.post(
            reverse("admin-review-report-approve", args=[self.report.pk]),
            {"admin_notes": "Confirmed violation after reviewing the content."},
        )
        self.assertEqual(decision.status_code, 200)
        self.review.refresh_from_db()
        sibling.refresh_from_db()
        self.assertEqual(self.review.REVW_STATUS, Review.ReviewStatus.REJECTED)
        self.assertEqual(sibling.RREP_STATUS, ReviewReport.ReportStatus.PENDING)
        detail = self.client.get(
            reverse("admin-reported-review-detail", args=[self.review.pk]),
        ).data["data"]
        self.assertEqual(detail["status"], "rejected")
        self.assertEqual(detail["pending_report_count"], 1)
        queue_response = self.client.get(
            reverse("admin-reported-review-list"),
        )
        self.assertEqual(
            queue_response.data["data"]["pagination"]["total_items"],
            1,
        )

        self.client.post(
            reverse("admin-review-report-reject", args=[sibling.pk]),
            {"admin_notes": "This remaining report was not independently supported."},
        )
        queue_response = self.client.get(
            reverse("admin-reported-review-list"),
        )
        self.assertEqual(queue_response.data["data"]["items"], [])
        self.assertEqual(
            self.client.get(
                reverse("admin-reported-review-detail", args=[self.review.pk]),
            ).status_code,
            404,
        )
