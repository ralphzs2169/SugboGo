from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class ReviewReportViewTests(APITestCase):
    """Tests for business review report API endpoints."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-review-report@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-review-report@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_explorer = User.objects.create_user(
            email="explorer-review-report-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
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

        self.review = Review.objects.create(
            USER_ID=self.second_explorer,
            BUSN_ID=self.business,
            REVW_TEXT="Great food and excellent service.",
        )

        self.report_url = (
            f"/api/reviews/{self.review.REVW_ID}/report/"
        )

    def test_create_report_successfully(self):
        payload = {
            "report_type": ReviewReport.ReportType.SPAM,
            "installation_id": "test-device-001",
        }

        response = self.client.post(
            self.report_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Review reported successfully.",
        )

        report = ReviewReport.objects.get(
            RREP_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            report.REVW_ID_id,
            self.review.REVW_ID,
        )

        self.assertEqual(
            report.USER_ID_id,
            self.explorer.USER_ID,
        )

        self.assertEqual(
            report.RREP_TYPE,
            ReviewReport.ReportType.SPAM,
        )

        self.assertEqual(
            report.RREP_INSTALLATION_ID,
            "test-device-001",
        )

        self.assertEqual(
            response.data["data"]["review_id"],
            self.review.REVW_ID,
        )

        self.assertEqual(
            response.data["data"]["status"],
            report.RREP_STATUS,
        )
        self.assertNotIn("report_count", response.data["data"])
        self.assertNotIn("report_flagged", response.data["data"])

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_REPORT_COUNT,
            1,
        )

    def test_create_report_without_installation_id_successfully(self):
        payload = {
            "report_type": ReviewReport.ReportType.SPAM,
        }

        response = self.client.post(
            self.report_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        report = ReviewReport.objects.get(
            RREP_ID=response.data["data"]["id"],
        )

        self.assertIsNone(
            report.RREP_INSTALLATION_ID,
        )

    def test_legacy_device_id_is_accepted(self):
        """An older client can still attach its stored installation ID."""
        response = self.client.post(
            self.report_url,
            {
                "report_type": ReviewReport.ReportType.SPAM,
                "device_id": "legacy-installation",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report = ReviewReport.objects.get(pk=response.data["data"]["id"])
        self.assertEqual(report.RREP_INSTALLATION_ID, "legacy-installation")

    def test_conflicting_installation_identifiers_are_rejected(self):
        """A report cannot silently choose between two different IDs."""
        response = self.client.post(
            self.report_url,
            {
                "report_type": ReviewReport.ReportType.SPAM,
                "installation_id": "new-installation",
                "device_id": "legacy-installation",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ReviewReport.objects.exists())

    def test_create_report_rejects_invalid_report_type(self):
        payload = {
            "report_type": "invalid_report_type",
        }

        response = self.client.post(
            self.report_url,
            payload,
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
            "report_type",
            response.data["errors"],
        )

        self.assertFalse(
            ReviewReport.objects.exists(),
        )

    def test_create_report_rejects_nonexistent_review(self):
        url = "/api/reviews/999999/report/"

        payload = {
            "report_type": ReviewReport.ReportType.SPAM,
        }

        response = self.client.post(
            url,
            payload,
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
            ReviewReport.objects.exists(),
        )

    def test_author_cannot_report_own_review(self):
        """The API uses the standard validation envelope for self-reporting."""
        self.client.force_authenticate(self.second_explorer)
        response = self.client.post(
            self.report_url,
            {"report_type": ReviewReport.ReportType.SPAM},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "VALIDATION_ERROR")
        self.assertEqual(
            response.data["message"],
            "You cannot report your own review.",
        )
        self.assertFalse(ReviewReport.objects.exists())

    def test_nonpublished_review_cannot_be_reported(self):
        """Reports may be filed only while the review is public."""
        Review.objects.filter(pk=self.review.pk).update(
            REVW_STATUS=Review.ReviewStatus.UNDER_REVIEW,
        )
        response = self.client.post(
            self.report_url,
            {"report_type": ReviewReport.ReportType.ABUSE},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ReviewReport.objects.exists())

    def test_authenticated_merchant_can_report_review(self):
        self.client.force_authenticate(
            self.merchant,
        )       

        payload = {
            "report_type": ReviewReport.ReportType.SPAM,
        }

        response = self.client.post(
            self.report_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            ReviewReport.objects.filter(
                REVW_ID=self.review,
                USER_ID=self.merchant,
            ).exists(),
        )

    def test_unauthenticated_user_cannot_report_review(self):
        self.client.force_authenticate(
            user=None,
        )

        payload = {
            "report_type": ReviewReport.ReportType.SPAM,
        }

        response = self.client.post(
            self.report_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            ReviewReport.objects.exists(),
        )
