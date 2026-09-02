from io import BytesIO
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.review_disputes.models import (
    MerchantReviewDispute,
    MerchantReviewDisputeEvidence,
)
from apps.review_disputes.services.review_dispute_service import (
    ReviewDisputeService,
)
from apps.reviews.models import Review
from apps.users.models import User


class MerchantReviewDisputeViewTestBase(APITestCase):
    """Shared setup and helpers for merchant review dispute API tests."""

    def setUp(self):
        self.merchant = User.objects.create_user(
            email="merchant-dispute@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.other_merchant = User.objects.create_user(
            email="other-merchant-dispute@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.explorer = User.objects.create_user(
            email="explorer-dispute@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
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
            USER_ID=self.explorer,
            BUSN_ID=self.business,
            REVW_TEXT=(
                "This review contains enough text for a valid "
                "review dispute test."
            ),
        )

        self.client.force_authenticate(
            self.merchant,
        )

    @staticmethod
    def create_test_image(
        filename="evidence.jpg",
        width=100,
        height=100,
    ):
        """Create a valid in-memory JPEG for multipart upload tests."""

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

    def create_dispute(
        self,
        user=None,
        review=None,
    ):
        return ReviewDisputeService.create_dispute(
            user=user or self.merchant,
            review_id=(
                review.REVW_ID
                if review
                else self.review.REVW_ID
            ),
            reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            description=(
                "The reviewer did not visit our business "
                "and the review appears to be fraudulent."
            ),
        )

    def create_evidence(
        self,
        dispute,
        evidence_type=(
            MerchantReviewDisputeEvidence.EvidenceType.IMAGE
        ),
        public_id="evidence-existing",
    ):
        return MerchantReviewDisputeEvidence.objects.create(
            MRDSP_ID=dispute,
            MRDSE_TYPE=evidence_type,
            MRDSE_URL=(
                "https://res.cloudinary.com/example/"
                "evidence.jpg"
            ),
            MRDSE_PUBLIC_ID=public_id,
        )


class MerchantReviewDisputeListViewTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests for listing merchant-owned review disputes."""

    def setUp(self):
        super().setUp()

        self.list_url = "/api/merchant/review-disputes/"

    def test_list_returns_owned_disputes(self):
        first_dispute = self.create_dispute()

        response = self.client.get(
            self.list_url,
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
            "Success.",
        )

        self.assertEqual(
            len(response.data["data"]["items"]),
            1,
        )

        self.assertEqual(
            response.data["data"]["items"][0]["id"],
            first_dispute.MRDSP_ID,
        )

    def test_list_does_not_return_other_merchants_disputes(self):
        first_dispute = self.create_dispute()

        other_business = Business.objects.create(
            BUSN_NAME="Other Business",
            BUSN_DESCRIPTION="Another business.",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.other_merchant,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

        other_review = Review.objects.create(
            USER_ID=self.explorer,
            BUSN_ID=other_business,
            REVW_TEXT="Another valid review.",
        )

        ReviewDisputeService.create_dispute(
            user=self.other_merchant,
            review_id=other_review.REVW_ID,
            reason=MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
            description="Another dispute.",
        )

        response = self.client.get(
            self.list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        returned_ids = {
            dispute["id"]
            for dispute in response.data["data"]["items"]
        }

        self.assertEqual(
            returned_ids,
            {first_dispute.MRDSP_ID},
        )

    def test_list_returns_empty_result_when_merchant_has_no_disputes(
        self,
    ):
        response = self.client.get(
            self.list_url,
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

    def test_list_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            self.list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_list_requires_merchant_role(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.get(
            self.list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


class MerchantReviewDisputeCreateViewTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests for merchant review dispute creation."""

    def setUp(self):
        super().setUp()

        self.create_url = (
            f"/api/merchant/review-disputes/"
            f"review/{self.review.REVW_ID}/"
        )

    def valid_payload(self):
        return {
            "reason": (
                MerchantReviewDispute.DisputeReason.FAKE_REVIEW
            ),
            "description": (
                "The reviewer did not visit our business "
                "and the review appears to be fraudulent."
            ),
        }

    def test_create_dispute_successfully(self):
        response = self.client.post(
            self.create_url,
            self.valid_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Review dispute submitted successfully.",
        )

        dispute = MerchantReviewDispute.objects.get(
            MRDSP_ID=response.data["data"]["id"],
        )

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

        self.assertEqual(
            dispute.MRDSP_REASON,
            MerchantReviewDispute.DisputeReason.FAKE_REVIEW,
        )

        self.assertEqual(
            dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.PENDING,
        )

    def test_create_dispute_rejects_duplicate_active_dispute(self):
        self.create_dispute()

        response = self.client.post(
            self.create_url,
            self.valid_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "An active dispute already exists for this review.",
        )

        self.assertEqual(
            MerchantReviewDispute.objects.filter(
                REVW_ID=self.review,
                USER_ID=self.merchant,
            ).count(),
            1,
        )

    def test_create_dispute_rejects_invalid_reason(self):
        payload = self.valid_payload()
        payload["reason"] = "invalid-reason"

        response = self.client.post(
            self.create_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "reason",
            response.data["errors"],
        )

        self.assertFalse(
            MerchantReviewDispute.objects.exists(),
        )

    def test_create_dispute_rejects_missing_reason(self):
        payload = self.valid_payload()
        del payload["reason"]

        response = self.client.post(
            self.create_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "reason",
            response.data["errors"],
        )

    def test_create_dispute_rejects_missing_description(self):
        payload = self.valid_payload()
        del payload["description"]

        response = self.client.post(
            self.create_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "description",
            response.data["errors"],
        )

    def test_create_dispute_rejects_empty_description(self):
        payload = self.valid_payload()
        payload["description"] = ""

        response = self.client.post(
            self.create_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

    def test_create_dispute_rejects_non_owner_merchant(self):
        self.client.force_authenticate(
            self.other_merchant,
        )

        response = self.client.post(
            self.create_url,
            self.valid_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "You do not have permission to dispute this review.",
        )

        self.assertFalse(
            MerchantReviewDispute.objects.exists(),
        )

    def test_create_dispute_rejects_nonexistent_review(self):
        url = (
            "/api/merchant/review-disputes/"
            "review/999999/"
        )

        response = self.client.post(
            url,
            self.valid_payload(),
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

    def test_create_dispute_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.create_url,
            self.valid_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertFalse(
            MerchantReviewDispute.objects.exists(),
        )

    def test_create_dispute_requires_merchant_role(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.post(
            self.create_url,
            self.valid_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertFalse(
            MerchantReviewDispute.objects.exists(),
        )


class MerchantReviewDisputeDetailViewTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests for retrieving an individual merchant dispute."""

    def setUp(self):
        super().setUp()

        self.dispute = self.create_dispute()

        self.detail_url = (
            f"/api/merchant/review-disputes/"
            f"{self.dispute.MRDSP_ID}/"
        )

    def test_get_dispute_successfully(self):
        response = self.client.get(
            self.detail_url,
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
            self.dispute.MRDSP_ID,
        )

    def test_get_dispute_rejects_non_owner(self):
        self.client.force_authenticate(
            self.other_merchant,
        )

        response = self.client.get(
            self.detail_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "You do not have permission to access this review dispute.",
        )

    def test_get_dispute_rejects_nonexistent_dispute(self):
        response = self.client.get(
            "/api/merchant/review-disputes/999999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "The review dispute could not be found.",
        )

    def test_get_dispute_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            self.detail_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_get_dispute_requires_merchant_role(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.get(
            self.detail_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


class MerchantReviewDisputeEvidenceViewTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests for adding evidence to merchant review disputes."""

    def setUp(self):
        super().setUp()

        self.dispute = self.create_dispute()

        self.evidence_url = (
            f"/api/merchant/review-disputes/"
            f"{self.dispute.MRDSP_ID}/evidence/"
        )

    @patch(
        "apps.review_disputes.views.review_dispute_view."
        "ReviewDisputeService.add_evidence",
    )
    def test_add_image_evidence_successfully(
        self,
        mock_add_evidence,
    ):
        evidence = MerchantReviewDisputeEvidence(
            MRDSE_ID=1,
            MRDSP_ID=self.dispute,
            MRDSE_TYPE=(
                MerchantReviewDisputeEvidence.EvidenceType.IMAGE
            ),
            MRDSE_URL="https://example.com/evidence.jpg",
            MRDSE_PUBLIC_ID="evidence-1",
        )

        mock_add_evidence.return_value = evidence

        image = self.create_test_image(
            "evidence.jpg",
        )

        response = self.client.post(
            self.evidence_url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Dispute evidence added successfully.",
        )

        mock_add_evidence.assert_called_once()

        call_kwargs = mock_add_evidence.call_args.kwargs

        self.assertEqual(
            call_kwargs["user"],
            self.merchant,
        )

        self.assertEqual(
            call_kwargs["dispute_id"],
            self.dispute.MRDSP_ID,
        )

        self.assertEqual(
            call_kwargs["evidence_type"],
            MerchantReviewDisputeEvidence.EvidenceType.IMAGE,
        )

        self.assertEqual(
            call_kwargs["file"].name,
            "evidence.jpg",
        )

    def test_add_evidence_rejects_missing_type(self):
        image = self.create_test_image()

        response = self.client.post(
            self.evidence_url,
            {
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "type",
            response.data["errors"],
        )

    def test_add_evidence_rejects_missing_file(self):
        response = self.client.post(
            self.evidence_url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "file",
            response.data["errors"],
        )

    def test_add_evidence_rejects_invalid_type(self):
        image = self.create_test_image()

        response = self.client.post(
            self.evidence_url,
            {
                "type": "invalid-type",
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["code"],
            "VALIDATION_ERROR",
        )

        self.assertIn(
            "type",
            response.data["errors"],
        )

    @patch(
        "apps.review_disputes.views.review_dispute_view."
        "ReviewDisputeService.add_evidence",
    )
    def test_add_document_evidence_passes_document_type_to_service(
        self,
        mock_add_evidence,
    ):
        evidence = MerchantReviewDisputeEvidence(
            MRDSE_ID=1,
            MRDSP_ID=self.dispute,
            MRDSE_TYPE=(
                MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT
            ),
            MRDSE_URL="https://example.com/document.pdf",
            MRDSE_PUBLIC_ID="document-1",
        )

        mock_add_evidence.return_value = evidence

        document = SimpleUploadedFile(
            "evidence.pdf",
            b"valid-test-document",
            content_type="application/pdf",
        )

        response = self.client.post(
            self.evidence_url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT
                ),
                "file": document,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        call_kwargs = mock_add_evidence.call_args.kwargs

        self.assertEqual(
            call_kwargs["evidence_type"],
            MerchantReviewDisputeEvidence.EvidenceType.DOCUMENT,
        )

        self.assertEqual(
            call_kwargs["file"].name,
            "evidence.pdf",
        )

    def test_add_evidence_rejects_nonexistent_dispute(self):
        url = (
            "/api/merchant/review-disputes/"
            "999999/evidence/"
        )

        image = self.create_test_image()

        response = self.client.post(
            url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "The review dispute could not be found.",
        )

    def test_add_evidence_rejects_non_owner(self):
        self.client.force_authenticate(
            self.other_merchant,
        )

        image = self.create_test_image()

        response = self.client.post(
            self.evidence_url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )

    def test_add_evidence_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        image = self.create_test_image()

        response = self.client.post(
            self.evidence_url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_add_evidence_requires_merchant_role(self):
        self.client.force_authenticate(
            self.explorer,
        )

        image = self.create_test_image()

        response = self.client.post(
            self.evidence_url,
            {
                "type": (
                    MerchantReviewDisputeEvidence.EvidenceType.IMAGE
                ),
                "file": image,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


class MerchantReviewDisputeWithdrawViewTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests for withdrawing merchant review disputes."""

    def setUp(self):
        super().setUp()

        self.dispute = self.create_dispute()

        self.withdraw_url = (
            f"/api/merchant/review-disputes/"
            f"{self.dispute.MRDSP_ID}/withdraw/"
        )

    def test_withdraw_dispute_successfully(self):
        response = self.client.post(
            self.withdraw_url,
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
            "Review dispute withdrawn successfully.",
        )

        self.dispute.refresh_from_db()

        self.assertEqual(
            self.dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.WITHDRAWN,
        )

        self.assertIsNotNone(
            self.dispute.MRDSP_RESOLVED_AT,
        )

    def test_withdraw_dispute_preserves_record(self):
        response = self.client.post(
            self.withdraw_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            MerchantReviewDispute.objects.filter(
                MRDSP_ID=self.dispute.MRDSP_ID,
            ).exists(),
        )

    def test_withdraw_dispute_rejects_non_owner(self):
        self.client.force_authenticate(
            self.other_merchant,
        )

        response = self.client.post(
            self.withdraw_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )

        self.dispute.refresh_from_db()

        self.assertEqual(
            self.dispute.MRDSP_STATUS,
            MerchantReviewDispute.DisputeStatus.PENDING,
        )

    def test_withdraw_dispute_rejects_nonexistent_dispute(self):
        response = self.client.post(
            "/api/merchant/review-disputes/"
            "999999/withdraw/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "The review dispute could not be found.",
        )

    def test_withdraw_dispute_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.post(
            self.withdraw_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_withdraw_dispute_requires_merchant_role(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.post(
            self.withdraw_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_withdraw_dispute_rejects_already_withdrawn_dispute(
        self,
    ):
        ReviewDisputeService.withdraw_dispute(
            self.merchant,
            self.dispute.MRDSP_ID,
        )

        response = self.client.post(
            self.withdraw_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "Only an active review dispute can be withdrawn.",
        )


class MerchantReviewDisputeEvidenceDetailViewTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests for deleting individual dispute evidence."""

    def setUp(self):
        super().setUp()

        self.dispute = self.create_dispute()

        self.evidence = self.create_evidence(
            self.dispute,
            public_id="evidence-delete-1",
        )

        self.delete_url = (
            f"/api/merchant/review-disputes/"
            f"evidence/{self.evidence.MRDSE_ID}/"
        )

    @patch(
        "apps.review_disputes.services.review_dispute_service."
        "CloudinaryService.delete_image",
    )
    def test_delete_evidence_successfully(
        self,
        mock_delete_image,
    ):
        response = self.client.delete(
            self.delete_url,
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
            "Dispute evidence deleted successfully.",
        )

        self.assertFalse(
            MerchantReviewDisputeEvidence.objects.filter(
                MRDSE_ID=self.evidence.MRDSE_ID,
            ).exists(),
        )

        mock_delete_image.assert_called_once_with(
            "evidence-delete-1",
        )

    def test_delete_evidence_rejects_nonexistent_evidence(self):
        response = self.client.delete(
            "/api/merchant/review-disputes/"
            "evidence/999999/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
            response.data,
        )

        self.assertEqual(
            response.data["message"],
            "The dispute evidence could not be found.",
        )

    def test_delete_evidence_rejects_other_merchant(self):
        self.client.force_authenticate(
            self.other_merchant,
        )

        response = self.client.delete(
            self.delete_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
            response.data,
        )

        self.assertTrue(
            MerchantReviewDisputeEvidence.objects.filter(
                MRDSE_ID=self.evidence.MRDSE_ID,
            ).exists(),
        )

    def test_delete_evidence_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.delete(
            self.delete_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_delete_evidence_requires_merchant_role(self):
        self.client.force_authenticate(
            self.explorer,
        )

        response = self.client.delete(
            self.delete_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


class MerchantReviewDisputeEvidenceResponseTests(
    MerchantReviewDisputeViewTestBase,
):
    """Tests evidence serialization through dispute detail responses."""

    def setUp(self):
        super().setUp()

        self.dispute = self.create_dispute()

        self.evidence = self.create_evidence(
            self.dispute,
            public_id="evidence-response-1",
        )

        self.detail_url = (
            f"/api/merchant/review-disputes/"
            f"{self.dispute.MRDSP_ID}/"
        )

    def test_dispute_detail_includes_evidence(self):
        response = self.client.get(
            self.detail_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        data = response.data["data"]

        self.assertIn(
            "evidence",
            data,
        )

        self.assertEqual(
            len(data["evidence"]),
            1,
        )

        evidence = data["evidence"][0]

        self.assertEqual(
            evidence["id"],
            self.evidence.MRDSE_ID,
        )

        self.assertEqual(
            evidence["type"],
            self.evidence.MRDSE_TYPE,
        )

        self.assertEqual(
            evidence["url"],
            self.evidence.MRDSE_URL,
        )