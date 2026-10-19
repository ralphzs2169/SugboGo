from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import OAuthAccount
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class ChangePasswordTests(APIResponseAssertionsMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = "OriginalStrongPass739!"
        cls.user = User.objects.create_user(
            email="account@example.com",
            password=cls.password,
            USER_FNAME="Cebu",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    def setUp(self):
        cache.clear()
        self.url = reverse("change_password")
        self.refresh = RefreshToken.for_user(self.user)
        self.access = str(self.refresh.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")
        self.payload = {
            "current_password": self.password,
            "new_password": "ReplacementSecure981!",
            "confirm_password": "ReplacementSecure981!",
        }

    def test_change_password_revokes_all_old_access_and_refresh_tokens(self):
        other_session = RefreshToken.for_user(self.user)
        other_access = str(other_session.access_token)
        response = self.client.post(self.url, self.payload, format="json")
        self.assertSuccessResponse(
            response,
            message="Password changed successfully. Please sign in again.",
        )
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.payload["new_password"]))
        self.assertFalse(self.user.check_password(self.password))

        for access in [self.access, other_access]:
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
            self.assertEqual(self.client.get(reverse("me")).status_code, 401)

        self.client.credentials()
        for refresh in [self.refresh, other_session]:
            response = self.client.post(
                reverse("token_refresh"), {"refresh": str(refresh)}, format="json"
            )
            self.assertEqual(response.status_code, 401)

        response = self.client.post(
            reverse("login"),
            {"email": self.user.USER_EMAIL, "password": self.payload["new_password"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {response.data['data']['access']}"
        )
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

    def test_requires_authentication(self):
        self.client.credentials()
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 401)

    def test_wrong_current_password_preserves_password_and_session(self):
        self.payload["current_password"] = "Incorrect739!"
        response = self.client.post(self.url, self.payload, format="json")
        self.assertValidationError(response, "current_password")
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)
        self.client.credentials()
        self.assertEqual(
            self.client.post(
                reverse("token_refresh"), {"refresh": str(self.refresh)}
            ).status_code,
            200,
        )

    def test_requires_each_password_field(self):
        for field in self.payload:
            with self.subTest(field=field):
                payload = {key: value for key, value in self.payload.items() if key != field}
                self.assertValidationError(
                    self.client.post(self.url, payload, format="json"), field
                )

    def test_rejects_mismatched_confirmation(self):
        self.payload["confirm_password"] = "DifferentPassword739!"
        self.assertValidationError(
            self.client.post(self.url, self.payload, format="json"), "confirm_password"
        )

    def test_rejects_same_password(self):
        self.payload.update(new_password=self.password, confirm_password=self.password)
        self.assertValidationError(
            self.client.post(self.url, self.payload, format="json"), "new_password"
        )

    def test_rejects_weak_and_identity_similar_passwords(self):
        for password in ["short", "123456789", "account", "Cebu"]:
            with self.subTest(password=password):
                self.payload.update(new_password=password, confirm_password=password)
                self.assertValidationError(
                    self.client.post(self.url, self.payload, format="json"), "new_password"
                )

    def test_oauth_only_account_must_use_email_recovery(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.assertValidationError(
            self.client.post(self.url, self.payload, format="json"), "current_password"
        )
        self.assertFalse(self.client.get(reverse("me")).data["data"]["has_usable_password"])

    def test_oauth_linked_account_with_password_can_change_it(self):
        OAuthAccount.objects.create(
            USER=self.user, OAUTH_PROVIDER="google", OAUTH_PROVIDER_ID="google-account-123"
        )
        self.assertTrue(self.client.get(reverse("me")).data["data"]["has_usable_password"])
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 200)

    def test_suspended_account_cannot_change_password(self):
        self.user.USER_STATUS = User.UserStatus.SUSPENDED
        self.user.save(update_fields=["USER_STATUS"])
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 401)

    def test_all_active_roles_can_change_their_own_password(self):
        for role in [User.UserRole.MERCHANT, User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN]:
            with self.subTest(role=role):
                self.user.USER_ROLE = role
                self.user.set_password(self.password)
                self.user.save(update_fields=["USER_ROLE", "password"])
                refresh = RefreshToken.for_user(self.user)
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
                self.assertEqual(self.client.post(self.url, self.payload).status_code, 200)

    def test_preserves_password_whitespace_and_allows_login(self):
        password = "  WhitespaceSecure739!  "
        self.payload.update(new_password=password, confirm_password=password)
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 200)
        self.client.credentials()
        self.assertEqual(
            self.client.post(
                reverse("login"), {"email": self.user.USER_EMAIL, "password": password}
            ).status_code,
            200,
        )

    @patch("apps.authentication.services.change_password_service.SessionService.revoke_all_sessions")
    def test_rolls_back_password_when_session_revocation_fails(self, revoke):
        revoke.side_effect = RuntimeError("Revocation failed")
        with self.assertRaises(RuntimeError):
            self.client.post(self.url, self.payload)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))
