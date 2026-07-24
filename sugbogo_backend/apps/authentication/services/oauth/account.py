from apps.users.models import User
from django.utils import timezone

from .base import OAuthUser
from apps.authentication.models import OAuthAccount
from django.db import transaction


class OAuthAccountService:
    """
    Handles account lookup and creation for OAuth providers.

    Every OAuth provider (Google, Facebook, Apple)
    should use this service instead of touching the
    User model directly.
    """

    @staticmethod
    def get_or_create_user(oauth_user: OAuthUser) -> User:
        with transaction.atomic():
            """
            Finds an existing user by email or creates a new account.

            The returned User is always ready to receive JWT tokens.
            """

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
                oauth_account.OAUTH_LAST_LOGIN = timezone.now()
                oauth_account.save(update_fields=["OAUTH_LAST_LOGIN"])

                user = oauth_account.USER

                if not user.EMAIL_VERIFIED:
                    user.EMAIL_VERIFIED = True
                    user.EMAIL_VERIFIED_AT = timezone.now()
                    user.save(
                        update_fields=[
                            "EMAIL_VERIFIED",
                            "EMAIL_VERIFIED_AT",
                        ]
                    )

                return user

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