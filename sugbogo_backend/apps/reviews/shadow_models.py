"""Separate durable Gemini observations; never authoritative review or rating inputs."""
from django.db import models


class ReviewSentimentShadow(models.Model):
    """Retain one durable observation per review, source text and scoring contract."""

    class State(models.TextChoices):
        PENDING = 'pending'
        PROCESSING = 'processing'
        READY = 'ready'
        FAILED = 'failed'
        STALE = 'stale'

    RSSH_ID = models.BigAutoField(primary_key=True)
    REVW_ID = models.ForeignKey('reviews.Review', on_delete=models.CASCADE, related_name='sentiment_shadows', db_column='REVW_ID')
    RSSH_VERSION = models.CharField(max_length=64)
    RSSH_SOURCE_HASH = models.CharField(max_length=64)
    RSSH_SOURCE_TEXT = models.TextField()
    RSSH_MODEL = models.CharField(max_length=100)
    RSSH_STATE = models.CharField(max_length=20, choices=State.choices, default=State.PENDING)
    RSSH_LABEL = models.CharField(max_length=10, blank=True)
    RSSH_SCORE = models.FloatField(null=True)
    RSSH_ELIGIBLE = models.BooleanField(null=True)
    RSSH_REASON = models.CharField(max_length=20, blank=True)
    RSSH_ATTEMPTS = models.PositiveIntegerField(default=0)
    RSSH_TOKEN = models.UUIDField(null=True)
    RSSH_LEASE_UNTIL = models.DateTimeField(null=True)
    RSSH_RETRY_AT = models.DateTimeField(null=True)
    RSSH_ERROR = models.CharField(max_length=100, blank=True)
    RSSH_USAGE = models.JSONField(default=dict)
    RSSH_CREATED_AT = models.DateTimeField(auto_now_add=True)
    RSSH_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'REVIEW_SENTIMENT_SHADOW'
        constraints = [models.UniqueConstraint(fields=['REVW_ID', 'RSSH_VERSION', 'RSSH_SOURCE_HASH'], name='rssh_unique_review_version_text')]
        indexes = [models.Index(fields=['RSSH_STATE', 'RSSH_RETRY_AT'], name='rssh_recovery_idx')]
