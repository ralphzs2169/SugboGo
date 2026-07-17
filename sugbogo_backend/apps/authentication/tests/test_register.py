from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User


class RegisterViewTests(APITestCase):
    """Tests for the user registration endpoint."""

    def setUp(self):
        self.url = "/api/auth/register/"

        self.valid_payload = {
            "email": "john@example.com",
            "password": "StrongPassword123!",
            "first_name": "John",
            "last_name": "Doe",
        }

    @patch(
        "apps.authentication.services.email_service.EmailService.send_verification_email"
    )
    def test_register_successfully_creates_user(self, mock_send_email):
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(User.objects.filter(USER_EMAIL="john@example.com").exists())

        user = User.objects.get(USER_EMAIL="john@example.com")

        self.assertEqual(
            user.USER_FNAME,
            "John",
        )

        self.assertEqual(
            user.USER_LNAME,
            "Doe",
        )

        self.assertFalse(
            user.EMAIL_VERIFIED,
        )

        self.assertEqual(
            response.data["message"],
            "Registration successful. Please verify your email.",
        )

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_register_fails_when_email_already_exists(self, mock_send_email):
        User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="Existing",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn("email", response.data)

        self.assertEqual(
            User.objects.filter(USER_EMAIL="john@example.com").count(),
            1,
        )

        mock_send_email.assert_not_called()

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_register_fails_with_invalid_email(self, mock_send_email):
        payload = self.valid_payload.copy()
        payload["email"] = "not-an-email"

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn("email", response.data)

        self.assertFalse(User.objects.filter(USER_EMAIL="not-an-email").exists())

        mock_send_email.assert_not_called()

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_register_fails_with_weak_password(self, mock_send_email):
        payload = self.valid_payload.copy()
        payload["password"] = "12345678"

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn("password", response.data)

        self.assertFalse(User.objects.filter(USER_EMAIL="john@example.com").exists())

        mock_send_email.assert_not_called()


    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_register_fails_when_required_fields_are_missing(self, mock_send_email):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn("email", response.data)
        self.assertIn("password", response.data)
        self.assertIn("first_name", response.data)
        self.assertIn("last_name", response.data)

        self.assertEqual(
            User.objects.count(),
            0,
        )

        mock_send_email.assert_not_called()


    @patch(
        "apps.authentication.services.email_service.EmailService.send_verification_email",
        side_effect=Exception("Email service unavailable"),
    )
    def test_register_succeeds_when_email_service_fails(self, mock_send_email):
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["message"],
            "Registration successful. Please verify your email.",
        )

        self.assertTrue(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).exists()
        )

        user = User.objects.get(
            USER_EMAIL="john@example.com",
        )

        self.assertFalse(user.EMAIL_VERIFIED)

        mock_send_email.assert_called_once_with(user)
