from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError

from apps.authentication.services.session_service import SessionService
from apps.authentication.tokens import admin_invitation_token_generator
from apps.users.models import User


class AdminInvitationService:
    """Generates, validates, and completes dedicated Admin invitations."""

    @staticmethod
    def generate_invitation_link(user: User) -> str:
        """Builds the Web Admin account-setup link for an invited Admin."""
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = admin_invitation_token_generator.make_token(user)

        return (
            f"{settings.WEB_APP_URL.rstrip('/')}/admin/setup-account"
            f"?uid={uid}"
            f"&token={token}"
        )

    @staticmethod
    def get_invitation_expiry_hours() -> int:
        """Returns the shared Django token timeout expressed in hours."""
        return settings.PASSWORD_RESET_TIMEOUT // 3600

    @staticmethod
    def _decode_user_id(uid: str) -> str | None:
        """Decodes an invitation UID without exposing parsing details."""
        try:
            return force_str(
                urlsafe_base64_decode(uid),
            )
        except (
            TypeError,
            ValueError,
            OverflowError,
        ):
            return None

    @staticmethod
    def _is_invitation_eligible(user: User) -> bool:
        """Checks whether an account is still awaiting Admin setup."""
        return (
            user.USER_ROLE == User.UserRole.ADMIN
            and user.USER_STATUS == User.UserStatus.PENDING
            and not user.EMAIL_VERIFIED
            and not user.has_usable_password()
        )

    @staticmethod
    def verify_token(
        uid: str,
        token: str,
    ) -> User | None:
        """Returns the invited Admin when the invitation is valid and incomplete."""
        user_id = AdminInvitationService._decode_user_id(uid)

        if user_id is None:
            return None

        try:
            user = User.objects.get(pk=user_id)
        except (
            TypeError,
            ValueError,
            OverflowError,
            User.DoesNotExist,
        ):
            return None

        if not AdminInvitationService._is_invitation_eligible(user):
            return None

        if not admin_invitation_token_generator.check_token(user, token):
            return None

        return user

    @staticmethod
    @transaction.atomic
    def complete_invitation(
        *,
        uid: str,
        token: str,
        password: str,
        confirm_password: str,
    ) -> User | None:
        """Completes one valid invitation while locking its target account."""
        user_id = AdminInvitationService._decode_user_id(uid)

        if user_id is None:
            return None

        try:
            user = (
                User.objects
                .select_for_update()
                .get(pk=user_id)
            )
        except (
            TypeError,
            ValueError,
            OverflowError,
            User.DoesNotExist,
        ):
            return None

        if not AdminInvitationService._is_invitation_eligible(user):
            return None

        if not admin_invitation_token_generator.check_token(user, token):
            return None

        if password != confirm_password:
            raise ValidationError(
                {
                    "confirm_password": "Passwords do not match.",
                },
            )

        try:
            validate_password(
                password,
                user=user,
            )
        except DjangoValidationError as exc:
            raise ValidationError(
                {
                    "password": exc.messages,
                },
            ) from exc

        user.set_password(password)
        user.EMAIL_VERIFIED = True
        user.EMAIL_VERIFIED_AT = timezone.now()
        user.USER_STATUS = User.UserStatus.ACTIVE

        SessionService.revoke_all_sessions(user)

        user.save(
            update_fields=[
                "password",
                "EMAIL_VERIFIED",
                "EMAIL_VERIFIED_AT",
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        return user
