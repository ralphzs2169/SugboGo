from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.admin_operations.moderation.services.tests.test_manage_review_report_service import ReportFixtures
from apps.reviews.models import ReviewReport
from apps.users.models import User


class ManageReviewReportViewTests(ReportFixtures, TestCase):
    def setUp(self):
        """Configures report fixtures and an authenticated administrator client."""
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_queue_filters_and_paginates(self):
        response = self.client.get(reverse("admin-review-report-list"), {"status": "pending", "page_size": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(response.data["data"]["items"][0]["id"], self.report.pk)
        self.assertEqual(self.client.get(reverse("admin-review-report-list"), {"status": "approved"}).data["data"]["items"], [])

    def test_invalid_filters_are_rejected(self):
        response = self.client.get(reverse("admin-review-report-list"), {"status": "unknown", "business": "invalid"})
        self.assertEqual(response.status_code, 400)

    def test_detail_returns_evidence_and_counts_without_private_identifiers(self):
        response = self.client.get(reverse("admin-review-report-detail", args=[self.report.pk]))
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["related_report_counts"]["pending"], 1)
        self.assertEqual(data["review"]["text"], self.review.REVW_TEXT)
        self.assertNotIn("private-device", str(data))
        self.assertNotIn(self.user.USER_EMAIL, str(data))

    def test_missing_report_returns_404(self):
        self.assertEqual(self.client.get(reverse("admin-review-report-detail", args=[999999])).status_code, 404)
        self.assertEqual(self.client.post(reverse("admin-review-report-approve", args=[999999]), {"admin_notes": "Confirmed violation."}).status_code, 404)

    def test_approval_and_repeat_decision(self):
        url = reverse("admin-review-report-approve", args=[self.report.pk])
        self.assertEqual(self.client.post(url, {"admin_notes": "Confirmed abusive content."}).status_code, 200)
        self.assertEqual(self.client.post(url, {"admin_notes": "Confirmed abusive content."}).status_code, 400)

    def test_rejection_requires_notes(self):
        url = reverse("admin-review-report-reject", args=[self.report.pk])
        self.assertEqual(self.client.post(url, {}).status_code, 400)
        self.assertEqual(self.client.post(url, {"admin_notes": "No violation found after inspection."}).status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.RREP_STATUS, ReviewReport.ReportStatus.REJECTED)

    def test_non_admin_cannot_read_or_resolve_reports(self):
        merchant = User.objects.create_user(
            email="report-merchant@example.com", password=None,
            USER_FNAME="Merchant", USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT, USER_STATUS=User.UserStatus.ACTIVE,
        )
        for user in (self.user, self.second_user, merchant):
            self.client.force_authenticate(user)
            for name, args in (("admin-review-report-list", []), ("admin-review-report-detail", [self.report.pk])):
                self.assertEqual(self.client.get(reverse(name, args=args)).status_code, 403)
            for name in ("admin-review-report-approve", "admin-review-report-reject"):
                self.assertEqual(self.client.post(reverse(name, args=[self.report.pk]), {"admin_notes": "Unauthorized decision."}).status_code, 403)

    def test_anonymous_cannot_read_or_resolve(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("admin-review-report-list")).status_code, 401)
        self.assertEqual(self.client.post(reverse("admin-review-report-approve", args=[self.report.pk]), {"admin_notes": "Unauthorized decision."}).status_code, 401)

    def test_super_admin_can_resolve(self):
        self.admin.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.admin.save()
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("admin-review-report-reject", args=[self.report.pk]),
            {"admin_notes": "Inspected evidence; no violation found."},
        )
        self.assertEqual(response.status_code, 200)
