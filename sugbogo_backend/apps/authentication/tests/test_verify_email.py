from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User
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

        self.token = default_token_generator.make_token(
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