from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Generate tokens that are valid only for email verification."""

    key_salt = "apps.authentication.tokens.EmailVerificationTokenGenerator"


class PasswordResetPurposeTokenGenerator(PasswordResetTokenGenerator):
    """Generate tokens that are valid only for password reset."""

    key_salt = "apps.authentication.tokens.PasswordResetPurposeTokenGenerator"


email_verification_token_generator = EmailVerificationTokenGenerator()
password_reset_token_generator = PasswordResetPurposeTokenGenerator()
