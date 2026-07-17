from django.test import TestCase
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)

from apps.authentication.services.session_service import (
    SessionService,
)
from apps.users.models import User


class SessionServiceTests(TestCase):
    """Tests for SessionService."""

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

    def test_revoke_all_sessions_blacklists_all_tokens(self):
        RefreshToken.for_user(self.user)
        RefreshToken.for_user(self.user)

        self.assertEqual(
            OutstandingToken.objects.filter(
                user=self.user,
            ).count(),
            2,
        )

        SessionService.revoke_all_sessions(
            self.user,
        )

        self.assertEqual(
            BlacklistedToken.objects.count(),
            2,
        )

    def test_revoke_all_sessions_with_no_tokens(self):
        SessionService.revoke_all_sessions(
            self.user,
        )

        self.assertEqual(
            OutstandingToken.objects.count(),
            0,
        )

        self.assertEqual(
            BlacklistedToken.objects.count(),
            0,
        )