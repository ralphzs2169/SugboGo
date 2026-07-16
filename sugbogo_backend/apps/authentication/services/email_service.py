from django.conf import settings
import resend
from django.template.loader import render_to_string
from typing import Any
import logging

from apps.authentication.services.verification_service import EmailVerificationService


if not settings.RESEND_API_KEY:
    raise ValueError("RESEND_API_KEY is not configured.")

resend.api_key = settings.RESEND_API_KEY
logger = logging.getLogger(__name__)



class EmailService:
    """Service for sending transactional emails via Resend."""

    @staticmethod
    def send_email(
        subject: str,
        recipient: str,
        html_template_name: str,
        text_template_name: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> Any :
        """
        Send a transactional email using Resend.

        Args:
            subject: Email subject.
            recipient: Recipient email address.
            html_template_name: Path to the HTML email template.
            text_template_name: Optional path to the plain-text email template.
            context: Context passed to the email templates.
        """
        context = context or {}

        html = render_to_string(
            html_template_name,
            context,
        )

        text = None

        if text_template_name:
            text = render_to_string(
                text_template_name,
                context,
            )

        params = {
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [recipient],
            "subject": subject,
            "html": html,
        }

        if text:
            params["text"] = text

        try:
            return resend.Emails.send(params)

        except Exception:
            logger.exception(
                "Failed to send email to %s",
                recipient,
            )
            raise
            
    
    @staticmethod
    def send_verification_email(user):
        """
        Send an email verification message to a newly registered user.
        """
        verification_link = (
            EmailVerificationService.generate_verification_link(user)
        )

        context = {
            "user": user,
            "verification_link": verification_link,
        }

        return EmailService.send_email(
            subject="Verify your email",
            recipient=user.USER_EMAIL,
            html_template_name="emails/verify_email.html",
            text_template_name="emails/verify_email.txt",
            context=context,
        )