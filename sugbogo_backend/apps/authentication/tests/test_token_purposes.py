from django.test import TestCase
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.authentication.services.password_reset_service import (
    PasswordResetService,
)
from apps.authentication.services.verification_service import (
    EmailVerificationService,
)
from apps.authentication.tokens import (
    email_verification_token_generator,
    password_reset_token_generator,
)
from apps.users.models import User


class AuthenticationTokenPurposeTests(TestCase):
    """Ensure authentication tokens are accepted only by their own flow."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="purpose-test@example.com",
            password="TestOnly-StrongPassword-482!",
            USER_FNAME="Purpose",
            USER_LNAME="Test",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))

    def test_verification_token_is_rejected_by_password_reset(self):
        token = email_verification_token_generator.make_token(self.user)

        self.assertEqual(
            EmailVerificationService.verify_token(self.uid, token),
            self.user,
        )
        self.assertIsNone(
            PasswordResetService.verify_token(self.uid, token)
        )

    def test_password_reset_token_is_rejected_by_verification(self):
        token = password_reset_token_generator.make_token(self.user)

        self.assertEqual(
            PasswordResetService.verify_token(self.uid, token),
            self.user,
        )
        self.assertIsNone(
            EmailVerificationService.verify_token(self.uid, token)
        )
