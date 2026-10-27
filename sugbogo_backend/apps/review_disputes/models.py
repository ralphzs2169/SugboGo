from django.contrib.postgres.indexes import GinIndex
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
        AUTHOR_DELETED = "author_deleted", "Review deleted by author"
        REVIEW_REMOVED = "review_removed", "Review removed"

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
        on_delete=models.SET_NULL,
        null=True,
        related_name="merchant_disputes",
        db_column="REVW_ID",
    )

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.SET_NULL,
        null=True,
        related_name="review_disputes",
        db_column="BUSN_ID",
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="merchant_review_disputes",
        db_column="USER_ID",
    )

    MRDSP_REASON = models.CharField(
        max_length=30,
        choices=DisputeReason.choices,
    )

    MRDSP_ORIGINAL_REVIEW_ID = models.PositiveBigIntegerField(db_index=True)
    MRDSP_ORIGINAL_BUSINESS_ID = models.PositiveBigIntegerField()
    MRDSP_ORIGINAL_MERCHANT_ID = models.PositiveBigIntegerField()

    MRDSP_CLOSURE_REASON = models.CharField(
        max_length=64,
        blank=True,
        default="",
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
            models.CheckConstraint(
                condition=(
                    ~models.Q(MRDSP_STATUS="pending")
                    | models.Q(REVW_ID__isnull=False)
                ),
                name="pending_dispute_has_live_review",
            ),
            models.UniqueConstraint(
                fields=["REVW_ID"],
                condition=models.Q(
                    MRDSP_STATUS="pending",
                ),
                name="unique_active_dispute_per_review",
            ),
        ]

    def save(
        self,
        *args,
        **kwargs,
    ):
        """Retain source identities independently of nullable live relationships."""
        if self._state.adding:
            self.MRDSP_ORIGINAL_REVIEW_ID = self.REVW_ID_id
            self.MRDSP_ORIGINAL_BUSINESS_ID = self.BUSN_ID_id
            self.MRDSP_ORIGINAL_MERCHANT_ID = self.USER_ID_id
        return super().save(*args, **kwargs)

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


class MerchantReviewDisputeSnapshot(models.Model):
    """Retains immutable filing content independently of the live review and author."""

    MRDS_ID = models.BigAutoField(primary_key=True)
    MRDSP_ID = models.OneToOneField(
        MerchantReviewDispute,
        on_delete=models.CASCADE,
        related_name="snapshot",
        db_column="MRDSP_ID",
    )
    MRDS_REVIEW_ID = models.PositiveBigIntegerField()
    MRDS_AUTHOR_ID = models.PositiveBigIntegerField()
    MRDS_BUSINESS_ID = models.PositiveBigIntegerField()
    MRDS_TEXT = models.TextField(max_length=1000)
    MRDS_STATUS = models.CharField(max_length=20)
    MRDS_SUBMITTED_AT = models.DateTimeField()
    MRDS_EDITED_AT = models.DateTimeField(null=True)
    MRDS_CAPTURED_AT = models.DateTimeField(auto_now_add=True)
    MRDS_PHOTOS = models.JSONField(default=list)
    MRDS_FINGERPRINT = models.CharField(max_length=64)

    class Meta:
        db_table = "MERCHANT_REVIEW_DISPUTE_SNAPSHOT"
        indexes = [
            GinIndex(
                fields=["MRDS_PHOTOS"],
                name="dispute_snapshot_assets",
            ),
        ]
