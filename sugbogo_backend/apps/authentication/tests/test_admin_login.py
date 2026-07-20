from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.tests.assertions import APIResponseAssertionsMixin
from apps.users.models import User


class AdminLoginViewTests(
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Tests for the admin login endpoint."""

    def setUp(self):
        self.url = reverse("admin_login")

        self.password = "StrongPassword123!"

        self.user = User.objects.create_user(
            email="admin@example.com",
            password=self.password,
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )


    def test_admin_login_successfully_returns_tokens(self):
        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Login successful.",
        )

        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])
        self.assertIn("user", response.data["data"])

        self.assertEqual(
            response.data["data"]["user"]["email"],
            "admin@example.com",
        )


    def test_admin_login_rejects_explorer(self):
        self.user.USER_ROLE = User.UserRole.EXPLORER
        self.user.save(update_fields=["USER_ROLE"])

        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="You do not have permission to access the admin portal.",
            code="ADMIN_ACCESS_DENIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )


    def test_admin_login_rejects_merchant(self):
        self.user.USER_ROLE = User.UserRole.MERCHANT
        self.user.save(update_fields=["USER_ROLE"])

        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="You do not have permission to access the admin portal.",
            code="ADMIN_ACCESS_DENIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )


    def test_admin_login_allows_super_admin(self):
        self.user.USER_ROLE = User.UserRole.SUPER_ADMIN
        self.user.save(update_fields=["USER_ROLE"])

        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertSuccessResponse(
            response,
            message="Login successful.",
        )

        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])
        self.assertIn("user", response.data["data"])

        self.assertEqual(
            response.data["data"]["user"]["role"],
            User.UserRole.SUPER_ADMIN,
        )


    def test_admin_login_fails_with_wrong_password(self):
        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
                "password": "WrongPassword123!",
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Invalid email or password.",
            code="INVALID_CREDENTIALS",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


    def test_admin_login_fails_with_nonexistent_email(self):
        response = self.client.post(
            self.url,
            {
                "email": "missing@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Invalid email or password.",
            code="INVALID_CREDENTIALS",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


    def test_admin_login_fails_when_account_is_suspended(self):
        self.user.USER_STATUS = User.UserStatus.SUSPENDED
        self.user.save(update_fields=["USER_STATUS"])

        response = self.client.post(
            self.url,
            {
                "email": "admin@example.com",
                "password": self.password,
            },
            format="json",
        )

        self.assertErrorResponse(
            response,
            message="Account is suspended. Please contact support.",
            code="ACCOUNT_INACTIVE",
            status_code=status.HTTP_403_FORBIDDEN,
        )


    def test_admin_login_requires_email_and_password(self):
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
            "password",
        )


    def test_admin_login_rejects_invalid_email(self):
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