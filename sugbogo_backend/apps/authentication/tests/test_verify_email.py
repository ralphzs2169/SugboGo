from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.core.cache import cache
from django.db import DatabaseError, close_old_connections, transaction
from django.test import override_settings, skipUnlessDBFeature
from django.urls import reverse
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import status
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from apps.users.models import User
from apps.authentication.tokens import email_verification_token_generator
from core.tests.assertions import APIResponseAssertionsMixin


class VerifyEmailViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the email verification endpoint."""


    def setUp(self):
        self.url = reverse("verify_email")

        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.uid = urlsafe_base64_encode(
            force_bytes(self.user.pk)
        )

        self.token = email_verification_token_generator.make_token(
            self.user
        )


    def test_verify_email_successfully(self):
        response = self.client.get(
            self.url,
            {
                "uid": self.uid,
                "token": self.token,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.user.refresh_from_db()

        self.assertTrue(
            self.user.EMAIL_VERIFIED
        )

        self.assertIsNotNone(
            self.user.EMAIL_VERIFIED_AT
        )

        self.assertEqual(
            response.data["message"],
            "Email verified successfully.",
        )


    def test_verify_email_returns_already_verified(self):
        self.user.EMAIL_VERIFIED = True
        self.user.save()

        response = self.client.get(
            self.url,
            {
                "uid": self.uid,
                "token": self.token,
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["message"],
            "Email is already verified.",
        )


    def test_verify_email_requires_uid_and_token(self):
        response = self.client.get(self.url)

        self.assertErrorResponse(
            response,
            message="Missing verification credentials.",
            code="MISSING_CREDENTIALS",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


    def test_verify_email_with_invalid_uid(self):
        response = self.client.get(
            self.url,
            {
                "uid": "invalid",
                "token": self.token,
            },
        )

        self.assertErrorResponse(
            response,
            message="This verification link is invalid or has expired. Please request a new verification email.",
            code="INVALID_VERIFICATION_LINK",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


    def test_verify_email_with_invalid_token(self):
        response = self.client.get(
            self.url,
            {
                "uid": self.uid,
                "token": "invalid-token",
            },
        )

        self.assertErrorResponse(
            response,
            message=(
                "This verification link is invalid or has expired. "
                "Please request a new verification email."
            ),
            code="INVALID_VERIFICATION_LINK",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    @override_settings(PASSWORD_RESET_TIMEOUT=1)
    def test_expired_verification_does_not_update_the_account(self):
        """Return the existing invalid-link response when a signed proof has expired."""
        issued_at = datetime(2026, 1, 1, 12, 0, 0)
        with patch.object(
            email_verification_token_generator,
            "_now",
            return_value=issued_at,
        ):
            proof = email_verification_token_generator.make_token(self.user)

        with patch.object(
            email_verification_token_generator,
            "_now",
            return_value=issued_at + timedelta(seconds=2),
        ):
            response = self.client.get(
                self.url,
                {"uid": self.uid, "token": proof},
            )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["code"], "INVALID_VERIFICATION_LINK")
        self.user.refresh_from_db()
        self.assertFalse(self.user.EMAIL_VERIFIED)
        self.assertIsNone(self.user.EMAIL_VERIFIED_AT)


@skipUnlessDBFeature("has_select_for_update_nowait")
class VerifyEmailConcurrencyTests(APITransactionTestCase):
    """Exercise overlapping verification requests on independent database connections."""

    def test_concurrent_requests_verify_once_with_one_timestamp(self):
        """Hold the first write open while a second request attempts the same proof."""
        cache.clear()
        user = User.objects.create_user(
            email="verify-concurrency@example.com",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        proof = {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": email_verification_token_generator.make_token(user),
        }
        start = Barrier(2)
        writing = Event()
        release = Event()
        original_save = User.save

        def pause_save(account, **kwargs):
            """Pause the verification write while the account row is locked."""
            writing.set()
            if not release.wait(timeout=10):
                raise AssertionError("Verification write was not released")
            return original_save(account, **kwargs)

        def verify():
            """Submit the proof on a separate database connection."""
            close_old_connections()
            try:
                start.wait(timeout=10)
                return APIClient().get(reverse("verify_email"), proof)
            finally:
                close_old_connections()

        with patch.object(User, "save", autospec=True, side_effect=pause_save) as save:
            with ThreadPoolExecutor(max_workers=2) as executor:
                requests = [executor.submit(verify) for _ in range(2)]
                try:
                    self.assertTrue(writing.wait(timeout=10))
                    with self.assertRaises(DatabaseError):
                        with transaction.atomic():
                            User.objects.select_for_update(nowait=True).get(pk=user.pk)
                finally:
                    release.set()
                responses = [request.result(timeout=10) for request in requests]

        self.assertEqual([response.status_code for response in responses], [200, 200])
        self.assertCountEqual(
            [response.data["message"] for response in responses],
            ["Email verified successfully.", "Email is already verified."],
        )
        save.assert_called_once()
        user.refresh_from_db()
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertEqual(user.EMAIL_VERIFIED_AT, save.call_args.args[0].EMAIL_VERIFIED_AT)
