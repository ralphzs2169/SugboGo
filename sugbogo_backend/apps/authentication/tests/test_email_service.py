from unittest.mock import patch

from django.test import TestCase
from django.conf import settings

from apps.authentication.services.email_service import EmailService
from apps.users.models import User


class EmailServiceTests(TestCase):
    """Tests for EmailService."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    @patch("apps.authentication.services.email_service.resend.Emails.send")
    @patch("apps.authentication.services.email_service.render_to_string")
    def test_send_email_successfully(
        self,
        mock_render,
        mock_send,
    ):
        html = "<html>Email</html>"
        text = "Plain text"

        mock_render.side_effect = [
            html,
            text,
        ]

        mock_send.return_value = {
            "id": "email-id",
        }

        response = EmailService.send_email(
            subject="Test Subject",
            recipient="john@example.com",
            html_template_name="emails/test.html",
            text_template_name="emails/test.txt",
            context={"name": "John"},
        )

        self.assertEqual(
            response,
            {"id": "email-id"},
        )

        mock_send.assert_called_once()

        params = mock_send.call_args.args[0]

        self.assertEqual(
            params["from"],
            settings.DEFAULT_FROM_EMAIL,
        )

        self.assertEqual(
            params["to"],
            ["john@example.com"],
        )

        self.assertEqual(
            params["subject"],
            "Test Subject",
        )

        self.assertEqual(
            params["html"],
            html,
        )

        self.assertEqual(
            params["text"],
            text,
        )

    @patch("apps.authentication.services.email_service.resend.Emails.send")
    @patch("apps.authentication.services.email_service.render_to_string")
    def test_send_email_without_text_template(
        self,
        mock_render,
        mock_send,
    ):
        mock_render.return_value = "<html>Email</html>"

        EmailService.send_email(
            subject="Subject",
            recipient="john@example.com",
            html_template_name="emails/test.html",
        )

        params = mock_send.call_args.args[0]

        self.assertNotIn(
            "text",
            params,
        )

    @patch("apps.authentication.services.email_service.logger.exception")
    @patch("apps.authentication.services.email_service.resend.Emails.send")
    @patch("apps.authentication.services.email_service.render_to_string")
    def test_send_email_reraises_resend_errors(
        self,
        mock_render,
        mock_send,
        mock_logger,
    ):
        mock_render.return_value = "<html>Email</html>"

        mock_send.side_effect = Exception(
            "Resend failure",
        )

        with self.assertRaises(Exception):
            EmailService.send_email(
                subject="Subject",
                recipient="john@example.com",
                html_template_name="emails/test.html",
            )

        mock_logger.assert_called_once()

    @patch("apps.authentication.services.email_service.EmailService.send_email")
    @patch("apps.authentication.services.email_service.EmailVerificationService.generate_verification_link")
    def test_send_verification_email(
        self,
        mock_generate_link,
        mock_send_email,
    ):
        mock_generate_link.return_value = (
            "https://example.com/verify"
        )

        EmailService.send_verification_email(
            self.user,
        )

        mock_send_email.assert_called_once_with(
            subject="Verify your email",
            recipient=self.user.USER_EMAIL,
            html_template_name="emails/verify_email.html",
            text_template_name="emails/verify_email.txt",
            context={
                "user": self.user,
                "verification_link": "https://example.com/verify",
            },
        )

    @patch(
        "apps.authentication.services.email_service.EmailService.send_email"
    )
    @patch(
        "apps.authentication.services.email_service.PasswordResetService.generate_reset_link"
    )
    def test_send_password_reset_email(
        self,
        mock_generate_link,
        mock_send_email,
    ):
        mock_generate_link.return_value = (
            "https://example.com/reset"
        )

        EmailService.send_password_reset_email(
            self.user,
        )

        mock_send_email.assert_called_once_with(
            subject="Reset your password",
            recipient=self.user.USER_EMAIL,
            html_template_name="emails/reset_password.html",
            text_template_name="emails/reset_password.txt",
            context={
                "user": self.user,
                "reset_link": "https://example.com/reset",
            },
        )