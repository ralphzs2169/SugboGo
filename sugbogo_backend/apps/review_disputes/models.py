from django.db import models

from apps.business.models import Business
from apps.reviews.models import Review
from apps.users.models import User


class MerchantReviewDispute(models.Model):
    """Represents a merchant's request to have an explorer review investigated."""

    class DisputeStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        UPHELD = "upheld", "Upheld"
        DISMISSED = "dismissed", "Dismissed"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class DisputeReason(models.TextChoices):
        FAKE_REVIEW = (
            "fake_review",
            "Fake or non-genuine review",
        )

        ABUSIVE_CONTENT = (
            "abusive_content",
            "Abusive or inappropriate content",
        )

        MISLEADING_INFORMATION = (
            "misleading_information",
            "False or materially misleading information",
        )

        CONFLICT_OF_INTEREST = (
            "conflict_of_interest",
            "Conflict of interest",
        )

        WRONG_BUSINESS = (
            "wrong_business",
            "Review is about another business or unrelated experience",
        )

        OTHER = (
            "other",
            "Other",
        )

    MRDSP_ID = models.AutoField(
        primary_key=True,
    )

    REVW_ID = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name="merchant_disputes",
        db_column="REVW_ID",
    )

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="review_disputes",
        db_column="BUSN_ID",
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="merchant_review_disputes",
        db_column="USER_ID",
    )

    MRDSP_REASON = models.CharField(
        max_length=30,
        choices=DisputeReason.choices,
    )

    MRDSP_DESCRIPTION = models.TextField(
        max_length=2000,
    )

    MRDSP_STATUS = models.CharField(
        max_length=20,
        choices=DisputeStatus.choices,
        default=DisputeStatus.PENDING,
    )

    MRDSP_ADMIN_NOTES = models.TextField(
        blank=True,
        null=True,
    )

    MRDSP_RESOLVED_AT = models.DateTimeField(
        blank=True,
        null=True,
    )

    MRDSP_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    MRDSP_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "MERCHANT_REVIEW_DISPUTE"
        ordering = ["-MRDSP_CREATED_AT"]  # noqa: RUF012
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=["REVW_ID"],
                condition=models.Q(
                    MRDSP_STATUS="pending",
                ),
                name="unique_active_dispute_per_review",
            ),
        ]

    def __str__(self):
        return f"Dispute {self.MRDSP_ID} for Review {self.REVW_ID_id}"
    

class MerchantReviewDisputeEvidence(models.Model):
    """Stores evidence submitted in support of a merchant review dispute."""

    class EvidenceType(models.TextChoices):
        IMAGE = "image", "Image"
        DOCUMENT = "document", "Document"

    MRDSE_ID = models.AutoField(
        primary_key=True,
    )

    MRDSP_ID = models.ForeignKey(
        MerchantReviewDispute,
        on_delete=models.CASCADE,
        related_name="evidence",
        db_column="MRDSP_ID",
    )

    MRDSE_TYPE = models.CharField(
        max_length=20,
        choices=EvidenceType.choices,
    )

    MRDSE_FILE_NAME = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    MRDSE_URL = models.URLField(
        max_length=1000,
    )

    MRDSE_PUBLIC_ID = models.CharField(
        max_length=255,
    )

    MRDSE_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "MERCHANT_REVIEW_DISPUTE_EVIDENCE"
        ordering = ["MRDSE_CREATED_AT"]  # noqa: RUF012

    def __str__(self):
        return f"Evidence {self.MRDSE_ID} for Dispute {self.MRDSP_ID_id}"
