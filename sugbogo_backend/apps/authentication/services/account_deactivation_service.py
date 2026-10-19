from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.authentication.services.session_service import SessionService
from apps.users.models import User


class AccountDeactivationService:
    """Disables a consumer account without deleting its contributions or business."""

    @staticmethod
    @transaction.atomic
    def deactivate(*, user: User, current_password: str) -> User:
        """Verifies password ownership and atomically disables all existing sessions."""
        try:
            account = User.objects.select_for_update().get(pk=user.pk)
        except User.DoesNotExist as exc:
            raise PermissionDenied("This account is no longer available.") from exc

        if not account.is_active or not account.EMAIL_VERIFIED:
            raise PermissionDenied("This account is no longer active and verified.")
        if account.USER_ROLE not in (
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ):
            raise PermissionDenied("Administrative accounts cannot deactivate themselves.")
        if not account.has_usable_password():
            raise ValidationError(
                {
                    "current_password": (
                        "Use email recovery to set up a password before deactivating."
                    ),
                }
            )
        if not account.check_password(current_password):
            raise ValidationError(
                {"current_password": "Your current password is incorrect."}
            )

        # Rehash the same password so CHECK_REVOKE_TOKEN rejects old access JWTs
        # even if an administrator reactivates the account before they expire.
        account.set_password(current_password)
        account.USER_STATUS = User.UserStatus.DISABLED
        account.save(
            update_fields=["password", "USER_STATUS", "USER_UPDATED_AT"],
        )
        SessionService.revoke_all_sessions(account)
        return account
