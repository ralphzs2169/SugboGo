from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Generate tokens that are valid only for email verification."""

    key_salt = "apps.authentication.tokens.EmailVerificationTokenGenerator"


class PasswordResetPurposeTokenGenerator(PasswordResetTokenGenerator):
    """Generate tokens that are valid only for password reset."""

    key_salt = "apps.authentication.tokens.PasswordResetPurposeTokenGenerator"


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
admin_invitation_token_generator = AdminInvitationTokenGenerator()
