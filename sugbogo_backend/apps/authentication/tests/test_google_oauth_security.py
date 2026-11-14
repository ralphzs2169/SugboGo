from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.authentication.models import OAuthAccount
from apps.authentication.tokens import (
    email_verification_token_generator,
    password_reset_token_generator,
)
from apps.users.models import User


@override_settings(GOOGLE_OAUTH_CLIENT_ID="test-google-client")
class GoogleOAuthSecurityTests(APITestCase):
    """Exercise Google verification and linking together without external requests."""

    def setUp(self):
        cache.clear()
        self.payload = {
            "sub": "google-123",
            "email": "explorer@gmail.com",
            "email_verified": True,
        }
        verifier_patch = patch(
            "apps.authentication.services.oauth.google.id_token.verify_oauth2_token",
            return_value=self.payload,
        )
        self.verifier = verifier_patch.start()
        self.addCleanup(verifier_patch.stop)

    def login(self):
        return self.client.post(
            reverse("google_login"),
            {"id_token": "test-token"},
            format="json",
        )

    def create_user(
        self,
        email,
        role=User.UserRole.EXPLORER,
        status=User.UserStatus.ACTIVE,
        verified=True,
    ):
        return User.objects.create_user(
            email=email,
            password=None,
            USER_FNAME="OAuth",
            USER_LNAME="User",
            USER_ROLE=role,
            USER_STATUS=status,
            EMAIL_VERIFIED=verified,
        )

    def assert_denied_without_account_changes(
        self,
        user,
        expected_code="OAUTH_LINK_REQUIRED",
    ):
        previous_status = user.USER_STATUS
        previous_verified = user.EMAIL_VERIFIED
        previous_verified_at = user.EMAIL_VERIFIED_AT
        previous_password = user.password
        previous_links = list(
            OAuthAccount.objects.filter(USER=user).values()
        )
        response = self.login()
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data["code"], expected_code)
        self.assertNotIn("data", response.data)
        self.assertFalse(OutstandingToken.objects.filter(user=user).exists())
        user.refresh_from_db()
        self.assertEqual(user.USER_STATUS, previous_status)
        self.assertEqual(user.EMAIL_VERIFIED, previous_verified)
        self.assertEqual(user.EMAIL_VERIFIED_AT, previous_verified_at)
        self.assertEqual(user.password, previous_password)
        self.assertIsNone(user.last_login)
        self.assertEqual(
            list(OAuthAccount.objects.filter(USER=user).values()),
            previous_links,
        )

    def test_missing_configuration_returns_503_without_verifying_or_issuing_tokens(self):
        for audience in (None, "", " \t"):
            with self.subTest(audience=audience):
                with override_settings(GOOGLE_OAUTH_CLIENT_ID=audience):
                    response = self.login()
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.data["code"], "GOOGLE_SERVICE_UNAVAILABLE")
        self.verifier.assert_not_called()
        self.assertFalse(User.objects.exists())
        self.assertFalse(OAuthAccount.objects.exists())
        self.assertFalse(OutstandingToken.objects.exists())

    def test_unverified_email_cannot_login_even_with_an_existing_subject(self):
        user = self.create_user(self.payload["email"])
        link = OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="google",
            OAUTH_PROVIDER_ID=self.payload["sub"],
        )
        last_login = link.OAUTH_LAST_LOGIN
        for claim in (None, False, "false", 1):
            with self.subTest(claim=claim):
                self.payload["email_verified"] = claim
                response = self.login()
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.data["code"], "INVALID_GOOGLE_TOKEN")
                self.assertFalse(OutstandingToken.objects.exists())
                link.refresh_from_db()
                self.assertEqual(link.OAUTH_LAST_LOGIN, last_login)

    def test_wrong_audience_returns_401_without_linking(self):
        self.verifier.side_effect = ValueError("Wrong audience")
        response = self.login()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "INVALID_GOOGLE_TOKEN")
        self.assertEqual(
            self.verifier.call_args.kwargs["audience"],
            "test-google-client",
        )
        self.assertFalse(User.objects.exists())
        self.assertFalse(OAuthAccount.objects.exists())
        self.assertFalse(OutstandingToken.objects.exists())

    def test_authoritative_email_links_explorer_and_merchant_without_changing_role(self):
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            for hosted in (False, True):
                with self.subTest(role=role, hosted=hosted):
                    cache.clear()
                    if hosted:
                        email = f"{role}@workspace.example"
                        self.payload["hd"] = "workspace.example"
                    else:
                        email = f"{role}@gmail.com"
                        self.payload.pop("hd", None)
                    user = self.create_user(
                        email,
                        role=role,
                        status=User.UserStatus.PENDING,
                        verified=False,
                    )
                    self.payload["email"] = email.upper()
                    self.payload["sub"] = f"google-{role}-{hosted}"
                    response = self.login()
                    self.assertEqual(response.status_code, 200, response.data)
                    self.assertEqual(response.data["data"]["user"]["id"], user.pk)
                    self.assertIn("access", response.data["data"])
                    self.assertIn("refresh", response.data["data"])
                    user.refresh_from_db()
                    self.assertEqual(user.USER_ROLE, role)
                    self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
                    self.assertTrue(user.EMAIL_VERIFIED)
                    self.assertIsNotNone(user.EMAIL_VERIFIED_AT)
                    self.assertEqual(
                        OAuthAccount.objects.get(USER=user).OAUTH_PROVIDER_ID,
                        self.payload["sub"],
                    )

    def test_preregistered_password_does_not_become_usable_through_google(self):
        """Require mailbox recovery before Google can link to an unverified password signup."""
        attacker_password = "Preregistered-Sample-Password-684!"
        owner_password = "Recovered-Account-Password-931!"
        with patch(
            "apps.authentication.views.register.EmailService.send_verification_email",
        ):
            registration = self.client.post(
                reverse("register"),
                {
                    "email": self.payload["email"],
                    "first_name": "Sample",
                    "last_name": "User",
                    "password": attacker_password,
                },
                format="json",
            )
        self.assertEqual(registration.status_code, 201, registration.data)
        user = User.objects.get(USER_EMAIL=self.payload["email"])

        self.assert_denied_without_account_changes(user)

        password_login = self.client.post(
            reverse("login"),
            {
                "email": user.USER_EMAIL,
                "password": attacker_password,
            },
            format="json",
        )
        self.assertEqual(password_login.data["code"], "EMAIL_NOT_VERIFIED")

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        recovery = self.client.post(
            reverse("reset_password"),
            {
                "uid": uid,
                "token": password_reset_token_generator.make_token(user),
                "password": owner_password,
                "confirm_password": owner_password,
            },
            format="json",
        )
        self.assertEqual(recovery.status_code, 200, recovery.data)
        user.refresh_from_db()
        self.assertFalse(user.EMAIL_VERIFIED)

        verification = self.client.get(
            reverse("verify_email"),
            {
                "uid": uid,
                "token": email_verification_token_generator.make_token(user),
            },
        )
        self.assertEqual(verification.status_code, 200, verification.data)

        google_login = self.login()
        self.assertEqual(google_login.status_code, 200, google_login.data)
        self.assertEqual(google_login.data["data"]["user"]["id"], user.pk)
        user.refresh_from_db()
        self.assertTrue(user.check_password(owner_password))

        attacker_login = self.client.post(
            reverse("login"),
            {
                "email": user.USER_EMAIL,
                "password": attacker_password,
            },
            format="json",
        )
        self.assertEqual(attacker_login.data["code"], "INVALID_CREDENTIALS")

    def test_existing_google_link_cannot_activate_an_unverified_usable_password(self):
        """Apply the password guard when the provider subject already has a link."""
        user = self.create_user(self.payload["email"], verified=False)
        user.set_password("Unverified-Sample-Password-572!")
        user.save(update_fields=["password"])
        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="google",
            OAUTH_PROVIDER_ID=self.payload["sub"],
        )

        self.assert_denied_without_account_changes(user)

    def test_third_party_email_collision_requires_existing_account_proof(self):
        for status in (User.UserStatus.ACTIVE, User.UserStatus.PENDING):
            for verified in (False, True):
                with self.subTest(status=status, verified=verified):
                    cache.clear()
                    email = f"{status}-{verified}@example.com"
                    user = self.create_user(
                        email,
                        status=status,
                        verified=verified,
                    )
                    self.payload["email"] = email.upper()
                    self.assert_denied_without_account_changes(user)

    def test_third_party_email_cannot_attach_google_to_a_facebook_account(self):
        user = self.create_user("existing@example.com")
        self.payload["email"] = user.USER_EMAIL
        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="facebook",
            OAUTH_PROVIDER_ID="facebook-existing",
        )
        self.assert_denied_without_account_changes(user)

    def test_authoritative_email_cannot_replace_an_existing_google_subject(self):
        user = self.create_user(self.payload["email"])
        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="google",
            OAUTH_PROVIDER_ID="original-google-subject",
        )
        self.assert_denied_without_account_changes(user)

    def test_existing_third_party_subject_wins_over_another_users_email(self):
        user = self.create_user("original@example.com", role=User.UserRole.MERCHANT)
        other_user = self.create_user("reassigned@example.com")
        self.payload["email"] = other_user.USER_EMAIL
        link = OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="google",
            OAUTH_PROVIDER_ID=self.payload["sub"],
        )
        last_login = link.OAUTH_LAST_LOGIN
        response = self.login()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["user"]["id"], user.pk)
        user.refresh_from_db()
        other_user.refresh_from_db()
        link.refresh_from_db()
        self.assertEqual(user.USER_EMAIL, "original@example.com")
        self.assertEqual(user.USER_ROLE, User.UserRole.MERCHANT)
        self.assertGreaterEqual(link.OAUTH_LAST_LOGIN, last_login)
        self.assertIsNone(other_user.last_login)
        self.assertFalse(OutstandingToken.objects.filter(user=other_user).exists())
        self.assertEqual(OAuthAccount.objects.count(), 1)

    def test_changed_provider_email_cannot_verify_or_activate_the_stored_email(self):
        for status, verified in (
            (User.UserStatus.PENDING, False),
            (User.UserStatus.PENDING, True),
            (User.UserStatus.ACTIVE, False),
        ):
            with self.subTest(status=status, verified=verified):
                cache.clear()
                user = self.create_user(
                    f"stored-{status}-{verified}@example.com",
                    status=status,
                    verified=verified,
                )
                self.payload["sub"] = f"google-{status}-{verified}"
                OAuthAccount.objects.create(
                    USER=user,
                    OAUTH_PROVIDER="google",
                    OAUTH_PROVIDER_ID=self.payload["sub"],
                )
                self.assert_denied_without_account_changes(user)

    def test_existing_third_party_subject_with_same_email_can_activate_pending_user(self):
        self.payload["email"] = "linked@example.com"
        user = self.create_user(
            self.payload["email"],
            role=User.UserRole.MERCHANT,
            status=User.UserStatus.PENDING,
            verified=False,
        )
        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER="google",
            OAUTH_PROVIDER_ID=self.payload["sub"],
        )
        response = self.login()
        self.assertEqual(response.status_code, 200, response.data)
        user.refresh_from_db()
        self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertEqual(user.USER_ROLE, User.UserRole.MERCHANT)

    def test_new_verified_google_identity_can_register_and_return(self):
        for email in ("new@gmail.com", "new@example.com"):
            with self.subTest(email=email):
                cache.clear()
                self.payload["email"] = email
                self.payload["sub"] = f"google-{email}"
                response = self.login()
                self.assertEqual(response.status_code, 200, response.data)
                user_id = response.data["data"]["user"]["id"]
                user = User.objects.get(pk=user_id)
                self.assertFalse(user.has_usable_password())
                self.assertEqual(user.USER_ROLE, User.UserRole.EXPLORER)
                self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
                self.assertTrue(user.EMAIL_VERIFIED)
                response = self.login()
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["data"]["user"]["id"], user_id)
                self.assertEqual(OAuthAccount.objects.filter(USER=user).count(), 1)

    def test_google_authority_does_not_bypass_account_restrictions(self):
        for role, status, code in (
            (User.UserRole.ADMIN, User.UserStatus.PENDING, "OAUTH_LOGIN_DENIED"),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE, "OAUTH_LOGIN_DENIED"),
            (User.UserRole.EXPLORER, User.UserStatus.DISABLED, "ACCOUNT_INACTIVE"),
            (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED, "ACCOUNT_INACTIVE"),
        ):
            with self.subTest(role=role, status=status):
                cache.clear()
                email = f"{role}-{status}@gmail.com"
                self.payload["email"] = email
                user = self.create_user(
                    email,
                    role=role,
                    status=status,
                    verified=False,
                )
                self.assert_denied_without_account_changes(
                    user,
                    expected_code=code,
                )
