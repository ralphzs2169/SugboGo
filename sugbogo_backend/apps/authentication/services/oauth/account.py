from apps.users.models import User
from django.utils import timezone

from .base import OAuthUser


class OAuthAccountService:
    """
    Handles account lookup and creation for OAuth providers.

    Every OAuth provider (Google, Facebook, Apple)
    should use this service instead of touching the
    User model directly.
    """

    @staticmethod
    def get_or_create_user(oauth_user: OAuthUser) -> User:
        """
        Finds an existing user by email or creates a new account.

        The returned User is always ready to receive JWT tokens.
        """

        user = User.objects.filter(
            USER_EMAIL=oauth_user.email
        ).first()


        # If the user exists, we update their email verification 
        # status and account status if necessary. 
        if user:
            if not user.EMAIL_VERIFIED:
                user.EMAIL_VERIFIED = True
                user.EMAIL_VERIFIED_AT = timezone.now()

            if user.USER_STATUS == User.UserStatus.PENDING:
                user.USER_STATUS = User.UserStatus.ACTIVE

            user.save(
                update_fields=[
                    "EMAIL_VERIFIED",
                    "EMAIL_VERIFIED_AT",
                    "USER_STATUS",
                ]
            )

            return user


        # If the user does not exist, we create a new account with the provided OAuth information.
        user = User.objects.create_user(
            email=oauth_user.email,

            # OAuth users don't authenticate with a password.
            password=None,

            USER_FNAME=oauth_user.first_name,
            USER_LNAME=oauth_user.last_name,

            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,

            EMAIL_VERIFIED=True,
            EMAIL_VERIFIED_AT=timezone.now(),
        )

        user.set_unusable_password()
        user.save(update_fields=["password"])

        return user