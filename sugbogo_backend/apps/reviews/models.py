from django.db import models

from apps.business.models.business_core_models import (
    Business,
)
from apps.users.models import User


class Review(models.Model):
    """A user's review of a business."""

    class ReviewStatus(models.TextChoices):
        PUBLISHED = "published", "Published"
        FLAGGED = "flagged", "Flagged"
        REJECTED = "rejected", "Rejected"

    REVW_ID = models.AutoField(
        primary_key=True,
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="reviews",
    )

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="reviews",
    )

    REVW_TEXT = models.TextField(
        max_length=1000,
    )

    REVW_STATUS = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PUBLISHED,
    )

    REVW_LIKE_COUNT = models.PositiveIntegerField(
        default=0,
    )

    REVW_REPORT_COUNT = models.PositiveIntegerField(
        default=0,
    )

    REVW_IS_SPAM_FLAGGED = models.BooleanField(
        default=False,
    )

    REVW_IS_OUTLIER_SENTIMENT = models.BooleanField(
        default=False,
    )

    REVW_DEVICE_ID = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    
    REVW_IS_DEVICE_ABUSE_FLAGGED = models.BooleanField(
        default=False,
    )

    REVW_SENTIMENT_SCORE = models.FloatField(
        null=True,
        blank=True,
    )

    REVW_SENTIMENT_LABEL = models.CharField(
        max_length=20,
        choices=(
            ("positive", "Positive"),
            ("neutral", "Neutral"),
            ("negative", "Negative"),
        ),
        null=True,
        blank=True,
    )

    REVW_MODERATION_NOTES = models.TextField(
        null=True,
        blank=True,
    )

    REVW_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    REVW_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "BUSINESS_REVIEW"
        ordering = ["-REVW_CREATED_AT"]
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=["USER_ID", "BUSN_ID"],
                name="unique_user_business_review",
            ),
        ]

    def __str__(self):
        return f"Review {self.REVW_ID}"


class ReviewPhoto(models.Model):
    """A photo attached to a business review."""

    RPHO_ID = models.AutoField(
        primary_key=True,
    )

    REVW_ID = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        db_column="REVW_ID",
        related_name="photos",
    )

    RPHO_PHOTO_URL = models.URLField()

    RPHO_PHOTO_PUBLIC_ID = models.CharField(
        max_length=255,
    )

    class Meta:
        db_table = "REVIEW_PHOTO"

    def __str__(self):
        return f"Review photo {self.RPHO_ID}"


class ReviewReport(models.Model):
    """A user-submitted report against a business review."""

    class ReportType(models.TextChoices):
        SPAM = "spam", "Spam"
        ABUSE = "abuse", "Abuse"
        MISINFORMATION = "misinformation", "Misinformation"
        OTHER = "other", "Other"

    class ReportStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    RREP_ID = models.AutoField(
        primary_key=True,
    )

    REVW_ID = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        db_column="REVW_ID",
        related_name="reports",
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="review_reports",
    )

    RREP_TYPE = models.CharField(
        max_length=30,
        choices=ReportType.choices,
    )

    RREP_STATUS = models.CharField(
        max_length=20,
        choices=ReportStatus.choices,
        default=ReportStatus.PENDING,
    )

    RREP_DEVICE_ID = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    RREP_FLAG_SUSPICIOUS = models.BooleanField(
        default=False,
    )

    RREP_NOTES = models.TextField(
        blank=True,
        null=True,
    )

    RREP_WITHDRAWN_AT = models.DateTimeField(
        blank=True,
        null=True,
    )

    RREP_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    RREP_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "REVIEW_REPORT"
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=["USER_ID", "REVW_ID"],
                name="unique_user_review_report",
            ),
        ]

    def __str__(self):
        return f"Review report {self.RREP_ID}"


class ReviewLike(models.Model):
    """A user's like on a business review."""

    RLIK_ID = models.AutoField(
        primary_key=True,
    )

    REVW_ID = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        db_column="REVW_ID",
        related_name="likes",
    )

    USER_ID = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="review_likes",
    )

    RLIK_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    RLIK_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "REVIEW_LIKE"
        constraints = [
            models.UniqueConstraint(
                fields=["REVW_ID", "USER_ID"],
                name="unique_review_user_like",
            ),
        ]

    def __str__(self):
        return f"Review like {self.RLIK_ID}"
    

class ReviewReply(models.Model):
    """A single business-owner reply to a business review."""

    RPLY_ID = models.AutoField(
        primary_key=True,
    )

    REVW_ID = models.OneToOneField(
        Review,
        on_delete=models.CASCADE,
        db_column="REVW_ID",
        related_name="reply",
    )

    RPLY_TEXT = models.TextField(
        max_length=1000,
    )

    RPLY_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    RPLY_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "REVIEW_REPLY"

    def __str__(self):
        return f"Reply {self.RPLY_ID}"


class ReplyPhoto(models.Model):
    RPHO_ID = models.AutoField(primary_key=True)

    RPLY_ID = models.ForeignKey(
        ReviewReply,
        on_delete=models.CASCADE,
        db_column="RPLY_ID",
        related_name="photos",
    )

    RPHO_PHOTO_URL = models.URLField()
    RPHO_PHOTO_PUBLIC_ID = models.CharField(
        max_length=255,
    )

    class Meta:
        db_table = "REVIEW_REPLY_PHOTO"


class ReplyTemplate(models.Model):
    """A reusable reply template saved by a business owner."""

    RTPL_ID = models.AutoField(
        primary_key=True,
    )

    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="reply_templates",
    )

    RTPL_TITLE = models.CharField(
        max_length=100,
    )

    RTPL_TEXT = models.TextField(
        max_length=1000,
    )

    RTPL_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    RTPL_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "REVIEW_REPLY_TEMPLATE"
        ordering = ["-RTPL_CREATED_AT"]  # noqa: RUF012

    def __str__(self):
        return self.RTPL_TITLE


class BusinessReviewSummary(models.Model):
    """Stores the latest sentiment counts and keyword tags for a business."""

    BRSU_ID = models.AutoField(
        primary_key=True,
    )

    BUSN_ID = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="review_summary",
    )

    BRSU_POSITIVE_COUNT = models.PositiveIntegerField(
        default=0,
    )
    BRSU_NEUTRAL_COUNT = models.PositiveIntegerField(
        default=0,
    )
    BRSU_NEGATIVE_COUNT = models.PositiveIntegerField(
        default=0,
    )
    BRSU_REVIEW_COUNT = models.PositiveIntegerField(
        default=0,
    )
    BRSU_CLASSIFIED_REVIEW_COUNT = models.PositiveIntegerField(
        default=0,
    )

    BRSU_KEYWORD_TAGS = models.JSONField(
        default=list,
        blank=True,
    )

    BRSU_SENTIMENT_COMPUTED_AT = models.DateTimeField(
        null=True,
        blank=True,
    )
    BRSU_KEYWORDS_PROCESSED_AT = models.DateTimeField(
        null=True,
        blank=True,
    )
    BRSU_KEYWORDS_FINGERPRINT = models.CharField(
        max_length=64,
        blank=True,
        default="",
    )
    BRSU_KEYWORDS_ATTEMPTED_AT = models.DateTimeField(
        null=True,
        blank=True,
    )
    BRSU_KEYWORDS_RETRYABLE = models.BooleanField(
        default=False,
    )
    BRSU_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )
    BRSU_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "BUSINESS_REVIEW_SUMMARY"
        constraints = [  # noqa: RUF012
            models.CheckConstraint(
                condition=models.Q(
                    BRSU_CLASSIFIED_REVIEW_COUNT=(
                        models.F("BRSU_POSITIVE_COUNT")
                        + models.F("BRSU_NEUTRAL_COUNT")
                        + models.F("BRSU_NEGATIVE_COUNT")
                    ),
                ),
                name="brsu_classified_matches_counts",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    BRSU_CLASSIFIED_REVIEW_COUNT__lte=models.F(
                        "BRSU_REVIEW_COUNT",
                    ),
                ),
                name="brsu_classified_lte_reviews",
            ),
        ]

    @property
    def sentiment_percentages(self):
        """Calculates sentiment percentages using only classified reviews."""
        counts = {
            "positive": self.BRSU_POSITIVE_COUNT,
            "neutral": self.BRSU_NEUTRAL_COUNT,
            "negative": self.BRSU_NEGATIVE_COUNT,
        }
        if not self.BRSU_CLASSIFIED_REVIEW_COUNT:
            return dict.fromkeys(counts, 0.0)

        return {
            label: count / self.BRSU_CLASSIFIED_REVIEW_COUNT * 100
            for label, count in counts.items()
        }
