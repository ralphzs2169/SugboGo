from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import EmailChangeRequest, LoginEvent
from apps.authentication.tokens import (
    email_verification_token_generator,
    password_reset_token_generator,
)
from apps.users.models import User


class IAMCoreFlowTests(APITestCase):
    """Verifies connected IAM journeys through real endpoints and database state."""

    password = "Original-Password-739!"
    replacement = "Replacement-Password-981!"

    def setUp(self):
        """Mocks external delivery while retaining real proof, session, and permission checks."""
        cache.clear()
        self.delivery = self.enterContext(patch(
            "apps.authentication.services.email_service.EmailService.send_email_change_verification",
        ))
        self.enterContext(patch(
            "apps.authentication.services.email_service.EmailService.send_email_changed_notice",
        ))

    def account(self, label, role=User.UserRole.EXPLORER):
        """Creates a verified account without bypassing endpoint login in the journey."""
        return User.objects.create_user(
            email=f"{label}@example.com", password=self.password,
            USER_FNAME="Core", USER_LNAME="Tester", USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE, EMAIL_VERIFIED=True,
        )

    def post(self, client, name, payload, **kwargs):
        """Isolates cross-feature behavior from separately tested IP and delivery throttles."""
        cache.clear()
        return client.post(reverse(name, kwargs=kwargs or None), payload, format="json")

    def sign_in(self, user, password=None, remember=False):
        """Obtains a real password session from the role-appropriate login endpoint."""
        client = APIClient()
        name = "admin_login" if user.USER_ROLE in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN) else "login"
        response = self.post(client, name, {
            "email": user.USER_EMAIL, "password": password or self.password,
            "remember_me": remember,
        })
        self.assertEqual(response.status_code, 200, response.data)
        tokens = response.data["data"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        return client, tokens

    def assert_revoked(self, tokens):
        """Checks both previously issued access and refresh credentials after a sensitive change."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(client.get(reverse("me")).status_code, 401)
        client.credentials()
        self.assertEqual(self.post(client, "token_refresh", {
            "refresh": tokens["refresh"],
        }).status_code, 401)

    def request_email(self, client, password, destination):
        """Captures only the mocked delivery boundary to obtain the real confirmation proof."""
        response = self.post(client, "request_email_change", {
            "new_email": destination, "current_password": password,
        })
        self.assertEqual(response.status_code, 200, response.data)
        query = parse_qs(urlparse(self.delivery.call_args.args[2]).query)
        return {
            "request_id": query["request_id"][0], "token": query["token"][0],
            "current_password": password,
        }

    def test_registration_verification_and_first_session_do_not_grant_administrative_access(self):
        """Checks the public registration boundary and verification prerequisite end to end."""
        with patch("apps.authentication.services.email_service.EmailService.send_verification_email") as delivery:
            response = self.post(self.client, "register", {
                "email": "registered-core@example.com", "password": self.password,
                "first_name": "Registered", "last_name": "Tester", "role": "super_admin",
            })
        self.assertEqual(response.status_code, 201)
        delivery.assert_called_once()
        user = User.objects.get(USER_EMAIL="registered-core@example.com")
        self.assertEqual(user.USER_ROLE, User.UserRole.EXPLORER)
        blocked = self.post(self.client, "login", {"email": user.USER_EMAIL, "password": self.password})
        self.assertEqual(blocked.data["code"], "EMAIL_NOT_VERIFIED")
        user.refresh_from_db()
        self.assertIsNone(user.last_login)
        response = self.client.get(reverse("verify_email"), {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": email_verification_token_generator.make_token(user),
        })
        self.assertEqual(response.status_code, 200)
        client, _ = self.sign_in(user)
        self.assertEqual(client.get(reverse("me")).status_code, 200)
        self.assertEqual(client.get(reverse("admin-user-list")).status_code, 403)
        self.assertEqual(LoginEvent.objects.filter(USER=user, LEVT_OUTCOME="success").count(), 1)

    def test_consumer_password_email_refresh_and_logout_journey(self):
        """Connects sensitive changes and token rotation for Explorer and Merchant accounts."""
        for role, remember in [(User.UserRole.EXPLORER, False), (User.UserRole.MERCHANT, True)]:
            with self.subTest(role=role):
                user = self.account(f"journey-{role}", role)
                client, first = self.sign_in(user, remember=remember)
                _, second = self.sign_in(user, remember=not remember)
                deadline = RefreshToken(first["refresh"])["exp"]
                rotated = self.post(APIClient(), "token_refresh", {"refresh": first["refresh"]})
                self.assertEqual(rotated.status_code, 200)
                self.assertEqual(RefreshToken(rotated.data["refresh"])["exp"], deadline)
                self.assertEqual(self.post(APIClient(), "token_refresh", {"refresh": first["refresh"]}).status_code, 401)
                response = self.post(client, "change_password", {
                    "current_password": self.password, "new_password": self.replacement,
                    "confirm_password": self.replacement,
                })
                self.assertEqual(response.status_code, 200)
                self.assert_revoked(first)
                self.assert_revoked(second)
                self.assert_revoked(rotated.data)
                client, changed = self.sign_in(user, self.replacement)
                self.request_email(client, self.replacement, f"cancelled-{role}@example.com")
                self.assertEqual(self.post(client, "cancel_email_change", {}).status_code, 200)
                proof = self.request_email(client, self.replacement, f"updated-{role}@example.com")
                self.assertEqual(client.get(reverse("email_change_status")).data["data"]["current_email"], user.USER_EMAIL)
                self.assertEqual(self.post(APIClient(), "confirm_email_change", proof).status_code, 200)
                self.assert_revoked(changed)
                user.refresh_from_db()
                self.assertEqual(user.USER_EMAIL, f"updated-{role}@example.com")
                self.assertEqual(user.USER_ROLE, role)
                client, latest = self.sign_in(user, self.replacement)
                history = client.get(reverse("login_history"))
                self.assertEqual(history.status_code, 200)
                self.assertGreaterEqual(history.data["data"]["pagination"]["total_items"], 4)
                self.assertEqual(self.post(client, "logout", {"refresh": latest["refresh"]}).status_code, 205)
                self.assertEqual(self.post(APIClient(), "token_refresh", {"refresh": latest["refresh"]}).status_code, 401)
                # Agreed ordinary-logout policy: copied access JWTs live until their short expiry.
                self.assertEqual(client.get(reverse("me")).status_code, 200)

    def test_lockout_recovery_invalidates_pending_email_proof_and_existing_sessions(self):
        """Verifies that password recovery safely crosses lockout and pending identity changes."""
        user = self.account("recovery-core")
        client, old = self.sign_in(user)
        proof = self.request_email(client, self.password, "pending-core@example.com")
        user.refresh_from_db()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = password_reset_token_generator.make_token(user)
        for _ in range(5):
            locked = self.post(APIClient(), "login", {"email": user.USER_EMAIL, "password": "wrong"})
        self.assertEqual(locked.data["code"], "ACCOUNT_LOCKED")
        self.assertEqual(client.get(reverse("me")).status_code, 200)
        response = self.post(APIClient(), "reset_password", {
            "uid": uid, "token": token, "password": self.replacement,
            "confirm_password": self.replacement,
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assert_revoked(old)
        self.assertEqual(self.post(APIClient(), "confirm_email_change", proof).status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.USER_EMAIL, "recovery-core@example.com")
        self.assertIsNone(user.USER_PASSWORD_LOCKED_UNTIL)
        self.sign_in(user, self.replacement)

    def test_email_confirmation_does_not_bypass_an_existing_password_lock(self):
        """Keeps restrictions attached to the account when its verified email changes."""
        user = self.account("locked-identity-core")
        client, old = self.sign_in(user)
        proof = self.request_email(client, self.password, "locked-new@example.com")
        for _ in range(5):
            self.post(APIClient(), "login", {"email": user.USER_EMAIL, "password": "wrong"})
        user.refresh_from_db()
        deadline = user.USER_PASSWORD_LOCKED_UNTIL
        self.assertEqual(self.post(APIClient(), "confirm_email_change", proof).status_code, 200)
        self.assert_revoked(old)
        response = self.post(APIClient(), "login", {"email": "locked-new@example.com", "password": self.password})
        self.assertEqual(response.data["code"], "ACCOUNT_LOCKED")
        user.refresh_from_db()
        self.assertEqual(user.USER_PASSWORD_LOCKED_UNTIL, deadline)

    def test_deactivation_requires_manual_restoration_and_never_restores_old_tokens(self):
        """Connects consumer closure with the real administrative reactivation endpoint."""
        administrator = self.account("restoring-admin-core", User.UserRole.ADMIN)
        admin, _ = self.sign_in(administrator)
        for role in [User.UserRole.EXPLORER, User.UserRole.MERCHANT]:
            with self.subTest(role=role):
                user = self.account(f"restore-{role}-core", role)
                client, old = self.sign_in(user)
                pending = self.request_email(client, self.password, f"restore-pending-{role}@example.com")
                self.assertEqual(self.post(client, "deactivate_account", {
                    "current_password": self.password, "confirm_deactivation": True,
                }).status_code, 200)
                self.assert_revoked(old)
                self.assertEqual(self.post(APIClient(), "confirm_email_change", pending).status_code, 403)
                self.assertEqual(self.post(APIClient(), "login", {"email": user.USER_EMAIL, "password": self.password}).status_code, 403)
                response = self.post(admin, "admin-user-reactivate", {}, user_id=user.pk)
                self.assertEqual(response.status_code, 200, response.data)
                self.assert_revoked(old)
                user.refresh_from_db()
                self.assertEqual(user.USER_ROLE, role)
                self.assertEqual(self.post(APIClient(), "confirm_email_change", pending).status_code, 400)
                restored, _ = self.sign_in(user)
                self.assertEqual(restored.get(reverse("login_history")).status_code, 200)

    def test_live_status_and_roles_are_enforced_for_already_issued_tokens(self):
        """Checks suspension and role downgrades without trusting stale client role state."""
        actor = self.account("authority-core", User.UserRole.SUPER_ADMIN)
        admin, _ = self.sign_in(actor)
        user = self.account("suspended-core")
        client, tokens = self.sign_in(user)
        response = self.post(admin, "admin-user-suspend", {"reason": "Core flow verification"}, user_id=user.pk)
        self.assertEqual(response.status_code, 200, response.data)
        self.assert_revoked(tokens)
        self.assertEqual(self.post(admin, "admin-user-reactivate", {}, user_id=user.pk).status_code, 200)
        # Suspension revokes refresh sessions; unchanged password does not promise permanent access-JWT revocation.
        self.assertEqual(self.post(APIClient(), "token_refresh", {"refresh": tokens["refresh"]}).status_code, 401)
        self.assertEqual(admin.get(reverse("admin-user-list")).status_code, 200)
        User.objects.filter(pk=actor.pk).update(USER_ROLE=User.UserRole.EXPLORER)
        self.assertEqual(admin.get(reverse("admin-user-list")).status_code, 403)

    def test_account_settings_endpoints_require_authentication_and_ignore_client_role_escalation(self):
        """Protects sensitive entry points and keeps account role authoritative on the server."""
        for name in ["login_history", "email_change_status"]:
            self.assertEqual(self.client.get(reverse(name)).status_code, 401)
        for name in ["change_password", "deactivate_account", "request_email_change", "cancel_email_change"]:
            self.assertEqual(self.post(self.client, name, {}).status_code, 401)
        self.assertFalse(EmailChangeRequest.objects.exists())
        user = self.account("profile-authority-core")
        client, _ = self.sign_in(user)
        response = client.patch(reverse("me"), {"role": "super_admin", "email": "other@example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.USER_ROLE, User.UserRole.EXPLORER)
        self.assertEqual(user.USER_EMAIL, "profile-authority-core@example.com")
        self.assertEqual(client.get(reverse("admin-user-list")).status_code, 403)

    def test_registration_and_recovery_preserve_exact_password_text(self):
        """Ensures password-setting paths remain compatible with exact-password login."""
        original = f"  {self.password}  "
        with patch("apps.authentication.services.email_service.EmailService.send_verification_email"):
            response = self.post(self.client, "register", {
                "email": "exact-password-core@example.com", "password": original,
                "first_name": "Exact", "last_name": "Tester",
            })
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(USER_EMAIL="exact-password-core@example.com")
        self.assertTrue(user.check_password(original))
        User.objects.filter(pk=user.pk).update(EMAIL_VERIFIED=True)
        client, old = self.sign_in(user, original)
        user.refresh_from_db()
        proof = password_reset_token_generator.make_token(user)
        replacement = f"  {self.replacement}  "
        response = self.post(APIClient(), "reset_password", {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": proof,
            "password": replacement, "confirm_password": replacement,
        })
        self.assertEqual(response.status_code, 200)
        self.assert_revoked(old)
        user.refresh_from_db()
        self.assertTrue(user.check_password(replacement))
        self.assertFalse(user.check_password(replacement.strip()))
        self.sign_in(user, replacement)

    def test_recovery_confirmation_requires_exact_password_match(self):
        """Rejects a confirmation that differs only in surrounding whitespace."""
        user = self.account("exact-confirmation-core")
        proof = password_reset_token_generator.make_token(user)
        response = self.post(APIClient(), "reset_password", {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": proof,
            "password": f" {self.replacement} ", "confirm_password": self.replacement,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("confirm_password", response.data["errors"])
        user.refresh_from_db()
        self.assertTrue(user.check_password(self.password))

    def test_verification_resend_uses_the_same_email_identity_as_login(self):
        """Keeps the unverified-login recovery path working across email capitalization."""
        user = self.account("mixed-case-core")
        User.objects.filter(pk=user.pk).update(EMAIL_VERIFIED=False)
        response = self.post(APIClient(), "login", {
            "email": user.USER_EMAIL.upper(), "password": self.password,
        })
        self.assertEqual(response.data["code"], "EMAIL_NOT_VERIFIED")
        with patch("apps.authentication.services.email_service.EmailService.send_verification_email") as delivery:
            response = self.post(APIClient(), "resend_verification", {"email": user.USER_EMAIL.upper()})
        self.assertEqual(response.status_code, 200)
        delivery.assert_called_once()
        self.assertEqual(delivery.call_args.args[0].pk, user.pk)

    def test_password_setting_paths_reject_whitespace_only_without_changing_the_account(self):
        """Preserves nonblank validation while retaining exact text for usable passwords."""
        blank = " " * 12
        with patch("apps.authentication.services.email_service.EmailService.send_verification_email"):
            response = self.post(APIClient(), "register", {
                "email": "blank-core@example.com", "password": blank,
                "first_name": "Blank", "last_name": "Tester",
            })
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])
        self.assertFalse(User.objects.filter(USER_EMAIL="blank-core@example.com").exists())
        user = self.account("blank-recovery-core")
        client, _ = self.sign_in(user)
        user.refresh_from_db()
        response = self.post(APIClient(), "reset_password", {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": password_reset_token_generator.make_token(user),
            "password": blank, "confirm_password": blank,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])
        response = self.post(client, "change_password", {
            "current_password": self.password, "new_password": blank,
            "confirm_password": blank,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data["errors"])
        user.refresh_from_db()
        self.assertTrue(user.check_password(self.password))
        self.assertEqual(client.get(reverse("me")).status_code, 200)
