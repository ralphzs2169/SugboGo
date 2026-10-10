from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models


class Notification(models.Model):
    """Stores a recipient's persistent notification and read state."""

    NOTF_ID = models.AutoField(primary_key=True)
    USER_ID = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="notifications",
    )
    NOTF_TYPE = models.CharField(max_length=64)
    NOTF_TITLE = models.CharField(max_length=160)
    NOTF_BODY = models.TextField(
        max_length=2000,
        validators=[MaxLengthValidator(2000)],
    )
    NOTF_TARGET_TYPE = models.CharField(max_length=64, blank=True, default="")
    NOTF_TARGET_ID = models.PositiveBigIntegerField(null=True, blank=True)
    NOTF_DEDUP_KEY = models.CharField(max_length=160)
    NOTF_READ_AT = models.DateTimeField(null=True, blank=True)
    NOTF_CREATED_AT = models.DateTimeField(auto_now_add=True)
    NOTF_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "NOTIFICATION"
        ordering = ["-NOTF_CREATED_AT", "-NOTF_ID"]
        constraints = [
            models.UniqueConstraint(
                fields=["USER_ID", "NOTF_DEDUP_KEY"],
                name="notification_recipient_event",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(NOTF_TARGET_TYPE="", NOTF_TARGET_ID__isnull=True)
                    | (
                        ~models.Q(NOTF_TARGET_TYPE="")
                        & models.Q(NOTF_TARGET_ID__gt=0)
                        & models.Q(NOTF_TARGET_ID__isnull=False)
                    )
                ),
                name="notification_target_pair",
            ),
        ]
        indexes = [
            models.Index(
                fields=["USER_ID", "-NOTF_CREATED_AT", "-NOTF_ID"],
                name="notification_recipient_time",
            ),
            models.Index(
                fields=["USER_ID", "NOTF_READ_AT"],
                name="notification_recipient_read",
            ),
        ]
