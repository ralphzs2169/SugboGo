from django.test import TestCase

from apps.authentication.views import _issue_tokens
from apps.users.models import User

from rest_framework_simplejwt.tokens import RefreshToken


class TokenServiceTests(TestCase):
    """Unit tests for the token service functions."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )


    def test_issue_tokens_with_remember_me(self):
        tokens = _issue_tokens(
            self.user,
            True,
        )

        self.assertIn(
            "access",
            tokens,
        )

        self.assertIn(
            "refresh",
            tokens,
        )


    def test_issue_tokens_without_remember_me(self):
        tokens = _issue_tokens(
            self.user,
            False,
        )

        refresh = RefreshToken(
            tokens["refresh"]
        )

        self.assertEqual(
            refresh["user_id"],
            str(self.user.USER_ID),
        )