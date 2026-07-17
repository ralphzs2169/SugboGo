from django.test import TestCase

from apps.authentication.services.verification_service import (
    EmailVerificationService,
)

from apps.users.models import User


class EmailVerificationServiceTests(TestCase):
    """Unit Tests for the EmailVerificationService class."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )


    def test_generate_verification_link_contains_credentials(self):
        link = EmailVerificationService.generate_verification_link(
            self.user
        )

        self.assertIn(
            "uid=",
            link,
        )

        self.assertIn(
            "token=",
            link,
        )


    def test_verify_token_returns_user_for_valid_token(self):
        link = EmailVerificationService.generate_verification_link(
            self.user
        )

        uid = link.split("uid=")[1].split("&")[0]
        token = link.split("token=")[1]

        result = EmailVerificationService.verify_token(
            uid,
            token,
        )

        self.assertEqual(
            result,
            self.user,
        )


    def test_verify_token_returns_none_for_invalid_token(self):
        result = EmailVerificationService.verify_token(
            "invalid",
            "invalid",
        )

        self.assertIsNone(result)