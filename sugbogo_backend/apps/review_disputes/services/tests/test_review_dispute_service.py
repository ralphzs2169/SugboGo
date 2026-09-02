from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business, Category, Cluster, Location
from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
)
from apps.review_disputes.services.review_dispute_service import (
    ReviewDisputeService,
)
from apps.reviews.models import Review
from apps.users.models import User


class ReviewDisputeServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.other_merchant = User.objects.create_user(
            email="other-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.second_explorer = User.objects.create_user(
            email="second-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cls.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        cluster = Cluster.objects.create(
            CLUS_NAME="Food",
            CLUS_DESCRIPTION="Food",
        )

        category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Food",
            CLUS_ID=cluster,
        )

        location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Cebu",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        cls.business = Business.objects.create(
            BUSN_NAME="Test Business",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=cls.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

        cls.review = Review.objects.create(
            USER_ID=cls.explorer,
            BUSN_ID=cls.business,
            REVW_TEXT=(
                "This review contains enough text "
                "for a valid test case."
            ),
        )

    @staticmethod
    def create_image(
        filename="evidence.jpg",
        content_type="image/jpeg",
    ):
        image = Image.new(
            "RGB",
            (20, 20),
        )

        image_file = BytesIO()
        image.save(
            image_file,
            format="JPEG",
        )

        return SimpleUploadedFile(
            filename,
            image_file.getvalue(),
            content_type=content_type,
        )

    def create_dispute(self):
        return ReviewDisputeService.create_dispute(
            user=self.merchant,
            review_id=self.review.REVW_ID,
            reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            description=(
                "The reviewer did not visit our business."
            ),
        )

    def create_second_review(self):
        return Review.objects.create(
            USER_ID=self.second_explorer,
            BUSN_ID=self.business,
            REVW_TEXT="Second review for the same business.",
        )

    # Create Dispute

    def test_create_dispute_for_owned_review(self):
        dispute = self.create_dispute()

        self.assertEqual(
            dispute.REVW_ID_id,
            self.review.REVW_ID,
        )
        self.assertEqual(
            dispute.BUSN_ID_id,
            self.business.BUSN_ID,
        )
        self.assertEqual(
            dispute.USER_ID_id,
            self.merchant.USER_ID,
        )

    def test_create_dispute_defaults_to_pending(self):
        dispute = self.create_dispute()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.PENDING,
        )

    def test_create_dispute_stores_reason_and_description(self):
        dispute = self.create_dispute()

        self.assertEqual(
            dispute.MRDSP_REASON,
            MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
        )
        self.assertEqual(
            dispute.MRDSP_DESCRIPTION,
            "The reviewer did not visit our business.",
        )

    def test_create_dispute_rejects_duplicate_active_dispute(self):
        self.create_dispute()

        with self.assertRaises(ValidationError):
            self.create_dispute()

        self.assertEqual(
            MerchantReviewDispute.objects.filter(
                REVW_ID=self.review,
            ).count(),
            1,
        )

    def test_create_dispute_rejects_unrelated_merchant(self):
        with self.assertRaises(PermissionDenied):
            ReviewDisputeService.create_dispute(
                user=self.other_merchant,
                review_id=self.review.REVW_ID,
                reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
                description=(
                    "I do not own this business."
                ),
            )

    def test_create_dispute_rejects_nonexistent_review(self):
        with self.assertRaises(NotFound):
            ReviewDisputeService.create_dispute(
                user=self.merchant,
                review_id=999999,
                reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
                description="This review does not exist.",
            )

    def test_create_dispute_does_not_create_record_for_unrelated_merchant(
        self,
    ):
        with self.assertRaises(PermissionDenied):
            ReviewDisputeService.create_dispute(
                user=self.other_merchant,
                review_id=self.review.REVW_ID,
                reason=MerchantReviewDispute.DisputeReason.OTHER,
                description="Unauthorized dispute.",
            )

        self.assertFalse(
            MerchantReviewDispute.objects.filter(
                USER_ID=self.other_merchant,
            ).exists(),
        )

    # Get Dispute

    def test_get_dispute_returns_owned_dispute(self):
        dispute = self.create_dispute()

        result = ReviewDisputeService.get_dispute(
            user=self.merchant,
            dispute_id=dispute.MRDSP_ID,
        )

        self.assertEqual(
            result.MRDSP_ID,
            dispute.MRDSP_ID,
        )

    def test_get_dispute_rejects_nonexistent_dispute(self):
        with self.assertRaises(NotFound):
            ReviewDisputeService.get_dispute(
                user=self.merchant,
                dispute_id=999999,
            )

    def test_get_dispute_rejects_another_merchants_dispute(self):
        dispute = self.create_dispute()

        with self.assertRaises(PermissionDenied):
            ReviewDisputeService.get_dispute(
                user=self.other_merchant,
                dispute_id=dispute.MRDSP_ID,
            )

    # List Disputes

    def test_list_merchant_disputes_returns_only_owned_disputes(self):
        first_dispute = self.create_dispute()

        second_review = self.create_second_review()

        MerchantReviewDispute.objects.create(
            REVW_ID=second_review,
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            MRDSP_REASON=(
                MerchantReviewDispute.DisputeReason.MISLEADING_INFORMATION
            ),
            MRDSP_DESCRIPTION="The review contains misleading information.",
        )

        other_business_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9,
                10.32,
                srid=4326,
            ),
            LOCT_ADDRESS="Other Cebu",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        other_cluster = Cluster.objects.create(
            CLUS_NAME="Retail",
            CLUS_DESCRIPTION="Retail",
        )

        other_category = Category.objects.create(
            CTGRY_NAME="Retail Store",
            CTGRY_DESCRIPTION="Retail",
            CLUS_ID=other_cluster,
        )

        other_business = Business.objects.create(
            BUSN_NAME="Other Business",
            BUSN_CONTACT_NUMBER="09170000000",
            USER_ID=self.other_merchant,
            CTGRY_ID=other_category,
            LOCT_ID=other_business_location,
        )

        other_review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=other_business,
            REVW_TEXT="Another valid review.",
        )

        other_dispute = MerchantReviewDispute.objects.create(
            REVW_ID=other_review,
            BUSN_ID=other_business,
            USER_ID=self.other_merchant,
            MRDSP_REASON=(
                MerchantReviewDispute.DisputeReason.FAKE_REVIEW
            ),
            MRDSP_DESCRIPTION="Another merchant dispute.",
        )

        disputes = list(
            ReviewDisputeService.list_merchant_disputes(
                self.merchant,
            ),
        )

        dispute_ids = {
            dispute.MRDSP_ID
            for dispute in disputes
        }

        self.assertIn(
            first_dispute.MRDSP_ID,
            dispute_ids,
        )
        self.assertEqual(
            len(disputes),
            2,
        )
        self.assertNotIn(
            other_dispute.MRDSP_ID,
            dispute_ids,
        )

    def test_list_merchant_disputes_includes_evidence(self):
        dispute = self.create_dispute()

        evidence = MerchantReviewDisputeEvidence.objects.create(
            MRDSP_ID=dispute,
            MRDSE_TYPE=(
                MerchantReviewDisputeEvidence.EvidenceType.IMAGE
            ),
            MRDSE_URL="https://example.com/evidence.jpg",
            MRDSE_PUBLIC_ID="evidence-1",
        )

        disputes = list(
            ReviewDisputeService.list_merchant_disputes(
                self.merchant,
            ),
        )

        result = next(
            item
            for item in disputes
            if item.MRDSP_ID == dispute.MRDSP_ID
        )

        self.assertEqual(
            list(result.evidence.all()),
            [evidence],
        )

    # Add Evidence

    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.upload_image",
    )
    def test_add_image_evidence_stores_cloudinary_data(
        self,
        mock_upload,
    ):
        dispute = self.create_dispute()

        mock_upload.return_value = {
            "public_id": "evidence-1",
            "secure_url": (
                "https://example.com/evidence.jpg"
            ),
        }

        evidence = ReviewDisputeService.add_evidence(
            user=self.merchant,
            dispute_id=dispute.MRDSP_ID,
            evidence_type=(
                MerchantReviewDisputeEvidence.EvidenceType.IMAGE
            ),
            file=self.create_image(),
        )

        self.assertEqual(
            evidence.MRDSP_ID_id,
            dispute.MRDSP_ID,
        )
        self.assertEqual(
            evidence.MRDSE_TYPE,
            MerchantReviewDisputeEvidence.EvidenceType.IMAGE,
        )
        self.assertEqual(
            evidence.MRDSE_PUBLIC_ID,
            "evidence-1",
        )
        self.assertEqual(
            evidence.MRDSE_URL,
            "https://example.com/evidence.jpg",
        )

        mock_upload.assert_called_once_with(
            evidence.MRDSE_TYPE
            and mock_upload.call_args.args[0],
            folder="sugbogo/review-disputes",
            resource_type="image",
        )

    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.upload_image",
    )
    def test_add_document_evidence_uses_raw_resource_type(
        self,
        mock_upload,
    ):
        dispute = self.create_dispute()
        evidence_file = self.create_image(
            filename="document.jpg",
        )

        mock_upload.return_value = {
            "public_id": "document-1",
            "secure_url": (
                "https://example.com/document.jpg"
            ),
        }

        evidence = ReviewDisputeService.add_evidence(
            user=self.merchant,
            dispute_id=dispute.MRDSP_ID,
            evidence_type=(
                MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT
            ),
            file=evidence_file,
        )

        self.assertEqual(
            evidence.MRDSE_TYPE,
            MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT,
        )

        mock_upload.assert_called_once_with(
            evidence_file,
            folder="sugbogo/review-disputes",
            resource_type="raw",
        )

    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.upload_image",
    )
    def test_add_evidence_rejects_another_merchants_dispute(
        self,
        mock_upload,
    ):
        dispute = self.create_dispute()

        with self.assertRaises(PermissionDenied):
            ReviewDisputeService.add_evidence(
                user=self.other_merchant,
                dispute_id=dispute.MRDSP_ID,
                evidence_type=(
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                file=self.create_image(),
            )

        mock_upload.assert_not_called()

    def test_add_evidence_rejects_nonexistent_dispute(self):
        with self.assertRaises(NotFound):
            ReviewDisputeService.add_evidence(
                user=self.merchant,
                dispute_id=999999,
                evidence_type=(
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                file=self.create_image(),
            )

    def test_add_evidence_rejects_upheld_dispute(self):
        dispute = self.create_dispute()

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.UPHELD
        )
        dispute.save(
            update_fields=["MRDSP_STATUS"],
        )

        with self.assertRaises(ValidationError):
            ReviewDisputeService.add_evidence(
                user=self.merchant,
                dispute_id=dispute.MRDSP_ID,
                evidence_type=(
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                file=self.create_image(),
            )

    def test_add_evidence_rejects_dismissed_dispute(self):
        dispute = self.create_dispute()

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.DISMISSED
        )
        dispute.save(
            update_fields=["MRDSP_STATUS"],
        )

        with self.assertRaises(ValidationError):
            ReviewDisputeService.add_evidence(
                user=self.merchant,
                dispute_id=dispute.MRDSP_ID,
                evidence_type=(
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                file=self.create_image(),
            )

    def test_add_evidence_rejects_withdrawn_dispute(self):
        dispute = self.create_dispute()

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.WITHDRAWN
        )
        dispute.save(
            update_fields=["MRDSP_STATUS"],
        )

        with self.assertRaises(ValidationError):
            ReviewDisputeService.add_evidence(
                user=self.merchant,
                dispute_id=dispute.MRDSP_ID,
                evidence_type=(
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                file=self.create_image(),
            )

    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.delete_image",
    )
    @patch(
        "apps.review_disputes.services.review_dispute_service.MerchantReviewDisputeEvidence.objects.create",
    )
    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.upload_image",
    )
    def test_add_evidence_cleans_up_cloudinary_when_database_creation_fails(
        self,
        mock_upload,
        mock_create,
        mock_delete,
    ):
        dispute = self.create_dispute()

        mock_upload.return_value = {
            "public_id": "failed-evidence",
            "secure_url": (
                "https://example.com/failed-evidence.jpg"
            ),
        }

        mock_create.side_effect = RuntimeError(
            "Database failure",
        )

        with self.assertRaises(RuntimeError):
            ReviewDisputeService.add_evidence(
                user=self.merchant,
                dispute_id=dispute.MRDSP_ID,
                evidence_type=(
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                file=self.create_image(),
            )

        mock_delete.assert_called_once_with(
            "failed-evidence",
        )

    # Delete Evidence

    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.delete_image",
    )
    def test_delete_evidence_removes_database_record_and_cloudinary_asset(
        self,
        mock_delete,
    ):
        dispute = self.create_dispute()

        evidence = MerchantReviewDisputeEvidence.objects.create(
            MRDSP_ID=dispute,
            MRDSE_TYPE=(
                MerchantReviewDisputeEvidence.EvidenceType.IMAGE
            ),
            MRDSE_URL="https://example.com/evidence.jpg",
            MRDSE_PUBLIC_ID="evidence-1",
        )

        ReviewDisputeService.delete_evidence(
            user=self.merchant,
            evidence_id=evidence.MRDSE_ID,
        )

        self.assertFalse(
            MerchantReviewDisputeEvidence.objects.filter(
                MRDSE_ID=evidence.MRDSE_ID,
            ).exists(),
        )

        mock_delete.assert_called_once_with(
            "evidence-1",
        )

    def test_delete_evidence_rejects_nonexistent_evidence(self):
        with self.assertRaises(NotFound):
            ReviewDisputeService.delete_evidence(
                user=self.merchant,
                evidence_id=999999,
            )

    @patch(
        "apps.review_disputes.services.review_dispute_service.CloudinaryService.delete_image",
    )
    def test_delete_evidence_rejects_another_merchant(
        self,
        mock_delete,
    ):
        dispute = self.create_dispute()

        evidence = MerchantReviewDisputeEvidence.objects.create(
            MRDSP_ID=dispute,
            MRDSE_TYPE=(
                MerchantReviewDisputeEvidence.EvidenceType.IMAGE
            ),
            MRDSE_URL="https://example.com/evidence.jpg",
            MRDSE_PUBLIC_ID="evidence-1",
        )

        with self.assertRaises(PermissionDenied):
            ReviewDisputeService.delete_evidence(
                user=self.other_merchant,
                evidence_id=evidence.MRDSE_ID,
            )

        self.assertTrue(
            MerchantReviewDisputeEvidence.objects.filter(
                MRDSE_ID=evidence.MRDSE_ID,
            ).exists(),
        )

        mock_delete.assert_not_called()

    # Withdraw Dispute

    def test_withdraw_pending_dispute(self):
        dispute = self.create_dispute()

        withdrawn = ReviewDisputeService.withdraw_dispute(
            self.merchant,
            dispute.MRDSP_ID,
        )

        self.assertEqual(
            withdrawn.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.WITHDRAWN,
        )

    def test_withdraw_under_review_dispute(self):
        dispute = self.create_dispute()

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.UNDER_REVIEW
        )
        dispute.save(
            update_fields=["MRDSP_STATUS"],
        )

        withdrawn = ReviewDisputeService.withdraw_dispute(
            self.merchant,
            dispute.MRDSP_ID,
        )

        self.assertEqual(
            withdrawn.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.WITHDRAWN,
        )

    def test_withdraw_dispute_sets_resolved_at(self):
        dispute = self.create_dispute()

        withdrawn = ReviewDisputeService.withdraw_dispute(
            self.merchant,
            dispute.MRDSP_ID,
        )

        self.assertIsNotNone(
            withdrawn.MRDSP_RESOLVED_AT,
        )

    def test_withdraw_dispute_preserves_record(self):
        dispute = self.create_dispute()

        ReviewDisputeService.withdraw_dispute(
            self.merchant,
            dispute.MRDSP_ID,
        )

        self.assertTrue(
            MerchantReviewDispute.objects.filter(
                MRDSP_ID=dispute.MRDSP_ID,
            ).exists(),
        )

    def test_withdraw_dispute_rejects_nonexistent_dispute(self):
        with self.assertRaises(NotFound):
            ReviewDisputeService.withdraw_dispute(
                self.merchant,
                999999,
            )

    def test_withdraw_dispute_rejects_another_merchant(self):
        dispute = self.create_dispute()

        with self.assertRaises(PermissionDenied):
            ReviewDisputeService.withdraw_dispute(
                self.other_merchant,
                dispute.MRDSP_ID,
            )

        dispute.refresh_from_db()

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.PENDING,
        )

    def test_withdraw_dispute_rejects_upheld_dispute(self):
        dispute = self.create_dispute()

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.UPHELD
        )
        dispute.save(
            update_fields=["MRDSP_STATUS"],
        )

        with self.assertRaises(ValidationError):
            ReviewDisputeService.withdraw_dispute(
                self.merchant,
                dispute.MRDSP_ID,
            )

    def test_withdraw_dispute_rejects_dismissed_dispute(self):
        dispute = self.create_dispute()

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.DISMISSED
        )
        dispute.save(
            update_fields=["MRDSP_STATUS"],
        )

        with self.assertRaises(ValidationError):
            ReviewDisputeService.withdraw_dispute(
                self.merchant,
                dispute.MRDSP_ID,
            )

    def test_withdraw_dispute_rejects_already_withdrawn_dispute(self):
        dispute = self.create_dispute()

        ReviewDisputeService.withdraw_dispute(
            self.merchant,
            dispute.MRDSP_ID,
        )

        with self.assertRaises(ValidationError):
            ReviewDisputeService.withdraw_dispute(
                self.merchant,
                dispute.MRDSP_ID,
            )