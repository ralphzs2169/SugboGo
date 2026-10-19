from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.authentication.services.password_reset_service import PasswordResetService
from apps.authentication.tokens import password_reset_token_generator
from apps.authentication.utils.jwt import issue_tokens
from apps.users.models import User
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class SessionPolicyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="session@example.com", password="OriginalSecure739!",
            USER_FNAME="Cebu", USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE, EMAIL_VERIFIED=True,
        )

    def setUp(self):
        cache.clear()

    def rotate(self, refresh):
        return self.client.post(reverse("token_refresh"), {"refresh": refresh}, format="json")

    def test_rotation_preserves_original_deadline_for_both_remember_me_choices(self):
        for remember, hours in [(False, 12), (True, 30 * 24)]:
            with self.subTest(remember=remember):
                tokens = issue_tokens(self.user, remember)
                original = RefreshToken(tokens["refresh"])
                deadline = original["exp"]
                self.assertEqual(deadline - original["iat"], hours * 3600)
                for _ in range(3):
                    response = self.rotate(tokens["refresh"])
                    self.assertEqual(response.status_code, 200)
                    rotated = RefreshToken(response.data["refresh"])
                    self.assertEqual(rotated["exp"], deadline)
                    self.assertLessEqual(AccessToken(response.data["access"])["exp"], deadline)
                    self.assertEqual(self.rotate(tokens["refresh"]).status_code, 401)
                    registered = OutstandingToken.objects.get(jti=rotated["jti"])
                    self.assertEqual(int(registered.expires_at.timestamp()), deadline)
                    self.assertEqual(registered.token, response.data["refresh"])
                    tokens = response.data

    def test_initial_short_token_registration_matches_its_actual_expiry(self):
        tokens = issue_tokens(self.user, False)
        refresh = RefreshToken(tokens["refresh"])
        record = OutstandingToken.objects.get(jti=refresh["jti"])
        self.assertEqual(int(record.expires_at.timestamp()), refresh["exp"])
        self.assertEqual(record.token, tokens["refresh"])

    def test_access_expiry_is_capped_near_the_session_deadline(self):
        refresh = RefreshToken.for_user(self.user)
        refresh.set_exp(lifetime=timedelta(seconds=60))
        response = self.rotate(str(refresh))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AccessToken(response.data["access"])["exp"], refresh["exp"])
        self.assertEqual(RefreshToken(response.data["refresh"])["exp"], refresh["exp"])

    def test_expired_session_cannot_be_renewed(self):
        refresh = RefreshToken.for_user(self.user)
        refresh.set_exp(lifetime=timedelta(seconds=-1))
        self.assertEqual(self.rotate(str(refresh)).status_code, 401)

    def test_refresh_rejects_deleted_inactive_and_unverified_accounts(self):
        refresh = str(RefreshToken.for_user(self.user))
        User.objects.filter(pk=self.user.pk).update(EMAIL_VERIFIED=False)
        self.assertEqual(self.rotate(refresh).status_code, 401)
        User.objects.filter(pk=self.user.pk).update(EMAIL_VERIFIED=True, USER_STATUS=User.UserStatus.SUSPENDED)
        self.assertEqual(self.rotate(refresh).status_code, 401)
        self.user.delete()
        self.assertEqual(self.rotate(refresh).status_code, 401)

    def test_refresh_rejects_missing_or_unknown_user_claim_without_server_error(self):
        for identity in (None, "not-an-id", 99999999):
            with self.subTest(identity=identity):
                refresh = RefreshToken.for_user(self.user)
                refresh["user_id"] = identity
                self.assertEqual(self.rotate(str(refresh)).status_code, 401)

    def test_password_hash_binding_is_checked_on_refresh_without_relying_on_blacklist(self):
        refresh = str(RefreshToken.for_user(self.user))
        self.user.set_password("ReplacementSecure981!")
        self.user.save(update_fields=["password"])
        self.assertEqual(self.rotate(refresh).status_code, 401)

    def test_password_reset_revokes_rotated_refresh_and_already_issued_access(self):
        initial = issue_tokens(self.user, False)
        rotated = self.rotate(initial["refresh"]).data
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = password_reset_token_generator.make_token(self.user)
        PasswordResetService.reset_password(uid, token, "ReplacementSecure981!")
        self.assertEqual(self.rotate(rotated["refresh"]).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated['access']}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 401)

    def test_logout_revokes_only_the_supplied_refresh_and_keeps_other_login_valid(self):
        first = issue_tokens(self.user, False)
        other = issue_tokens(self.user, True)
        response = self.client.post(reverse("logout"), {"refresh": first["refresh"]})
        self.assertEqual(response.status_code, 205)
        self.assertEqual(self.rotate(first["refresh"]).status_code, 401)
        self.assertEqual(self.rotate(other["refresh"]).status_code, 200)
        # Ordinary logout does not revoke a copied access JWT before its expiry.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {first['access']}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

    def test_expired_access_can_be_renewed_while_its_refresh_is_still_valid(self):
        tokens = issue_tokens(self.user, False)
        access = AccessToken(tokens["access"])
        access.set_exp(lifetime=timedelta(seconds=-1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 401)
        self.client.credentials()
        response = self.rotate(tokens["refresh"])
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)
