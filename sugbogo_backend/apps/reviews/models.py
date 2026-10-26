from datetime import timedelta

from django.db import models
from django.db.models.functions import Least
from django.utils import timezone

from apps.business.models.business_core_models import (
    Business,
)
from apps.users.models import User
from apps.reviews.constants import (
    REVIEW_INSIGHT_MAX_WAIT_SECONDS,
    REVIEW_INSIGHT_QUIET_SECONDS,
)


class ReviewInsightRegeneration(models.Model):
    """Retains one business's regeneration demand and fenced worker ownership."""

    RIRG_ID = models.BigAutoField(primary_key=True)
    BUSN_ID = models.OneToOneField(
        Business,
        on_delete=models.CASCADE,
        db_column="BUSN_ID",
        related_name="review_insight_regeneration",
    )
    RIRG_REQUESTED_REVISION = models.PositiveBigIntegerField(default=0)
    RIRG_COMPLETED_REVISION = models.PositiveBigIntegerField(default=0)
    RIRG_OBSERVED_REVISION = models.PositiveBigIntegerField(default=0)
    RIRG_INPUT_FINGERPRINT = models.CharField(
        max_length=64,
        blank=True,
        default="",
    )
    RIRG_RECHECK_AT = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )
    RIRG_FIRST_CHANGED_AT = models.DateTimeField(
        null=True,
        blank=True,
        help_text="First committed change observed in the outstanding period.",
    )
    RIRG_LATEST_CHANGED_AT = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Latest committed revision observed outside its mutation transaction.",
    )
    RIRG_DUE_AT = models.DateTimeField(null=True, blank=True)
    RIRG_ATTEMPT_TOKEN = models.UUIDField(null=True, blank=True)
    RIRG_CLAIMED_REVISION = models.PositiveBigIntegerField(null=True, blank=True)
    RIRG_LEASE_EXPIRES_AT = models.DateTimeField(null=True, blank=True)
    RIRG_ATTEMPTS = models.PositiveIntegerField(default=0)
    RIRG_RETRY_NOT_BEFORE = models.DateTimeField(null=True, blank=True)
    RIRG_LAST_ERROR = models.CharField(max_length=64, blank=True, default="")
    RIRG_CREATED_AT = models.DateTimeField(auto_now_add=True)
    RIRG_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "REVIEW_INSIGHT_REGENERATION"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        RIRG_COMPLETED_REVISION__lte=models.F("RIRG_OBSERVED_REVISION"),
                    )
                    & models.Q(
                        RIRG_OBSERVED_REVISION__lte=models.F("RIRG_REQUESTED_REVISION"),
                    )
                ),
                name="rirg_revision_order",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        RIRG_OBSERVED_REVISION=models.F("RIRG_COMPLETED_REVISION"),
                        RIRG_FIRST_CHANGED_AT__isnull=True,
                        RIRG_LATEST_CHANGED_AT__isnull=True,
                        RIRG_DUE_AT__isnull=True,
                    )
                    | (
                        models.Q(
                            RIRG_OBSERVED_REVISION__gt=models.F("RIRG_COMPLETED_REVISION"),
                            RIRG_FIRST_CHANGED_AT__isnull=False,
                            RIRG_LATEST_CHANGED_AT__isnull=False,
                            RIRG_DUE_AT__isnull=False,
                        )
                        & models.Q(
                            RIRG_FIRST_CHANGED_AT__lte=models.F("RIRG_LATEST_CHANGED_AT"),
                            RIRG_DUE_AT=Least(
                                models.F("RIRG_LATEST_CHANGED_AT")
                                + timedelta(seconds=REVIEW_INSIGHT_QUIET_SECONDS),
                                models.F("RIRG_FIRST_CHANGED_AT")
                                + timedelta(seconds=REVIEW_INSIGHT_MAX_WAIT_SECONDS),
                            ),
                        )
                    )
                ),
                name="rirg_observed_deadline",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        RIRG_ATTEMPT_TOKEN__isnull=True,
                        RIRG_CLAIMED_REVISION__isnull=True,
                        RIRG_LEASE_EXPIRES_AT__isnull=True,
                    )
                    | models.Q(
                        RIRG_ATTEMPT_TOKEN__isnull=False,
                        RIRG_CLAIMED_REVISION__isnull=False,
                        RIRG_LEASE_EXPIRES_AT__isnull=False,
                        RIRG_CLAIMED_REVISION__gt=models.F("RIRG_COMPLETED_REVISION"),
                        RIRG_CLAIMED_REVISION__lte=models.F("RIRG_OBSERVED_REVISION"),
                    )
                ),
                name="rirg_complete_ownership",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        RIRG_REQUESTED_REVISION__gt=models.F("RIRG_COMPLETED_REVISION"),
                    )
                    | models.Q(
                        RIRG_ATTEMPT_TOKEN__isnull=True,
                        RIRG_RETRY_NOT_BEFORE__isnull=True,
                    )
                ),
                name="rirg_idle_has_no_attempt",
            ),
        ]
        indexes = [
            models.Index(
                fields=["RIRG_DUE_AT", "RIRG_ID"],
                condition=models.Q(
                    RIRG_REQUESTED_REVISION__gt=models.F("RIRG_COMPLETED_REVISION"),
                ),
                name="rirg_outstanding_due",
            ),
            models.Index(
                fields=["RIRG_UPDATED_AT", "RIRG_ID"],
                condition=models.Q(
                    RIRG_OBSERVED_REVISION__lt=models.F("RIRG_REQUESTED_REVISION"),
                ),
                name="rirg_unobserved_changes",
            ),
            models.Index(
                fields=["RIRG_LEASE_EXPIRES_AT", "RIRG_ID"],
                condition=models.Q(RIRG_ATTEMPT_TOKEN__isnull=False),
                name="rirg_active_lease",
            ),
        ]


class ReviewMediaCleanup(models.Model):
    """Retains one asset's cleanup work independently of its deleted review."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Requires intervention"
        RETAINED = "retained", "Retained as evidence or live media"

    class ResourceType(models.TextChoices):
        IMAGE = "image", "Image"
        RAW = "raw", "Raw document"

    RMCU_ID = models.BigAutoField(primary_key=True)
    RMCU_REVIEW_ID = models.PositiveBigIntegerField()
    RMCU_PUBLIC_ID = models.CharField(max_length=255)
    RMCU_RESOURCE_TYPE = models.CharField(
        max_length=5,
        choices=ResourceType.choices,
    )
    RMCU_STATUS = models.CharField(
        max_length=9,
        choices=Status.choices,
        default=Status.PENDING,
    )
    RMCU_ATTEMPTS = models.PositiveIntegerField(default=0)
    RMCU_NEXT_ATTEMPT_AT = models.DateTimeField(default=timezone.now)
    RMCU_LAST_ERROR = models.CharField(
        max_length=64,
        blank=True,
        default="",
    )
    RMCU_COMPLETED_AT = models.DateTimeField(null=True, blank=True)
    RMCU_CREATED_AT = models.DateTimeField(auto_now_add=True)
    RMCU_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "REVIEW_MEDIA_CLEANUP"
        constraints = [
            models.UniqueConstraint(
                fields=["RMCU_REVIEW_ID", "RMCU_RESOURCE_TYPE", "RMCU_PUBLIC_ID"],
                name="unique_review_media_cleanup",
            ),
        ]
        indexes = [
            models.Index(
                fields=["RMCU_STATUS", "RMCU_NEXT_ATTEMPT_AT", "RMCU_ID"],
                name="review_media_cleanup_due",
            ),
        ]


class Review(models.Model):
    """A user's review of a business."""

    class ReliabilityReason(models.TextChoices):
        DUPLICATE_CONTENT = "duplicate_content", "Duplicate content"
        RAPID_SUBMISSION = "rapid_submission", "Rapid submission"
        SHARED_INSTALLATION_ACCOUNTS = (
            "shared_installation_accounts",
            "Shared installation accounts",
        )

    class ReliabilityCheckOutcome(models.TextChoices):
        """Outcome of the latest applicable advisory reliability assessment."""

        UNKNOWN = "unknown", "Unknown"
        CHECKED = "checked", "Checked"
        UNAVAILABLE = "unavailable", "Unavailable"

    class ReviewStatus(models.TextChoices):
        PUBLISHED = "published", "Published"
        UNDER_REVIEW = "under_review", "Under review"
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

    REVW_SHOW_IN_COMMUNITY = models.BooleanField(default=True)

    REVW_LIKE_COUNT = models.PositiveIntegerField(
        default=0,
    )

    REVW_REPORT_COUNT = models.PositiveIntegerField(
        default=0,
    )

    REVW_IS_REPORT_FLAGGED = models.BooleanField(
        default=False,
    )

    REVW_IS_OUTLIER_SENTIMENT = models.BooleanField(
        default=False,
    )

    REVW_INSTALLATION_ID = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    
    REVW_IS_DEVICE_ABUSE_FLAGGED = models.BooleanField(
        default=False,
    )
    REVW_RELIABILITY_REASONS = models.JSONField(
        default=list,
        blank=True,
    )
    REVW_RELIABILITY_EVIDENCE = models.JSONField(
        default=dict,
        blank=True,
    )
    REVW_RELIABILITY_CHECK_OUTCOME = models.CharField(
        max_length=20,
        choices=ReliabilityCheckOutcome.choices,
        default=ReliabilityCheckOutcome.UNKNOWN,
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

    REVW_MODERATION_DATA = models.JSONField(
        default=dict,
        blank=True,
    )

    REVW_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    REVW_PUBLISHED_AT = models.DateTimeField(
        null=True,
        blank=True,
    )

    REVW_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )
    REVW_EDITED_AT = models.DateTimeField(
        null=True,
        blank=True,
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
        ABUSE = "abuse", "Abuse or Harassment"
        MISINFORMATION = "misinformation", "False or Misleading Information"
        OFF_TOPIC = "off_topic", "Off-topic or Irrelevant"
        PRIVATE_INFORMATION = "private_information", "Personal or Private Information"
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

    RREP_INSTALLATION_ID = models.CharField(
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
    RREP_EXPLANATION = models.CharField(
        max_length=500,
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
    """Stores the latest review insights generated for a business."""

    class GenerationState(models.TextChoices):
        PENDING = "pending", "Pending"
        INSUFFICIENT_REVIEWS = "insufficient_reviews", "Insufficient reviews"
        READY = "ready", "Ready"
        OUTDATED = "outdated", "Outdated"

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
    BRSU_NARRATIVE = models.TextField(
        blank=True,
        default="",
    )
    BRSU_SUPPORTING_REVIEW_REFERENCES = models.JSONField(
        default=dict,
        blank=True,
    )
    BRSU_COVERAGE_START = models.DateTimeField(
        null=True,
        blank=True,
    )
    BRSU_COVERAGE_END = models.DateTimeField(
        null=True,
        blank=True,
    )
    BRSU_ELIGIBLE_REVIEW_COUNT = models.PositiveIntegerField(
        default=0,
    )
    BRSU_ANALYZED_REVIEW_COUNT = models.PositiveIntegerField(
        default=0,
    )
    BRSU_GENERATION_STATE = models.CharField(
        max_length=30,
        choices=GenerationState.choices,
        default=GenerationState.PENDING,
    )
    # Policy provenance is unknown for pre-existing summaries; never invent a historical version.
    BRSU_GENERATION_POLICY_VERSION = models.PositiveBigIntegerField(null=True, blank=True)
    BRSU_GENERATION_POLICY_VALUES = models.JSONField(default=dict, blank=True)
    BRSU_GENERATED_AT = models.DateTimeField(
        null=True,
        blank=True,
    )

    BRSU_SENTIMENT_COMPUTED_AT = models.DateTimeField(
        null=True,
        blank=True,
    )
    BRSU_SENTIMENT_SOURCES = models.JSONField(
        default=dict,
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
    BRSU_KEYWORDS_ATTEMPT_FINGERPRINT = models.CharField(
        max_length=64,
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

    @property
    def overall_vibe(self):
        """Derives the dominant review vibe when classified data is sufficient."""
        from apps.shared.analytics.review_vibe import classify_review_vibe

        return classify_review_vibe(
            counts={
                "positive": self.BRSU_POSITIVE_COUNT,
                "neutral": self.BRSU_NEUTRAL_COUNT,
                "negative": self.BRSU_NEGATIVE_COUNT,
            },
            classified_count=self.BRSU_CLASSIFIED_REVIEW_COUNT,
        )
