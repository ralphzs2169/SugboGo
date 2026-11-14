from urllib.parse import parse_qs, urlsplit

from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.authentication.services.verification_service import (
    EmailVerificationService,
)
from apps.authentication.tokens import email_verification_token_generator

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


    @override_settings(EMAIL_VERIFICATION_URL="https://sugbogo.app/verify-email")
    def test_mobile_verification_link_preserves_signed_proof(self):
        link = urlsplit(
            EmailVerificationService.generate_verification_link(self.user),
        )
        self.assertEqual(link.scheme, "https")
        self.assertEqual(link.netloc, "sugbogo.app")
        self.assertEqual(link.path, "/verify-email")
        query = parse_qs(link.query)
        self.assertEqual(set(query), {"uid", "token"})
        self.assertEqual(query["uid"], [urlsafe_base64_encode(force_bytes(self.user.pk))])
        self.assertEqual(len(query["token"]), 1)
        self.assertTrue(
            email_verification_token_generator.check_token(
                self.user,
                query["token"][0],
            ),
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

    def test_changing_email_invalidates_verification_token(self):
        link = EmailVerificationService.generate_verification_link(
            self.user
        )
        uid = link.split("uid=")[1].split("&")[0]
        token = link.split("token=")[1]

        self.user.USER_EMAIL = "changed@example.com"
        self.user.save(update_fields=["USER_EMAIL"])

        self.assertIsNone(
            EmailVerificationService.verify_token(
                uid,
                token,
            )
        )
