from apps.users.models import User
from django.utils import timezone

from .base import OAuthUser
from apps.authentication.models import OAuthAccount
from django.db import transaction
from rest_framework.exceptions import PermissionDenied


class OAuthAccountInactive(PermissionDenied):
    """Reject OAuth access for suspended or disabled accounts."""

    default_code = "account_inactive"


class OAuthLoginDenied(PermissionDenied):
    """Keep administrative accounts outside mobile OAuth login."""

    default_detail = "Admin accounts cannot use OAuth login."
    default_code = "oauth_login_denied"


class OAuthAccountService:
    """
    Handles account lookup and creation for OAuth providers.

    Every OAuth provider (Google, Facebook, Apple)
    should use this service instead of touching the
    User model directly.
    """

    @staticmethod
    def _validate_user_access(user: User) -> None:
        """Check the resolved account before changing it or issuing tokens."""
        if user.USER_ROLE not in (
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ):
            raise OAuthLoginDenied()
        if user.USER_STATUS not in (
            User.UserStatus.ACTIVE,
            User.UserStatus.PENDING,
        ):
            raise OAuthAccountInactive(
                f"Account is {user.USER_STATUS}. Please contact support.",
            )

    @staticmethod
    def get_or_create_user(oauth_user: OAuthUser) -> User:
        """Resolve an allowed OAuth account and verify or create its user."""
        with transaction.atomic():
            # First, we check if the user has previously logged in with this OAuth provider.
            oauth_account = (
                OAuthAccount.objects.filter(
                    OAUTH_PROVIDER=oauth_user.provider,
                    OAUTH_PROVIDER_ID=oauth_user.provider_id,
                )
                .select_related("USER")
                .first()
            )
           
            # If the user has previously logged in with this OAuth provider, 
            # we update their last login timestamp and return the associated User.
            if oauth_account:
                user = oauth_account.USER
                OAuthAccountService._validate_user_access(user)

                oauth_account.OAUTH_LAST_LOGIN = timezone.now()
                oauth_account.save(update_fields=["OAUTH_LAST_LOGIN"])

                if (
                    not user.EMAIL_VERIFIED
                    or user.USER_STATUS == User.UserStatus.PENDING
                ):
                    user.EMAIL_VERIFIED = True
                    if user.EMAIL_VERIFIED_AT is None:
                        user.EMAIL_VERIFIED_AT = timezone.now()
                    user.USER_STATUS = User.UserStatus.ACTIVE
                    user.save(
                        update_fields=[
                            "EMAIL_VERIFIED",
                            "EMAIL_VERIFIED_AT",
                            "USER_STATUS",
                        ]
                    )

                return user

            user = User.objects.filter(
                USER_EMAIL__iexact=oauth_user.email
            ).first()


            # If the user exists, we update their email verification 
            # status and account status if necessary. 
            if user:
                OAuthAccountService._validate_user_access(user)
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
            # If the user does not exist, we create a new account with the provided OAuth information.
            # If no user exists, create one.
            else:
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

            # print("OAUTH USER:", model_to_dict(oauth_user))
            # Link the user to this OAuth provider.
            # If the link already exists, update the provider ID if necessary.
            OAuthAccount.objects.update_or_create(
                USER=user,
                OAUTH_PROVIDER=oauth_user.provider,
                defaults={
                    "OAUTH_PROVIDER_ID": oauth_user.provider_id,
                    "OAUTH_AVATAR_URL": oauth_user.avatar_url,
                },
            )

            return user
