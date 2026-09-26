from django.db import models

from apps.users.models import User


class AdminActivity(models.Model):
    """Records a persistent administrative action performed on a user."""

    class Action(models.TextChoices):
        USER_SUSPENDED = "user_suspended", "User suspended"
        USER_REACTIVATED = "user_reactivated", "User reactivated"

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
    )

    AACT_ACTION = models.CharField(
        max_length=40,
        choices=Action.choices,
    )

    AACT_CONTEXT = models.JSONField(
        default=dict,
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
        ]

    def __str__(self):
        return f"{self.AACT_ACTION} for user {self.TARGET_USER_ID_id}"
