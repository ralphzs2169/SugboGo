from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.authentication.services.session_service import SessionService
from apps.users.models import User


class ChangePasswordService:
    """Changes an authenticated account's password after current-password proof."""

    @staticmethod
    @transaction.atomic
    def change_password(
        user: User,
        current_password: str,
        new_password: str,
    ) -> User:
        """Validates the locked account, saves its password, and revokes refresh tokens."""
        try:
            account = User.objects.select_for_update().get(pk=user.pk)
        except User.DoesNotExist as exc:
            raise PermissionDenied("This account is no longer available.") from exc

        if not account.is_active:
            raise PermissionDenied("This account is no longer active.")

        if not account.has_usable_password():
            raise ValidationError(
                {
                    "current_password": (
                        "Use Forgot Password to set up a password for this account."
                    ),
                }
            )

        if not account.check_password(current_password):
            raise ValidationError(
                {"current_password": "Your current password is incorrect."}
            )

        if current_password == new_password:
            raise ValidationError(
                {
                    "new_password": (
                        "Choose a password different from your current password."
                    ),
                }
            )

        try:
            validate_password(new_password, user=account)
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": exc.messages}) from exc

        account.set_password(new_password)
        account.save(update_fields=["password", "USER_UPDATED_AT"])
        SessionService.revoke_all_sessions(account)
        return account
