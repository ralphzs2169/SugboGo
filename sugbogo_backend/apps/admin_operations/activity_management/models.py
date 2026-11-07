from django.db import models

from apps.users.models import User


class AdminActivity(models.Model):
    """Records administrative decisions and author-triggered moderation removal."""

    class Module(models.TextChoices):
        MERCHANT_APPLICATION = "merchant_application", "Merchant applications"
        BUSINESS = "business", "Business management"
        USER = "user", "User management"
        REVIEW_MODERATION = "review_moderation", "Review moderation and disputes"
        TAXONOMY = "taxonomy", "Taxonomy management"
        DISCOVERY = "discovery", "Discovery configuration"
        TRANSIT = "transit", "Transit management"

    class Outcome(models.TextChoices):
        SUCCEEDED = "succeeded", "Operation completed"
        ACCEPTED = "accepted", "Accepted for asynchronous processing"

    class Action(models.TextChoices):
        ADMIN_CREATED = "admin_created", "Admin created"
        USER_SUSPENDED = "user_suspended", "User suspended"
        USER_REACTIVATED = "user_reactivated", "User reactivated"
        BUSINESS_SUSPENDED = "business_suspended", "Business suspended"
        BUSINESS_REACTIVATED = "business_reactivated", "Business reactivated"
        REVIEW_DISPUTE_UPHELD = "review_dispute_upheld", "Review dispute upheld"
        REVIEW_DISPUTE_DISMISSED = "review_dispute_dismissed", "Review dispute dismissed"
        REVIEW_REPORT_APPROVED = "review_report_approved", "Review report approved"
        REVIEW_REPORT_REJECTED = "review_report_rejected", "Review report rejected"
        REPORTED_REVIEW_KEPT = "reported_review_kept", "Reported review kept"
        REPORTED_REVIEW_REJECTED = (
            "reported_review_rejected",
            "Reported review rejected",
        )
        REVIEW_MODERATION_APPROVED = (
            "review_moderation_approved",
            "Review moderation approved",
        )
        REVIEW_MODERATION_REJECTED = (
            "review_moderation_rejected",
            "Review moderation rejected",
        )
        REVIEW_DELETED_BY_AUTHOR = (
            "review_deleted_by_author",
            "Review deleted by author",
        )
        BUSINESS_NAME_CHANGE_APPROVED = (
            "business_name_change_approved",
            "Business name change approved",
        )
        BUSINESS_NAME_CHANGE_REJECTED = (
            "business_name_change_rejected",
            "Business name change rejected",
        )
        BUSINESS_CLASSIFICATION_CHANGE_APPROVED = (
            "business_classification_change_approved",
            "Business classification change approved",
        )
        BUSINESS_CLASSIFICATION_CHANGE_REJECTED = (
            "business_classification_change_rejected",
            "Business classification change rejected",
        )
        BUSINESS_LOCATION_CHANGE_APPROVED = (
            "business_location_change_approved",
            "Business location change approved",
        )
        BUSINESS_LOCATION_CHANGE_REJECTED = (
            "business_location_change_rejected",
            "Business location change rejected",
        )

    AACT_ID = models.AutoField(
        primary_key=True,
    )

    ACTOR_ID = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="ACTOR_USER_ID",
        related_name="admin_actions_performed",
    )

    TARGET_USER_ID = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="TARGET_USER_ID",
        related_name="admin_actions_received",
        null=True,
        blank=True,
    )

    AACT_ACTION = models.CharField(
        max_length=40,
        choices=Action.choices,
    )

    AACT_CONTEXT = models.JSONField(
        default=dict,
        blank=True,
    )

    AACT_IS_ADMINISTRATIVE = models.BooleanField(
        null=True,
        blank=True,
    )

    AACT_MODULE = models.CharField(
        max_length=32,
        choices=Module.choices,
        null=True,
        blank=True,
    )

    AACT_TARGET_TYPE = models.CharField(
        max_length=64,
        null=True,
        blank=True,
    )

    AACT_TARGET_ID = models.CharField(
        max_length=64,
        null=True,
        blank=True,
    )

    AACT_TARGET_LABEL = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )

    AACT_ACTOR_NAME = models.CharField(
        max_length=150,
        null=True,
        blank=True,
    )

    AACT_ACTOR_ROLE = models.CharField(
        max_length=20,
        choices=User.UserRole.choices,
        null=True,
        blank=True,
    )

    AACT_PREVIOUS_STATE = models.JSONField(
        null=True,
        blank=True,
    )

    AACT_NEW_STATE = models.JSONField(
        null=True,
        blank=True,
    )

    AACT_REASON = models.TextField(
        null=True,
        blank=True,
    )

    AACT_OUTCOME = models.CharField(
        max_length=16,
        choices=Outcome.choices,
        null=True,
        blank=True,
    )

    AACT_SOURCE_TYPE = models.CharField(
        max_length=64,
        null=True,
        blank=True,
    )

    AACT_SOURCE_ID = models.CharField(
        max_length=64,
        null=True,
        blank=True,
    )

    AACT_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "ADMIN_ACTIVITY"
        ordering = ["-AACT_CREATED_AT", "-AACT_ID"]
        indexes = [
            models.Index(
                fields=["TARGET_USER_ID", "-AACT_CREATED_AT"],
                name="admin_activity_target_time",
            ),
            models.Index(
                fields=["-AACT_CREATED_AT", "-AACT_ID"],
                name="admin_activity_time",
            ),
            models.Index(
                fields=["ACTOR_ID", "-AACT_CREATED_AT", "-AACT_ID"],
                name="admin_activity_actor_time",
            ),
            models.Index(
                fields=["AACT_ACTION", "-AACT_CREATED_AT", "-AACT_ID"],
                name="admin_activity_action_time",
            ),
            models.Index(
                fields=["AACT_MODULE", "-AACT_CREATED_AT", "-AACT_ID"],
                name="admin_activity_module_time",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        AACT_TARGET_TYPE__isnull=True,
                        AACT_TARGET_ID__isnull=True,
                    )
                    | (
                        models.Q(
                            AACT_TARGET_TYPE__isnull=False,
                            AACT_TARGET_ID__isnull=False,
                        )
                        & ~models.Q(AACT_TARGET_TYPE="")
                        & ~models.Q(AACT_TARGET_ID="")
                    )
                ),
                name="admin_activity_target_pair",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        AACT_SOURCE_TYPE__isnull=True,
                        AACT_SOURCE_ID__isnull=True,
                    )
                    | (
                        models.Q(
                            AACT_SOURCE_TYPE__isnull=False,
                            AACT_SOURCE_ID__isnull=False,
                        )
                        & ~models.Q(AACT_SOURCE_TYPE="")
                        & ~models.Q(AACT_SOURCE_ID="")
                    )
                ),
                name="admin_activity_source_pair",
            ),
            models.UniqueConstraint(
                fields=["AACT_SOURCE_TYPE", "AACT_SOURCE_ID"],
                condition=models.Q(AACT_SOURCE_TYPE__isnull=False),
                name="admin_activity_unique_source",
            ),
        ]

    @classmethod
    def administrative_action_modules(cls):
        """Map explicitly administrative action constants without reclassifying author activity."""
        return {
            cls.Action.ADMIN_CREATED: cls.Module.USER,
            cls.Action.USER_SUSPENDED: cls.Module.USER,
            cls.Action.USER_REACTIVATED: cls.Module.USER,
            cls.Action.BUSINESS_SUSPENDED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_REACTIVATED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_NAME_CHANGE_APPROVED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_NAME_CHANGE_REJECTED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_CLASSIFICATION_CHANGE_APPROVED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_CLASSIFICATION_CHANGE_REJECTED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_LOCATION_CHANGE_APPROVED: cls.Module.BUSINESS,
            cls.Action.BUSINESS_LOCATION_CHANGE_REJECTED: cls.Module.BUSINESS,
            cls.Action.REVIEW_DISPUTE_UPHELD: cls.Module.REVIEW_MODERATION,
            cls.Action.REVIEW_DISPUTE_DISMISSED: cls.Module.REVIEW_MODERATION,
            cls.Action.REVIEW_REPORT_APPROVED: cls.Module.REVIEW_MODERATION,
            cls.Action.REVIEW_REPORT_REJECTED: cls.Module.REVIEW_MODERATION,
            cls.Action.REPORTED_REVIEW_KEPT: cls.Module.REVIEW_MODERATION,
            cls.Action.REPORTED_REVIEW_REJECTED: cls.Module.REVIEW_MODERATION,
            cls.Action.REVIEW_MODERATION_APPROVED: cls.Module.REVIEW_MODERATION,
            cls.Action.REVIEW_MODERATION_REJECTED: cls.Module.REVIEW_MODERATION,
        }

    @property
    def is_administrative(self):
        """Classify recorded events and known legacy actions while leaving unknown history unset."""
        if self.AACT_IS_ADMINISTRATIVE is not None:
            return self.AACT_IS_ADMINISTRATIVE
        if self.AACT_ACTION == self.Action.REVIEW_DELETED_BY_AUTHOR:
            return False
        if self.AACT_ACTION in self.administrative_action_modules():
            return True
        return None

    def __str__(self):
        """Describe generalized targets while retaining the legacy user description."""
        if self.AACT_TARGET_TYPE is not None:
            return (
                f"{self.AACT_ACTION} for "
                f"{self.AACT_TARGET_TYPE} {self.AACT_TARGET_ID}"
            )
        return f"{self.AACT_ACTION} for user {self.TARGET_USER_ID_id}"
