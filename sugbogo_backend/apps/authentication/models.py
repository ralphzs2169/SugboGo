
from django.db import models
from django.utils import timezone
import uuid

from apps.users.models import User


class LoginEvent(models.Model):
    """Records a bounded authentication outcome without credentials or identifiers."""

    class Method(models.TextChoices):
        PASSWORD = "password", "Password"
        ADMIN = "admin", "Admin password"
        GOOGLE = "google", "Google"
        FACEBOOK = "facebook", "Facebook"

    class Outcome(models.TextChoices):
        SUCCESS = "success", "Successful sign-in"
        FAILED = "failed", "Unsuccessful sign-in"
        UNAVAILABLE = "unavailable", "Provider unavailable"

    LEVT_ID = models.BigAutoField(primary_key=True)
    USER = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        related_name="login_events",
        db_column="USER_ID",
    )
    LEVT_METHOD = models.CharField(max_length=16, choices=Method.choices)
    LEVT_OUTCOME = models.CharField(max_length=16, choices=Outcome.choices)
    LEVT_IP_ADDRESS = models.GenericIPAddressField(null=True)
    LEVT_PLATFORM = models.CharField(max_length=16)
    LEVT_CLIENT = models.CharField(max_length=24)
    LEVT_CREATED_AT = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "LOGIN_EVENT"
        ordering = ["-LEVT_CREATED_AT", "-LEVT_ID"]
        indexes = [
            models.Index(
                fields=["USER", "-LEVT_CREATED_AT", "-LEVT_ID"],
                name="login_event_user_date_idx",
            ),
            models.Index(
                fields=["LEVT_CREATED_AT"], name="login_event_retention_idx",
            ),
        ]


class EmailChangeRequest(models.Model):
    """Stores one expiring, replaceable email-change proof for an account."""

    ECHG_ID = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    USER_ID = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        db_column="USER_ID",
        related_name="email_change_request",
    )
    ECHG_NEW_EMAIL = models.EmailField(max_length=100)
    ECHG_TOKEN_HASH = models.CharField(max_length=64)
    ECHG_AUTH_STATE = models.CharField(max_length=64)
    ECHG_EXPIRES_AT = models.DateTimeField()
    ECHG_CREATED_AT = models.DateTimeField(auto_now_add=True)
    ECHG_UPDATED_AT = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "EMAIL_CHANGE_REQUEST"


class OAuthAccount(models.Model):
    class OAuthProvider(models.TextChoices):
        GOOGLE = "google", "Google"
        FACEBOOK = "facebook", "Facebook"
        APPLE = "apple", "Apple"

    OAUTH_ID = models.AutoField(primary_key=True,)

    USER = models.ForeignKey(
        User,
        db_column="USER_ID",
        on_delete=models.CASCADE,
        related_name="OAUTH_ACCOUNTS",
    )

    OAUTH_PROVIDER = models.CharField(
        max_length=20,
        choices=OAuthProvider.choices,
    )

    OAUTH_AVATAR_URL = models.URLField(
        max_length=500,
        blank=True,
        null=True,
    )

    OAUTH_PROVIDER_ID = models.CharField(max_length=255,)
    OAUTH_CREATED_AT = models.DateTimeField(auto_now_add=True,)
    OAUTH_LAST_LOGIN = models.DateTimeField(auto_now=True,)

    class Meta:
        db_table = "oauth_accounts"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "OAUTH_PROVIDER",
                    "OAUTH_PROVIDER_ID",
                ],
                name="unique_oauth_provider_account",
            ),
            models.UniqueConstraint(
            fields=[
                "USER",
                "OAUTH_PROVIDER",
            ],
            name="unique_user_provider",
        ),
    ]
