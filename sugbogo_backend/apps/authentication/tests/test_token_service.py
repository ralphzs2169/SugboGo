from django.test import TestCase
from rest_framework.exceptions import PermissionDenied

from apps.authentication.utils.jwt import issue_tokens
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
            EMAIL_VERIFIED=True,
        )


    def testissue_tokens_with_remember_me(self):
        tokens = issue_tokens(
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


    def testissue_tokens_without_remember_me(self):
        tokens = issue_tokens(
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

    def test_token_issuance_rechecks_authoritative_account_eligibility(self):
        for account_status, verified in [
            (User.UserStatus.ACTIVE, False),
            (User.UserStatus.DISABLED, True),
            (User.UserStatus.SUSPENDED, True),
        ]:
            with self.subTest(status=account_status, verified=verified):
                User.objects.filter(pk=self.user.pk).update(
                    USER_STATUS=account_status,
                    EMAIL_VERIFIED=verified,
                )
                with self.assertRaises(PermissionDenied):
                    issue_tokens(self.user, False)

    def test_token_issuance_rejects_a_deleted_account(self):
        User.objects.filter(pk=self.user.pk).delete()
        with self.assertRaises(PermissionDenied):
            issue_tokens(self.user, False)
