from apps.business.models import Business, Category, Cluster, Location
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


class ManageReviewDisputeViewTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            email="moderation-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="Moderator",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.super_admin = User.objects.create_user(
            email="moderation-super-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Super",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.merchant = User.objects.create_user(
            email="moderation-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.other_merchant = User.objects.create_user(
            email="other-moderation-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="moderation-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food",
            CLUS_DESCRIPTION="Food businesses",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants",
            CLUS_ID=self.cluster,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Moderation Business",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="This is a moderation test review.",
        )

        self.client.force_authenticate(
            user=self.admin,
        )

    def create_merchant(self):
        merchant_number = User.objects.filter(
            USER_ROLE=User.UserRole.MERCHANT,
        ).count()

        return User.objects.create_user(
            email=f"test-merchant-{merchant_number}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Test",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def create_explorer(self):
        explorer_number = User.objects.filter(
            USER_ROLE=User.UserRole.EXPLORER,
        ).count()

        return User.objects.create_user(
            email=f"test-explorer-{explorer_number}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Test",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def create_review(
        self,
        *,
        merchant=None,
        text="Another moderation test review.",
    ):
        merchant = merchant or self.create_merchant()

        business_number = Business.objects.count() + 1

        business = Business.objects.create(
            BUSN_NAME=f"Business {business_number}",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        review = Review.objects.create(
            USER_ID=self.create_explorer(),
            BUSN_ID=business,
            REVW_TEXT=text,
        )

        return review

    def create_dispute(
        self,
        *,
        review=None,
        merchant=None,
        reason=None,
        description="Test dispute description.",
        dispute_status=None,
    ):
        review = review or self.review
        merchant = merchant or review.BUSN_ID.USER_ID
        reason = (
            reason
            or MerchantReviewDispute.DisputeReason.FAKE_REVIEW
        )
        dispute_status = (
            dispute_status
            or MerchantReviewDispute.DisputeStatus.PENDING
        )

        return MerchantReviewDispute.objects.create(
            REVW_ID=review,
            BUSN_ID=review.BUSN_ID,
            USER_ID=merchant,
            MRDSP_REASON=reason,
            MRDSP_DESCRIPTION=description,
            MRDSP_STATUS=dispute_status,
        )

    def list_url(self):
        return reverse("admin-review-dispute-list")

    def detail_url(self, dispute_id):
        return reverse(
            "admin-review-dispute-detail",
            kwargs={"dispute_id": dispute_id},
        )

    def start_review_url(self, dispute_id):
        return reverse(
            "admin-review-dispute-start-review",
            kwargs={"dispute_id": dispute_id},
        )

    def uphold_url(self, dispute_id):
        return reverse(
            "admin-review-dispute-uphold",
            kwargs={"dispute_id": dispute_id},
        )

    def dismiss_url(self, dispute_id):
        return reverse(
            "admin-review-dispute-dismiss",
            kwargs={"dispute_id": dispute_id},
        )


class AdminReviewDisputeListViewTests(ManageReviewDisputeViewTestBase):
    def test_list_returns_successfully(self):
        dispute = self.create_dispute()

        response = self.client.get(
            self.list_url(),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertIn(
            "data",
            response.data,
        )

        self.assertIn(
            "items",
            response.data["data"],
        )

        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(
            dispute.MRDSP_ID,
            returned_ids,
        )

    def test_list_returns_empty_result_when_no_disputes_exist(self):
        response = self.client.get(
            self.list_url(),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertEqual(
            response.data["data"]["items"],
            [],
        )

    def test_list_filters_by_status(self):
        pending_dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        under_review_dispute = self.create_dispute(
            review=self.create_review(),
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.get(
            self.list_url(),
            {"status": MerchantReviewDispute.DisputeStatus.PENDING},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(
            pending_dispute.MRDSP_ID,
            returned_ids,
        )

        self.assertNotIn(
            under_review_dispute.MRDSP_ID,
            returned_ids,
        )

    def test_list_filters_by_reason(self):
        fake_review_dispute = self.create_dispute(
            reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
        )

        abusive_dispute = self.create_dispute(
            review=self.create_review(),
            reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
        )

        response = self.client.get(
            self.list_url(),
            {
                "reason": MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(
            fake_review_dispute.MRDSP_ID,
            returned_ids,
        )

        self.assertNotIn(
            abusive_dispute.MRDSP_ID,
            returned_ids,
        )

    def test_list_filters_by_business(self):
        first_dispute = self.create_dispute()

        second_review = self.create_review()

        second_dispute = self.create_dispute(
            review=second_review,
        )

        response = self.client.get(
            self.list_url(),
            {
                "business": self.business.BUSN_ID,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(
            first_dispute.MRDSP_ID,
            returned_ids,
        )

        self.assertNotIn(
            second_dispute.MRDSP_ID,
            returned_ids,
        )

    def test_list_filters_by_review(self):
        first_dispute = self.create_dispute()

        second_review = self.create_review()

        second_dispute = self.create_dispute(
            review=second_review,
        )

        response = self.client.get(
            self.list_url(),
            {
                "review": self.review.REVW_ID,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(
            first_dispute.MRDSP_ID,
            returned_ids,
        )

        self.assertNotIn(
            second_dispute.MRDSP_ID,
            returned_ids,
        )

    def test_list_supports_created_at_ordering(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.create_review(),
        )

        response = self.client.get(
            self.list_url(),
            {"ordering": "created_at"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = [
            item["id"]
            for item in response.data["data"]["items"]
        ]

        self.assertEqual(
            returned_ids,
            [
                first_dispute.MRDSP_ID,
                second_dispute.MRDSP_ID,
            ],
        )

    def test_list_supports_descending_created_at_ordering(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.create_review(),
        )

        response = self.client.get(
            self.list_url(),
            {"ordering": "-created_at"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = [
            item["id"]
            for item in response.data["data"]["items"]
        ]

        self.assertEqual(
            returned_ids,
            [
                second_dispute.MRDSP_ID,
                first_dispute.MRDSP_ID,
            ],
        )

    def test_list_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            self.list_url(),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
            response.data,
        )

    def test_list_rejects_merchant_role(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        response = self.client.get(
            self.list_url(),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )

    def test_list_allows_super_admin_role(self):
        self.client.force_authenticate(
            user=self.super_admin,
        )

        dispute = self.create_dispute()

        response = self.client.get(
            self.list_url(),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = {
            item["id"]
            for item in response.data["data"]["items"]
        }

        self.assertIn(
            dispute.MRDSP_ID,
            returned_ids,
        )


class AdminReviewDisputeDetailViewTests(ManageReviewDisputeViewTestBase):
    def test_get_dispute_successfully(self):
        dispute = self.create_dispute()

        response = self.client.get(
            self.detail_url(dispute.MRDSP_ID),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review dispute retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"]["id"],
            dispute.MRDSP_ID,
        )

    def test_get_dispute_rejects_nonexistent_dispute(self):
        response = self.client.get(
            self.detail_url(999999),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

        self.assertFalse(
            response.data["success"],
        )

    def test_get_dispute_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            self.detail_url(1),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
            response.data,
        )

    def test_get_dispute_rejects_non_admin_role(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        dispute = self.create_dispute()

        response = self.client.get(
            self.detail_url(dispute.MRDSP_ID),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )


class AdminReviewDisputeStartReviewViewTests(ManageReviewDisputeViewTestBase):
    def test_start_review_successfully(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        response = self.client.post(
            self.start_review_url(dispute.MRDSP_ID),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review dispute is now under review.",
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

    def test_start_review_rejects_non_pending_dispute(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.start_review_url(dispute.MRDSP_ID),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

    def test_start_review_rejects_nonexistent_dispute(self):
        response = self.client.post(
            self.start_review_url(999999),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

    def test_start_review_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.start_review_url(1),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
            response.data,
        )

    def test_start_review_rejects_merchant_role(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        dispute = self.create_dispute()

        response = self.client.post(
            self.start_review_url(dispute.MRDSP_ID),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )


class AdminReviewDisputeUpholdViewTests(ManageReviewDisputeViewTestBase):
    def test_uphold_dispute_successfully(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.uphold_url(dispute.MRDSP_ID),
            {
                "admin_notes": "Review violates the platform policy.",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review dispute upheld successfully.",
        )

        dispute.refresh_from_db()
        self.review.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        self.assertEqual(
            dispute.MRDSP_ADMIN_NOTES,
            "Review violates the platform policy.",
        )

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.REJECTED,
        )

    def test_uphold_dispute_without_admin_notes(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.uphold_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        self.assertIsNone(
            dispute.MRDSP_ADMIN_NOTES,
        )

    def test_uphold_rejects_pending_dispute(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        response = self.client.post(
            self.uphold_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        dispute.refresh_from_db()
        self.review.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.PENDING,
        )

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )

    def test_uphold_rejects_already_resolved_dispute(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        response = self.client.post(
            self.uphold_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

    def test_uphold_rejects_nonexistent_dispute(self):
        response = self.client.post(
            self.uphold_url(999999),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

    def test_uphold_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.uphold_url(1),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
            response.data,
        )

    def test_uphold_rejects_merchant_role(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.uphold_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )


class AdminReviewDisputeDismissViewTests(ManageReviewDisputeViewTestBase):
    def test_dismiss_dispute_successfully(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.dismiss_url(dispute.MRDSP_ID),
            {
                "admin_notes": "The dispute does not provide sufficient evidence.",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review dispute dismissed successfully.",
        )

        dispute.refresh_from_db()
        self.review.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        self.assertEqual(
            dispute.MRDSP_ADMIN_NOTES,
            "The dispute does not provide sufficient evidence.",
        )

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )

    def test_dismiss_dispute_without_admin_notes(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.dismiss_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        self.assertIsNone(
            dispute.MRDSP_ADMIN_NOTES,
        )

    def test_dismiss_rejects_pending_dispute(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        response = self.client.post(
            self.dismiss_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.PENDING,
        )

    def test_dismiss_rejects_already_resolved_dispute(self):
        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        response = self.client.post(
            self.dismiss_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

    def test_dismiss_rejects_nonexistent_dispute(self):
        response = self.client.post(
            self.dismiss_url(999999),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

    def test_dismiss_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.dismiss_url(1),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
            response.data,
        )

    def test_dismiss_rejects_merchant_role(self):
        self.client.force_authenticate(
            user=self.merchant,
        )

        dispute = self.create_dispute(
            dispute_status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        response = self.client.post(
            self.dismiss_url(dispute.MRDSP_ID),
            {},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )