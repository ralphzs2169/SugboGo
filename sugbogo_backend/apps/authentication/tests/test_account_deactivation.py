from unittest.mock import patch

from django.core.cache import cache
from django.contrib.gis.geos import Point
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.authentication.models import OAuthAccount
from apps.authentication.services.account_deactivation_service import AccountDeactivationService
from apps.authentication.services.oauth.account import OAuthAccountInactive, OAuthAccountService
from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.services.password_reset_service import PasswordResetService
from apps.authentication.tokens import password_reset_token_generator
from apps.authentication.utils.jwt import issue_tokens
from apps.business.models import Business, Category, Cluster, Location
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class AccountDeactivationTests(APIResponseAssertionsMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = "OriginalSecure739!"
        cls.user = User.objects.create_user(
            email="deactivate@example.com", password=cls.password,
            USER_FNAME="Cebu", USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE, EMAIL_VERIFIED=True,
        )

    def setUp(self):
        cache.clear()
        self.url = reverse("deactivate_account")
        self.tokens = issue_tokens(self.user, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        self.payload = {"current_password": self.password, "confirm_deactivation": True}

    def test_deactivation_preserves_account_and_password_but_blocks_all_sessions(self):
        other = issue_tokens(self.user, True)
        old_hash = self.user.password
        response = self.client.post(self.url, self.payload, format="json")
        self.assertSuccessResponse(
            response, message="Account deactivated. Contact support to request reactivation.",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_STATUS, User.UserStatus.DISABLED)
        self.assertTrue(self.user.check_password(self.password))
        self.assertNotEqual(self.user.password, old_hash)
        self.assertTrue(self.user.EMAIL_VERIFIED)
        self.assertEqual(BlacklistedToken.objects.filter(token__user=self.user).count(), 2)
        for tokens in [self.tokens, other]:
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
            self.assertEqual(self.client.get(reverse("me")).status_code, 401)
            self.client.credentials()
            self.assertEqual(self.client.post(
                reverse("token_refresh"), {"refresh": tokens["refresh"]},
            ).status_code, 401)
        self.assertEqual(self.client.post(reverse("login"), {
            "email": self.user.USER_EMAIL, "password": self.password,
        }).status_code, 403)

    def test_requires_authentication(self):
        self.client.credentials()
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 401)

    def test_requires_password_and_explicit_confirmation(self):
        for field in self.payload:
            with self.subTest(field=field):
                self.assertValidationError(self.client.post(self.url, {
                    key: value for key, value in self.payload.items() if key != field
                }), field)
        self.assertValidationError(self.client.post(self.url, {
            **self.payload, "confirm_deactivation": False,
        }), "confirm_deactivation")
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_wrong_password_keeps_account_and_sessions_active(self):
        self.assertValidationError(self.client.post(self.url, {
            **self.payload, "current_password": "Incorrect739!",
        }), "current_password")
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertFalse(BlacklistedToken.objects.filter(token__user=self.user).exists())
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

    def test_request_cannot_deactivate_another_user(self):
        other = User.objects.create_user(
            email="other@example.com", password=self.password,
            USER_ROLE=User.UserRole.EXPLORER, USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        self.assertEqual(self.client.post(self.url, {
            **self.payload, "user_id": other.pk,
        }).status_code, 200)
        other.refresh_from_db()
        self.assertTrue(other.is_active)

    def test_oauth_only_account_requires_password_setup(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        tokens = issue_tokens(self.user, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertValidationError(self.client.post(self.url, self.payload), "current_password")
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_linked_account_preserves_provider_link(self):
        link = OAuthAccount.objects.create(
            USER=self.user, OAUTH_PROVIDER="google", OAUTH_PROVIDER_ID="google-123",
        )
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 200)
        self.assertTrue(OAuthAccount.objects.filter(pk=link.pk, USER=self.user).exists())

    def test_merchant_can_deactivate_and_role_is_retained(self):
        self.user.USER_ROLE = User.UserRole.MERCHANT
        self.user.save(update_fields=["USER_ROLE"])
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        category = Category.objects.create(CTGRY_NAME="Cafe", CLUS_ID=cluster)
        location = Location.objects.create(
            LOCT_POINT=Point(123.9, 10.3, srid=4326), LOCT_ADDRESS="Cebu City",
        )
        business = Business.objects.create(
            BUSN_NAME="Merchant Cafe", BUSN_CONTACT_NUMBER="09123456789",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.user, CTGRY_ID=category, LOCT_ID=location,
        )
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_ROLE, User.UserRole.MERCHANT)
        business.refresh_from_db()
        self.assertEqual(business.BUSN_STATUS, Business.BusinessStatus.ACTIVE)
        self.assertEqual(business.USER_ID_id, self.user.pk)

    def test_administrative_roles_cannot_self_deactivate(self):
        for role in [User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN]:
            with self.subTest(role=role):
                self.user.USER_ROLE = role
                self.user.save(update_fields=["USER_ROLE"])
                self.assertEqual(self.client.post(self.url, self.payload).status_code, 403)
                self.user.refresh_from_db()
                self.assertTrue(self.user.is_active)

    def test_inactive_or_unverified_account_is_rejected_by_service(self):
        for status, verified in [
            (User.UserStatus.SUSPENDED, True),
            (User.UserStatus.DISABLED, True),
            (User.UserStatus.ACTIVE, False),
        ]:
            with self.subTest(status=status, verified=verified):
                User.objects.filter(pk=self.user.pk).update(USER_STATUS=status, EMAIL_VERIFIED=verified)
                with self.assertRaises(PermissionDenied):
                    AccountDeactivationService.deactivate(user=self.user, current_password=self.password)

    @patch("apps.authentication.services.account_deactivation_service.SessionService.revoke_all_sessions")
    def test_session_revocation_failure_rolls_back_deactivation(self, revoke):
        revoke.side_effect = RuntimeError("Revocation failed")
        old_hash = self.user.password
        with self.assertRaises(RuntimeError):
            self.client.post(self.url, self.payload)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertEqual(self.user.password, old_hash)

    def test_password_whitespace_is_preserved(self):
        password = "  OriginalSecure739!  "
        self.user.set_password(password)
        self.user.save(update_fields=["password"])
        tokens = issue_tokens(self.user, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.post(self.url, {
            **self.payload, "current_password": password,
        }).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(password))

    def test_stale_login_cannot_issue_tokens_after_deactivation(self):
        self.assertEqual(self.client.post(self.url, self.payload).status_code, 200)
        with self.assertRaises(PermissionDenied):
            issue_tokens(self.user, False)
        User.objects.filter(pk=self.user.pk).update(USER_STATUS=User.UserStatus.ACTIVE)
        with self.assertRaises(PermissionDenied):
            issue_tokens(self.user, False)

    def test_google_and_facebook_cannot_reactivate_or_link_disabled_account(self):
        self.client.post(self.url, self.payload)
        for provider in ["google", "facebook"]:
            identity = OAuthUser(provider, f"{provider}-123", self.user.USER_EMAIL, "Cebu", "Explorer")
            with self.subTest(provider=provider, linked=False):
                with self.assertRaises(OAuthAccountInactive):
                    OAuthAccountService.get_or_create_user(identity)
                self.assertFalse(OAuthAccount.objects.filter(USER=self.user).exists())
            link = OAuthAccount.objects.create(
                USER=self.user, OAUTH_PROVIDER=provider, OAUTH_PROVIDER_ID=identity.provider_id,
            )
            with self.subTest(provider=provider, linked=True):
                with self.assertRaises(OAuthAccountInactive):
                    OAuthAccountService.get_or_create_user(identity)
            link.delete()
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_STATUS, User.UserStatus.DISABLED)

    def test_password_reset_does_not_reactivate_account(self):
        self.client.post(self.url, self.payload)
        self.user.refresh_from_db()
        token = password_reset_token_generator.make_token(self.user)
        updated = PasswordResetService.reset_password(
            urlsafe_base64_encode(force_bytes(self.user.pk)), token, "ReplacementSecure981!",
        )
        self.assertIsNotNone(updated)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_STATUS, User.UserStatus.DISABLED)

    def test_manual_reactivation_requires_fresh_login_and_never_restores_old_tokens(self):
        self.client.post(self.url, self.payload)
        admin = User.objects.create_user(
            email="admin@example.com", password=self.password,
            USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        tokens = issue_tokens(admin, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        response = self.client.post(reverse("admin-user-reactivate", kwargs={"user_id": self.user.pk}))
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post(reverse("token_refresh"), {
            "refresh": self.tokens["refresh"],
        }).status_code, 401)
        self.assertEqual(self.client.post(reverse("login"), {
            "email": self.user.USER_EMAIL, "password": self.password,
        }).status_code, 200)
