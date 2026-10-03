from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from apps.business.models import Business, Category, SpecialtyTag


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


class BusinessClassificationChangeRequest(models.Model):
    """Retains a reviewed classification proposal and its submitted baseline."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    BCCR_ID = models.AutoField(primary_key=True)
    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.PROTECT,
        db_column="BUSN_ID",
        related_name="classification_change_requests",
    )
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="USER_ID",
        related_name="business_classification_change_requests",
    )
    PREVIOUS_CTGRY_ID = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        db_column="PREVIOUS_CTGRY_ID",
        related_name="previous_classification_requests",
    )
    PROPOSED_CTGRY_ID = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        db_column="PROPOSED_CTGRY_ID",
        related_name="proposed_classification_requests",
    )
    BCCR_PREVIOUS_CATEGORY_NAME = models.CharField(max_length=100)
    BCCR_PREVIOUS_CLUSTER_ID = models.PositiveIntegerField()
    BCCR_PREVIOUS_CLUSTER_NAME = models.CharField(max_length=100)
    BCCR_PROPOSED_CATEGORY_NAME = models.CharField(max_length=100)
    BCCR_PROPOSED_CLUSTER_ID = models.PositiveIntegerField()
    BCCR_PROPOSED_CLUSTER_NAME = models.CharField(max_length=100)
    BCCR_STATUS = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    BCCR_SUBMITTED_AT = models.DateTimeField()
    BCCR_RESOLVED_AT = models.DateTimeField(blank=True, null=True)
    REVIEWER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="REVIEWER_ID",
        related_name="business_classification_changes_reviewed",
        blank=True,
        null=True,
    )
    BCCR_REJECTION_REASON = models.TextField(blank=True, null=True)
    BCCR_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BCCR_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "BUSINESS_CLASSIFICATION_CHANGE_REQUEST"
        ordering = ["-BCCR_SUBMITTED_AT", "-BCCR_ID"]
        constraints = [
            models.UniqueConstraint(
                fields=["BUSN_ID"],
                condition=models.Q(BCCR_STATUS="pending"),
                name="unique_pending_business_classification_change",
            ),
        ]

    def __str__(self):
        """Identify this classification request in Django displays."""
        return f"Classification change #{self.BCCR_ID} ({self.BCCR_STATUS})"


class BusinessClassificationSpecialtySnapshot(models.Model):
    """Preserves a submitted specialty ID and label on one side of a request."""

    class Side(models.TextChoices):
        PREVIOUS = "previous", "Previous"
        PROPOSED = "proposed", "Proposed"

    BCSS_ID = models.AutoField(primary_key=True)
    BCCR_ID = models.ForeignKey(
        BusinessClassificationChangeRequest,
        on_delete=models.CASCADE,
        db_column="BCCR_ID",
        related_name="specialty_snapshots",
    )
    TAG_ID = models.ForeignKey(
        SpecialtyTag,
        on_delete=models.PROTECT,
        db_column="TAG_ID",
        related_name="classification_request_snapshots",
    )
    BCSS_SIDE = models.CharField(max_length=10, choices=Side.choices)
    BCSS_TAG_NAME = models.CharField(max_length=100)

    class Meta:
        db_table = "BUSINESS_CLASSIFICATION_SPECIALTY_SNAPSHOT"
        ordering = ["BCSS_SIDE", "TAG_ID_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["BCCR_ID", "BCSS_SIDE", "TAG_ID"],
                name="unique_classification_snapshot_tag",
            ),
        ]


class BusinessLocationChangeRequest(models.Model):
    """Retains a reviewed location proposal and its captured live baseline."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    BLCR_ID = models.AutoField(primary_key=True)
    BUSN_ID = models.ForeignKey(
        Business,
        on_delete=models.PROTECT,
        db_column="BUSN_ID",
        related_name="location_change_requests",
    )
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="USER_ID",
        related_name="business_location_change_requests",
    )
    BLCR_PREVIOUS_LOCT_ID = models.PositiveIntegerField()
    BLCR_PREVIOUS_POINT = gis_models.PointField(srid=4326)
    BLCR_PREVIOUS_ADDRESS = models.CharField(max_length=255)
    BLCR_PREVIOUS_CITY = models.CharField(max_length=100)
    BLCR_PREVIOUS_PROVINCE = models.CharField(max_length=100)
    BLCR_PREVIOUS_POSTAL_CODE = models.CharField(
        max_length=10,
        blank=True,
        null=True,
    )
    BLCR_PROPOSED_POINT = gis_models.PointField(srid=4326)
    BLCR_PROPOSED_ADDRESS = models.CharField(max_length=255)
    BLCR_PROPOSED_CITY = models.CharField(max_length=100)
    BLCR_PROPOSED_PROVINCE = models.CharField(max_length=100)
    BLCR_PROPOSED_POSTAL_CODE = models.CharField(
        max_length=10,
        blank=True,
        null=True,
    )
    BLCR_STATUS = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    BLCR_SUBMITTED_AT = models.DateTimeField()
    BLCR_RESOLVED_AT = models.DateTimeField(blank=True, null=True)
    REVIEWER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="REVIEWER_ID",
        related_name="business_location_changes_reviewed",
        blank=True,
        null=True,
    )
    BLCR_REJECTION_REASON = models.TextField(blank=True, null=True)
    BLCR_CREATED_AT = models.DateTimeField(auto_now_add=True)
    BLCR_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "BUSINESS_LOCATION_CHANGE_REQUEST"
        ordering = ["-BLCR_SUBMITTED_AT", "-BLCR_ID"]
        constraints = [
            models.UniqueConstraint(
                fields=["BUSN_ID"],
                condition=models.Q(BLCR_STATUS="pending"),
                name="unique_pending_business_location_change",
            ),
        ]

    def __str__(self):
        """Identify the location request in Django displays."""
        return f"Location change #{self.BLCR_ID} ({self.BLCR_STATUS})"


class BusinessLocationLandmarkSnapshot(models.Model):
    """Preserves one landmark on either side of a location request."""

    class Side(models.TextChoices):
        PREVIOUS = "previous", "Previous"
        PROPOSED = "proposed", "Proposed"

    BLLS_ID = models.AutoField(primary_key=True)
    BLCR_ID = models.ForeignKey(
        BusinessLocationChangeRequest,
        on_delete=models.CASCADE,
        db_column="BLCR_ID",
        related_name="landmark_snapshots",
    )
    BLLS_SIDE = models.CharField(max_length=10, choices=Side.choices)
    BLLS_PREVIOUS_BLMK_ID = models.PositiveIntegerField(blank=True, null=True)
    BLLS_NAME = models.CharField(max_length=150)
    BLLS_ADDRESS = models.CharField(max_length=255)
    BLLS_POINT = gis_models.PointField(srid=4326)
    BLLS_SOURCE = models.CharField(max_length=10)
    BLLS_PLACE_ID = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "BUSINESS_LOCATION_LANDMARK_SNAPSHOT"
        ordering = ["BLLS_SIDE", "BLLS_ID"]
