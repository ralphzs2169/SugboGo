from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import base36_to_int


class ConsumerMailboxTokenGenerator(PasswordResetTokenGenerator):
    """Invalidate outstanding consumer links when email verification succeeds."""

    def __init__(self):
        super().__init__()
        self.legacy_generator = PasswordResetTokenGenerator()
        self.legacy_generator.key_salt = self.key_salt

    def _make_hash_value(self, user, timestamp):
        return (
            f"{super()._make_hash_value(user, timestamp)}"
            f"|{user.EMAIL_VERIFIED}|{user.EMAIL_VERIFIED_AT}"
        )

    def check_token(self, user, token):
        if super().check_token(user, token):
            return True

        if not self.legacy_generator.check_token(user, token):
            return False

        if user.EMAIL_VERIFIED_AT is None:
            return True

        # Django's legacy tokens record local time in whole seconds. Treat the
        # verification second as consumed because it cannot establish ordering.
        issued_at = base36_to_int(token.split("-", 1)[0])
        verified_at = user.EMAIL_VERIFIED_AT.astimezone().replace(tzinfo=None)
        return issued_at > self._num_seconds(verified_at)


class EmailVerificationTokenGenerator(ConsumerMailboxTokenGenerator):
    """Generate tokens that are valid only for email verification."""

    key_salt = "apps.authentication.tokens.EmailVerificationTokenGenerator"


class PasswordResetPurposeTokenGenerator(ConsumerMailboxTokenGenerator):
    """Generate tokens that are valid only for password reset."""

    key_salt = "apps.authentication.tokens.PasswordResetPurposeTokenGenerator"


class AdminPasswordResetTokenGenerator(PasswordResetTokenGenerator):
    """Separate Admin recovery proof from tokens issued by mobile recovery."""

    key_salt = "apps.authentication.tokens.AdminPasswordResetTokenGenerator"


class AdminInvitationTokenGenerator(PasswordResetTokenGenerator):
    """Generate state-bound tokens used only for Admin account setup."""

    key_salt = "apps.authentication.tokens.AdminInvitationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        """Bind invitations to password, email, role, status, and verification state."""
        return (
            f"{super()._make_hash_value(user, timestamp)}"
            f"{user.USER_ROLE}"
            f"{user.USER_STATUS}"
            f"{user.EMAIL_VERIFIED}"
        )


email_verification_token_generator = EmailVerificationTokenGenerator()
password_reset_token_generator = PasswordResetPurposeTokenGenerator()
admin_password_reset_token_generator = AdminPasswordResetTokenGenerator()
admin_invitation_token_generator = AdminInvitationTokenGenerator()
