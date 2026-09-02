from datetime import timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.moderation.services.manage_review_dispute_service import (
    ManageReviewDisputeService,
)
from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.users.models import User


class ManageReviewDisputeServiceTests(TestCase):
    """Tests for administrator-facing review dispute moderation."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="moderation-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.second_merchant = User.objects.create_user(
            email="moderation-merchant-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
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

        self.second_explorer = User.objects.create_user(
            email="moderation-explorer-2@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
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

        self.second_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9000,
                10.3200,
                srid=4326,
            ),
            LOCT_ADDRESS="Colon Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.business = Business.objects.create(
            BUSN_NAME="Moderation Business",
            BUSN_DESCRIPTION="A business for moderation tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        self.second_business = Business.objects.create(
            BUSN_NAME="Second Moderation Business",
            BUSN_DESCRIPTION="Another business for moderation tests.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.second_merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.second_location,
        )

        self.review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT="This is a moderation test review.",
        )

        self.second_review = Review.objects.create(
            USER_ID=self.second_explorer,
            BUSN_ID=self.second_business,
            REVW_TEXT="Another moderation test review.",
        )

    def create_dispute(
        self,
        review=None,
        business=None,
        merchant=None,
        reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
        status=MerchantReviewDispute.DisputeStatus.PENDING,
        description="Test dispute.",
    ):
        review = review or self.review
        business = business or review.BUSN_ID
        merchant = merchant or business.USER_ID

        return MerchantReviewDispute.objects.create(
            REVW_ID=review,
            BUSN_ID=business,
            USER_ID=merchant,
            MRDSP_REASON=reason,
            MRDSP_DESCRIPTION=description,
            MRDSP_STATUS=status,
        )

    # list_disputes

    def test_list_disputes_returns_all_disputes(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(),
        )

        self.assertEqual(
            {dispute.MRDSP_ID for dispute in disputes},
            {
                first_dispute.MRDSP_ID,
                second_dispute.MRDSP_ID,
            },
        )

    def test_list_disputes_filters_by_status(self):
        pending_dispute = self.create_dispute()

        under_review_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [under_review_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            pending_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_filters_by_reason(self):
        fake_review_dispute = self.create_dispute()

        abusive_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                reason=MerchantReviewDispute.DisputeReason.ABUSIVE_CONTENT,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [abusive_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            fake_review_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_filters_by_business(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                business_id=self.business.BUSN_ID,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [first_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            second_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_filters_by_review(self):
        first_dispute = self.create_dispute()

        second_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                review_id=self.review.REVW_ID,
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [first_dispute.MRDSP_ID],
        )

        self.assertNotIn(
            second_dispute.MRDSP_ID,
            [dispute.MRDSP_ID for dispute in disputes],
        )

    def test_list_disputes_orders_by_created_at_descending_by_default(self):
        older_dispute = self.create_dispute()

        older_dispute.MRDSP_CREATED_AT = (
            timezone.now() - timedelta(days=2)
        )
        older_dispute.save(
            update_fields=["MRDSP_CREATED_AT"],
        )

        newer_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [
                newer_dispute.MRDSP_ID,
                older_dispute.MRDSP_ID,
            ],
        )

    def test_list_disputes_supports_created_at_ascending_order(self):
        older_dispute = self.create_dispute()

        older_dispute.MRDSP_CREATED_AT = (
            timezone.now() - timedelta(days=2)
        )
        older_dispute.save(
            update_fields=["MRDSP_CREATED_AT"],
        )

        newer_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                ordering="created_at",
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [
                older_dispute.MRDSP_ID,
                newer_dispute.MRDSP_ID,
            ],
        )

    def test_list_disputes_supports_status_ordering(self):
        pending_dispute = self.create_dispute()

        under_review_dispute = self.create_dispute(
            review=self.second_review,
            business=self.second_business,
            merchant=self.second_merchant,
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        disputes = list(
            ManageReviewDisputeService.list_disputes(
                ordering="status",
            ),
        )

        self.assertEqual(
            [dispute.MRDSP_ID for dispute in disputes],
            [
                pending_dispute.MRDSP_ID,
                under_review_dispute.MRDSP_ID,
            ],
        )

    # get_dispute

    def test_get_dispute_returns_requested_dispute(self):
        dispute = self.create_dispute()

        result = ManageReviewDisputeService.get_dispute(
            dispute.MRDSP_ID,
        )

        self.assertEqual(
            result.MRDSP_ID,
            dispute.MRDSP_ID,
        )

    def test_get_dispute_raises_not_found_for_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.get_dispute(999999)

    # start_review

    def test_start_review_changes_pending_dispute_to_under_review(self):
        dispute = self.create_dispute()

        result = ManageReviewDisputeService.start_review(
            dispute.MRDSP_ID,
        )

        self.assertEqual(
            result.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

    def test_start_review_rejects_non_pending_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only pending review disputes can be started.",
        ):
            ManageReviewDisputeService.start_review(
                dispute.MRDSP_ID,
            )

    def test_start_review_rejects_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.start_review(999999)

    # uphold_dispute

    def test_uphold_dispute_rejects_review(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        ManageReviewDisputeService.uphold_dispute(
            dispute.MRDSP_ID,
            "Violates policy.",
        )

        dispute.refresh_from_db()
        self.review.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        self.assertEqual(
            dispute.MRDSP_ADMIN_NOTES,
            "Violates policy.",
        )

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.REJECTED,
        )

    def test_uphold_dispute_allows_empty_admin_notes(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        ManageReviewDisputeService.uphold_dispute(
            dispute.MRDSP_ID,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        self.assertIsNone(
            dispute.MRDSP_ADMIN_NOTES,
        )

    def test_uphold_dispute_sets_resolution_timestamp(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        before = timezone.now()

        ManageReviewDisputeService.uphold_dispute(
            dispute.MRDSP_ID,
        )

        after = timezone.now()

        dispute.refresh_from_db()

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertGreaterEqual(
            dispute.MRDSP_RESOLVED_AT,
            before,
        )

        self.assertLessEqual(
            dispute.MRDSP_RESOLVED_AT,
            after,
        )

    def test_uphold_dispute_rejects_pending_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only disputes under review can be upheld.",
        ):
            ManageReviewDisputeService.uphold_dispute(
                dispute.MRDSP_ID,
            )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )

    def test_uphold_dispute_rejects_already_resolved_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only disputes under review can be upheld.",
        ):
            ManageReviewDisputeService.uphold_dispute(
                dispute.MRDSP_ID,
            )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )

    def test_uphold_dispute_raises_not_found_for_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.uphold_dispute(
                999999,
            )

    # dismiss_dispute

    def test_dismiss_dispute_changes_status(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        result = ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
        )

        self.assertEqual(
            result.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.DISMISSED,
        )

    def test_dismiss_dispute_stores_admin_notes(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
            "Insufficient evidence.",
        )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_ADMIN_NOTES,
            "Insufficient evidence.",
        )

    def test_dismiss_dispute_sets_resolution_timestamp(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        before = timezone.now()

        ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
        )

        after = timezone.now()

        dispute.refresh_from_db()

        self.assertIsNotNone(
            dispute.MRDSP_RESOLVED_AT,
        )

        self.assertGreaterEqual(
            dispute.MRDSP_RESOLVED_AT,
            before,
        )

        self.assertLessEqual(
            dispute.MRDSP_RESOLVED_AT,
            after,
        )

    def test_dismiss_dispute_does_not_modify_review_status(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UNDER_REVIEW,
        )

        ManageReviewDisputeService.dismiss_dispute(
            dispute.MRDSP_ID,
        )

        self.review.refresh_from_db()

        self.assertEqual(
            self.review.REVW_STATUS,
            Review.ReviewStatus.PUBLISHED,
        )

    def test_dismiss_dispute_rejects_pending_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.PENDING,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only disputes under review can be dismissed.",
        ):
            ManageReviewDisputeService.dismiss_dispute(
                dispute.MRDSP_ID,
            )

    def test_dismiss_dispute_rejects_already_upheld_dispute(self):
        dispute = self.create_dispute(
            status=MerchantReviewDispute.DisputeStatus.UPHELD,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only disputes under review can be dismissed.",
        ):
            ManageReviewDisputeService.dismiss_dispute(
                dispute.MRDSP_ID,
            )

    def test_dismiss_dispute_raises_not_found_for_missing_dispute(self):
        with self.assertRaisesMessage(
            NotFound,
            "The review dispute could not be found.",
        ):
            ManageReviewDisputeService.dismiss_dispute(
                999999,
            )