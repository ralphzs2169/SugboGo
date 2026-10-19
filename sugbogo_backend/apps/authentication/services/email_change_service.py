import hashlib
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.authentication.models import EmailChangeRequest
from apps.authentication.services.email_service import EmailService
from apps.authentication.services.session_service import SessionService
from apps.users.models import User

logger = logging.getLogger(__name__)


class EmailChangeDeliveryUnavailable(APIException):
    """Reports verification delivery failure without changing the pending request."""

    status_code = 503
    default_detail = "Unable to send the verification email. Please try again."
    default_code = "email_delivery_unavailable"


class EmailChangeService:
    """Coordinates email ownership proof without changing the active address early."""

    @staticmethod
    def _auth_state(user):
        """Binds a request to the current identity and credential state without exposing it."""
        return salted_hmac(
            "sugbogo.email_change.auth_state",
            f"{user.pk}:{user.USER_EMAIL}:{user.password}:{user.USER_STATUS}",
            algorithm="sha256",
        ).hexdigest()

    @staticmethod
    def _require_eligible(user):
        """Restricts mobile self-service changes to active, verified consumer accounts."""
        if not user.is_active or not user.EMAIL_VERIFIED:
            raise PermissionDenied("This account is no longer active and verified.")
        if user.USER_ROLE not in (
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ):
            raise PermissionDenied("This account cannot use mobile email changes.")

    @staticmethod
    def _require_password(user, password):
        """Requires password setup or exact proof of the existing usable password."""
        if not user.has_usable_password():
            raise ValidationError(
                {"current_password": (
                    "Use email recovery to set up a password before changing your email."
                )},
            )
        if not user.check_password(password):
            raise ValidationError(
                {"current_password": "Your current password is incorrect."},
            )

    @staticmethod
    def _require_available(email, user):
        """Rejects the current address and addresses already held by another account."""
        if email.casefold() == user.USER_EMAIL.casefold():
            raise ValidationError(
                {"new_email": "Choose an email different from your current email."},
            )
        if User.objects.filter(USER_EMAIL__iexact=email).exclude(pk=user.pk).exists():
            raise ValidationError({"new_email": "This email is unavailable."})

    @staticmethod
    def _locked_user(user_id):
        """Retrieves authoritative account state under the shared session lock."""
        try:
            return User.objects.select_for_update().get(pk=user_id)
        except User.DoesNotExist as exc:
            raise PermissionDenied("This account is no longer available.") from exc

    @staticmethod
    def _valid(pending, user):
        """Checks expiry and whether the account still matches the original request."""
        return (
            pending.ECHG_EXPIRES_AT > timezone.now()
            and constant_time_compare(
                pending.ECHG_AUTH_STATE,
                EmailChangeService._auth_state(user),
            )
        )

    @staticmethod
    @transaction.atomic
    def request_change(*, user, new_email, current_password):
        """Replaces a pending proof and sends it while preserving the active email."""
        account = EmailChangeService._locked_user(user.pk)
        EmailChangeService._require_eligible(account)
        EmailChangeService._require_password(account, current_password)
        email = User.objects.normalize_email(new_email.strip()).casefold()
        EmailChangeService._require_available(email, account)
        secret = secrets.token_urlsafe(32)
        pending, _ = EmailChangeRequest.objects.update_or_create(
            USER_ID=account,
            defaults={
                "ECHG_NEW_EMAIL": email,
                "ECHG_TOKEN_HASH": hashlib.sha256(secret.encode()).hexdigest(),
                "ECHG_AUTH_STATE": EmailChangeService._auth_state(account),
                "ECHG_EXPIRES_AT": timezone.now() + timedelta(
                    seconds=settings.EMAIL_CHANGE_TIMEOUT_SECONDS,
                ),
            },
        )
        scheme = settings.MOBILE_SCHEME.rstrip(":/")
        link = f"{scheme}://confirm-email-change?" + urlencode(
            {"request_id": str(pending.pk), "token": secret},
        )
        try:
            EmailService.send_email_change_verification(account, email, link)
        except Exception as exc:
            raise EmailChangeDeliveryUnavailable() from exc
        return EmailChangeService._pending_data(pending)

    @staticmethod
    def _pending_data(pending):
        """Serializes the pending destination and deadline without its secret material."""
        return {
            "new_email": pending.ECHG_NEW_EMAIL,
            "expires_at": pending.ECHG_EXPIRES_AT,
        }

    @staticmethod
    @transaction.atomic
    def status(user):
        """Returns only usable pending state so the mobile flow can resume after reopening."""
        account = EmailChangeService._locked_user(user.pk)
        EmailChangeService._require_eligible(account)
        pending = EmailChangeRequest.objects.filter(USER_ID=account).first()
        return {
            "current_email": account.USER_EMAIL,
            "pending": EmailChangeService._pending_data(pending)
            if pending and EmailChangeService._valid(pending, account) else None,
        }

    @staticmethod
    @transaction.atomic
    def cancel(user):
        """Invalidates the current account's pending link without changing its email."""
        account = EmailChangeService._locked_user(user.pk)
        EmailChangeService._require_eligible(account)
        EmailChangeRequest.objects.filter(USER_ID=account).delete()

    @staticmethod
    @transaction.atomic
    def confirm(*, request_id, token, current_password):
        """Consumes ownership proof, updates the verified email, and revokes old sessions."""
        user_id = (
            EmailChangeRequest.objects.filter(pk=request_id)
            .values_list("USER_ID", flat=True)
            .first()
        )
        if user_id is None:
            raise ValidationError({"token": "This email-change link is invalid or has expired."})
        account = EmailChangeService._locked_user(user_id)
        pending = (
            EmailChangeRequest.objects.select_for_update()
            .filter(pk=request_id)
            .first()
        )
        EmailChangeService._require_eligible(account)
        if (
            pending is None
            or not EmailChangeService._valid(pending, account)
            or not constant_time_compare(
                pending.ECHG_TOKEN_HASH,
                hashlib.sha256(token.encode()).hexdigest(),
            )
        ):
            raise ValidationError({"token": "This email-change link is invalid or has expired."})
        EmailChangeService._require_password(account, current_password)
        EmailChangeService._require_available(pending.ECHG_NEW_EMAIL, account)
        old_email = account.USER_EMAIL
        account.USER_EMAIL = pending.ECHG_NEW_EMAIL
        account.EMAIL_VERIFIED_AT = timezone.now()
        # Rehash the same password so access JWTs issued before this change stay revoked.
        account.set_password(current_password)
        try:
            with transaction.atomic():
                account.save(
                    update_fields=[
                        "USER_EMAIL", "EMAIL_VERIFIED_AT", "password", "USER_UPDATED_AT",
                    ],
                )
        except IntegrityError as exc:
            raise ValidationError({"new_email": "This email is unavailable."}) from exc
        SessionService.revoke_all_sessions(account)
        pending.delete()
        transaction.on_commit(
            lambda: EmailChangeService._notify_previous_address(account, old_email),
        )
        return {"user_id": account.pk, "email": account.USER_EMAIL}

    @staticmethod
    def _notify_previous_address(user, old_email):
        """Attempts the security notice without undoing a committed identity change."""
        try:
            EmailService.send_email_changed_notice(user, old_email)
        except Exception:
            logger.exception(
                "Unable to deliver the email-change security notice for user %s", user.pk,
            )
