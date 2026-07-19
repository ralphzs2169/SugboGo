
from django.db import models

from apps.users.models import User


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
        

    