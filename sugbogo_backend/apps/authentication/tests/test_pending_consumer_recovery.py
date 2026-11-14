from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core.cache import cache
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase

from apps.authentication.services.email_service import EmailService
from apps.authentication.tokens import (
    email_verification_token_generator,
    password_reset_token_generator,
)
from apps.users.models import User


class PendingConsumerRecoveryTests(APITestCase):
    """Show that pending consumer accounts can complete setup through mailbox proof."""

    password = "Mailbox-Owner-Password-415!"

    def create_pending(
        self,
        role,
        *,
        verified=False,
        password=None,
    ):
        """Create a pending consumer with or without existing mailbox verification."""
        cache.clear()
        return User.objects.create_user(
            email=f"{role}-{verified}@example.com",
            password=password,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.PENDING,
            EMAIL_VERIFIED=verified,
        )

    def email_proof(self, endpoint, context_key, user):
        """Read the actual issued proof at the mocked email delivery boundary."""
        with patch.object(EmailService, "send_email") as send:
            response = self.client.post(
                reverse(endpoint),
                {"email": user.USER_EMAIL},
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.data)
        send.assert_called_once()
        link = send.call_args.kwargs["context"][context_key]
        query = parse_qs(urlparse(link).query)
        return {"uid": query["uid"][0], "token": query["token"][0]}

    def redeem(self, endpoint, proof):
        """Submit the appropriate password proof for the existing route."""
        payload = {**proof, "password": self.password}
        if endpoint == "reset_password":
            payload["confirm_password"] = self.password
        return self.client.post(
            reverse(endpoint),
            payload,
            format="json",
        )

    def test_pending_explorer_and_merchant_can_verify_and_activate(self):
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            with self.subTest(role=role):
                user = self.create_pending(role, password=self.password)
                registration_hash = user.password
                proof = self.email_proof("resend_verification", "verification_link", user)
                response = self.redeem("verify_email", proof)
                self.assertEqual(response.status_code, 200, response.data)
                user.refresh_from_db()
                self.assertTrue(user.EMAIL_VERIFIED)
                self.assertTrue(user.is_active)
                self.assertEqual(user.USER_ROLE, role)
                self.assertEqual(user.password, registration_hash)

    def test_pending_consumer_reset_requires_fresh_verification_when_unverified(self):
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            with self.subTest(role=role):
                user = self.create_pending(role)
                previous_verification = {
                    "uid": urlsafe_base64_encode(force_bytes(user.pk)),
                    "token": email_verification_token_generator.make_token(user),
                }
                self.assertFalse(user.has_usable_password())
                self.assertEqual(
                    self.redeem("verify_email", previous_verification).status_code,
                    400,
                )
                proof = self.email_proof("forgot_password", "reset_link", user)
                response = self.redeem("reset_password", proof)
                self.assertEqual(response.status_code, 200, response.data)
                user.refresh_from_db()
                self.assertFalse(user.EMAIL_VERIFIED)
                self.assertEqual(user.USER_STATUS, User.UserStatus.PENDING)

                stale = self.redeem("verify_email", previous_verification)
                self.assertEqual(stale.data["code"], "INVALID_VERIFICATION_LINK")
                sign_in = self.client.post(
                    reverse("login"),
                    {"email": user.USER_EMAIL, "password": self.password},
                    format="json",
                )
                self.assertEqual(sign_in.data["code"], "EMAIL_NOT_VERIFIED")
                fresh_proof = self.email_proof("resend_verification", "verification_link", user)
                verification = self.redeem(
                    "verify_email",
                    fresh_proof,
                )
                self.assertEqual(verification.status_code, 200, verification.data)
                login = self.client.post(
                    reverse("login"),
                    {"email": user.USER_EMAIL, "password": self.password},
                    format="json",
                )
                self.assertEqual(login.status_code, 200, login.data)

    def test_previously_verified_pending_consumers_can_finish_recovery(self):
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            with self.subTest(role=role):
                user = self.create_pending(role, verified=True)
                proof = self.email_proof("forgot_password", "reset_link", user)
                response = self.redeem("reset_password", proof)
                self.assertEqual(response.status_code, 200, response.data)
                user.refresh_from_db()
                self.assertTrue(user.is_active)
                self.assertTrue(user.EMAIL_VERIFIED)
                self.assertTrue(user.check_password(self.password))
