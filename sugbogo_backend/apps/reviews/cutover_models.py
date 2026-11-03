"""Persist explicit business cutovers and reversible legacy projections."""

from django.db import models


class BusinessSentimentPolicy(models.Model):
    """Pin an authoritative methodology independently of process environment changes."""

    class Mode(models.TextChoices):
        LEGACY = "legacy"
        SHADOW = "shadow"
        GEMINI = "gemini"

    BSPO_ID = models.BigAutoField(primary_key=True)
    BUSN_ID = models.OneToOneField(
        "business.Business",
        on_delete=models.CASCADE,
        related_name="sentiment_policy",
        db_column="BUSN_ID",
    )
    BSPO_MODE = models.CharField(
        max_length=10,
        choices=Mode.choices,
        default=Mode.SHADOW,
    )
    BSPO_MODEL = models.CharField(max_length=100)
    BSPO_VERSION = models.CharField(max_length=64)
    BSPO_PREVIOUS_RATING_VERSION = models.CharField(max_length=100, blank=True)
    BSPO_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "BUSINESS_SENTIMENT_POLICY"


class ReviewLegacySentimentSnapshot(models.Model):
    """Preserve pre-cutover caches and rating inputs for unchanged review text."""

    RLSS_ID = models.BigAutoField(primary_key=True)
    REVW_ID = models.OneToOneField(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="legacy_sentiment_snapshot",
        db_column="REVW_ID",
    )
    RLSS_SOURCE_TEXT = models.TextField()
    RLSS_SCORE = models.FloatField(null=True)
    RLSS_LABEL = models.CharField(max_length=20, null=True)
    RLSS_OUTLIER = models.BooleanField(default=False)
    RLSS_RATING_RESULT = models.JSONField(null=True)
    RLSS_CREATED_AT = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "REVIEW_LEGACY_SENTIMENT_SNAPSHOT"
