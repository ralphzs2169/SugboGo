from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
from datetime import datetime, timezone
from apps.core.tests.assertions import APIResponseAssertionsMixin

from rest_framework_simplejwt.tokens import RefreshToken

class LoginViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the user login endpoint."""

    def setUp(self):
        self.url = reverse("login")

        self.password = "StrongPassword123!"

        self.user = User.objects.create_user(
            email="john@example.com",
            password=self.password,
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )


    def test_login_successfully_returns_tokens(self):
        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)

        self.assertEqual(
            response.data["user"]["email"],
            "john@example.com",
        )


    def test_login_fails_with_wrong_password(self):
        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
                "password": "WrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertEqual(
            response.data["detail"],
            "Invalid email or password.",
        )


    def test_login_fails_with_nonexistent_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "missing@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertEqual(
            response.data["detail"],
            "Invalid email or password.",
        )


    def test_login_fails_when_email_not_verified(self):
        self.user.EMAIL_VERIFIED = False
        self.user.save()

        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertEqual(
            response.data["code"],
            "EMAIL_NOT_VERIFIED",
        )


    def test_login_fails_when_account_is_suspended(self):
        self.user.USER_STATUS = User.UserStatus.SUSPENDED
        self.user.save()

        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertIn(
            "Account is suspended",
            response.data["detail"],
        )


    def test_login_requires_email_and_password(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertValidationError(
            response,
            "email",
            "password"
        )



    def test_login_rejects_invalid_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "not-an-email",
                "password": self.password,
            },
            format="json",
        )

        self.assertValidationError(
            response,
            "email",
        )


    def test_login_with_remember_me_false_uses_short_refresh_lifetime(self):
        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
                "password": self.password,
                "remember_me": False,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        refresh = RefreshToken(response.data["refresh"])

        expires_at = datetime.fromtimestamp(
            refresh["exp"],
            tz=timezone.utc,
        )

        remaining = expires_at - datetime.now(timezone.utc)

        # Allow a small tolerance because a few milliseconds/seconds
        # pass between issuing the token and checking it.
        self.assertLessEqual(
            remaining.total_seconds(),
            12 * 60 * 60,
        )

        self.assertGreater(
            remaining.total_seconds(),
            (12 * 60 * 60) - 60,
        )


    def test_login_with_remember_me_true_keeps_default_refresh_lifetime(self):
        response = self.client.post(
            self.url,
            {
                "email": "john@example.com",
                "password": self.password,
                "remember_me": True,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        refresh = RefreshToken(response.data["refresh"])

        expires_at = datetime.fromtimestamp(
            refresh["exp"],
            tz=timezone.utc,
        )

        remaining = expires_at - datetime.now(timezone.utc)

        # Default SIMPLE_JWT refresh lifetime is 30 days.
        self.assertGreater(
            remaining.total_seconds(),
            29 * 24 * 60 * 60,
        )