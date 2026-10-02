from django.conf import settings
from django.db import models

from apps.business.models import Business


class BusinessNameChangeRequest(models.Model):
    """Retains a merchant's proposed post-approval business name change."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    BNCR_ID = models.AutoField(primary_key=True)
    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.PROTECT,
        db_column="BUSN_ID",
        related_name="name_change_requests",
    )
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="USER_ID",
        related_name="business_name_change_requests",
    )
    BNCR_PREVIOUS_BUSINESS_NAME = models.CharField(max_length=150)
    BNCR_PROPOSED_BUSINESS_NAME = models.CharField(max_length=150)
    BNCR_STATUS = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    BNCR_SUBMITTED_AT = models.DateTimeField()
    BNCR_RESOLVED_AT = models.DateTimeField(blank=True, null=True)
    REVIEWER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="REVIEWER_ID",
        related_name="business_name_changes_reviewed",
        blank=True,
        null=True,
    )
    BNCR_REJECTION_REASON = models.TextField(blank=True, null=True)
    BNCR_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BNCR_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "BUSINESS_NAME_CHANGE_REQUEST"
        ordering = ["-BNCR_SUBMITTED_AT", "-BNCR_ID"]
        constraints = [
            models.UniqueConstraint(
                fields=["BUSN_ID"],
                condition=models.Q(BNCR_STATUS="pending"),
                name="unique_pending_business_name_change",
            ),
        ]

    def __str__(self):
        return f"Business name change #{self.BNCR_ID} ({self.BNCR_STATUS})"
