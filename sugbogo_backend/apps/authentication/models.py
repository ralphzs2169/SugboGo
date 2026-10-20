
from django.db import models
import uuid

from apps.users.models import User


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
