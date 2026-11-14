from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.authentication.models import OAuthAccount
from apps.users.models import User

from .base import OAuthUser


class OAuthAccountInactive(PermissionDenied):
    """Reject OAuth access for suspended or disabled accounts."""

    default_detail = "Sign-in is unavailable. Contact SugboGo support for help."
    default_code = "account_inactive"


class OAuthLoginDenied(PermissionDenied):
    """Keep administrative accounts outside mobile OAuth login."""

    default_detail = "This sign-in method is unavailable here. Use your usual SugboGo sign-in."
    default_code = "oauth_login_denied"


class OAuthLinkRequired(PermissionDenied):
    """Require existing-account proof before accepting an unsafe OAuth link."""

    default_detail = (
        "Use your usual sign-in or sign up by email. To recover access, use Forgot "
        "password. If email setup is required, request a fresh verification link "
        "and choose a different password to finish setup."
    )
    default_code = "oauth_link_required"


class OAuthAccountService:
    """Resolve provider subjects and require current mailbox authority for new links."""

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
            raise OAuthAccountInactive()

    @staticmethod
    @transaction.atomic
    def get_or_create_user(oauth_user: OAuthUser) -> User:
        """Resolve a stable subject under the same account lock used by mailbox recovery."""
        subject = {
            "OAUTH_PROVIDER": oauth_user.provider,
            "OAUTH_PROVIDER_ID": oauth_user.provider_id,
        }
        linked_user_id = (
            OAuthAccount.objects.filter(**subject)
            .values_list("USER_id", flat=True)
            .first()
        )
        users = User.objects.select_for_update()
        if linked_user_id is not None:
            user = users.filter(pk=linked_user_id).first()
            # Recovery may remove the link before this request gets the user lock.
            link = OAuthAccount.objects.filter(
                USER_id=linked_user_id,
                **subject,
            ).first()
            if user is None or link is None:
                raise OAuthLinkRequired()
            OAuthAccountService._validate_user_access(user)
        else:
            if not oauth_user.email_authoritative:
                raise OAuthLinkRequired()

            user = users.filter(USER_EMAIL__iexact=oauth_user.email).first()
            if user is not None:
                OAuthAccountService._validate_user_access(user)

            if user is None:
                try:
                    with transaction.atomic():
                        user = User.objects.create_user(
                            email=oauth_user.email,
                            USER_FNAME=oauth_user.first_name,
                            USER_LNAME=oauth_user.last_name,
                            USER_ROLE=User.UserRole.EXPLORER,
                            USER_STATUS=User.UserStatus.ACTIVE,
                            EMAIL_VERIFIED=True,
                            EMAIL_VERIFIED_AT=timezone.now(),
                        )
                except IntegrityError:
                    user = users.filter(USER_EMAIL__iexact=oauth_user.email).first()
                    if user is None:
                        raise
                    OAuthAccountService._validate_user_access(user)

            link = OAuthAccount.objects.filter(
                USER=user,
                OAUTH_PROVIDER=oauth_user.provider,
            ).first()
            if link is None:
                link, _ = OAuthAccount.objects.get_or_create(
                    **subject,
                    defaults={
                        "USER": user,
                        "OAUTH_AVATAR_URL": oauth_user.avatar_url,
                    },
                )
            if (
                link.USER_id != user.pk
                or link.OAUTH_PROVIDER_ID != oauth_user.provider_id
            ):
                raise OAuthLinkRequired()

        if (
            not user.EMAIL_VERIFIED
            or user.USER_STATUS == User.UserStatus.PENDING
        ):
            another_link_exists = OAuthAccount.objects.filter(
                USER=user,
            ).exclude(pk=link.pk).exists()
            if (
                not oauth_user.email_authoritative
                or oauth_user.email.casefold() != user.USER_EMAIL.casefold()
                or another_link_exists
                or (
                    not user.EMAIL_VERIFIED
                    and user.has_usable_password()
                )
            ):
                raise OAuthLinkRequired()

            user.EMAIL_VERIFIED = True
            if user.EMAIL_VERIFIED_AT is None:
                user.EMAIL_VERIFIED_AT = timezone.now()
            user.USER_STATUS = User.UserStatus.ACTIVE
            user.save(
                update_fields=[
                    "EMAIL_VERIFIED",
                    "EMAIL_VERIFIED_AT",
                    "USER_STATUS",
                ],
            )

        link.save(update_fields=["OAUTH_LAST_LOGIN"])
        return user
