from unittest.mock import patch

from core.tests.assertions import APIResponseAssertionsMixin
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User


class RegisterViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests for the user registration endpoint."""

    def setUp(self):
        cache.clear()
        
        self.url = "/api/auth/register/"

        self.valid_payload = {
            "email": "john@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "password": "StrongPassword123!",
            "confirm_password": "StrongPassword123!",
        }

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
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
        self.assertNotEqual(user.password, self.valid_payload["password"])
        self.assertTrue(user.check_password(self.valid_payload["password"]))
        mock_send_email.assert_called_once_with(user)

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

        self.assertValidationError(
            response,
            "email",
        )

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

        self.assertValidationError(
            response,
            "email"
        )

        self.assertFalse(User.objects.filter(USER_EMAIL="not-an-email").exists())

        mock_send_email.assert_not_called()

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_registration_rejects_mismatched_confirmation(self, mock_send_email):
        self.assertValidationError(
            self.client.post(
                self.url,
                {**self.valid_payload, "confirm_password": "StrongPassword123! "},
                format="json",
            ),
            "confirm_password",
        )
        self.assertFalse(User.objects.filter(USER_EMAIL=self.valid_payload["email"]).exists())
        mock_send_email.assert_not_called()

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_registration_applies_password_validators(self, mock_send_email):
        for weak_password in ("short", "password", "123456789012", " " * 12):
            with self.subTest(password=weak_password):
                response = self.client.post(
                    self.url,
                    {
                        **self.valid_payload,
                        "password": weak_password,
                        "confirm_password": weak_password,
                    },
                    format="json",
                )
                self.assertValidationError(response, "password")
        mock_send_email.assert_not_called()

    @patch("apps.authentication.services.email_service.EmailService.send_verification_email")
    def test_register_fails_when_required_fields_are_missing(self, mock_send_email):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertValidationError(
            response,
            "email",
            "first_name",
            "last_name",
            "password",
            "confirm_password",
        )

        self.assertFalse(
            User.objects.filter(
                USER_EMAIL="john@example.com",
            ).exists()
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
