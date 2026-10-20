from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.authentication.models import LoginEvent
from apps.authentication.services.change_password_service import ChangePasswordService
from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.services.password_reset_service import PasswordResetService
from apps.authentication.tokens import password_reset_token_generator
from apps.authentication.utils.jwt import issue_tokens
from apps.users.models import User


def account():
    """Creates an active verified account for password-lockout behavior checks."""
    return User.objects.create_user(
        email="lockout@example.com", password="StrongPassword123!",
        USER_FNAME="Lockout", USER_LNAME="Tester",
        USER_ROLE=User.UserRole.EXPLORER,
        USER_STATUS=User.UserStatus.ACTIVE, EMAIL_VERIFIED=True,
    )


class AccountLockoutTests(APITestCase):
    """Covers shared counters, fixed expiry, recovery, history, and existing sessions."""

    def setUp(self):
        """Creates an unlocked explorer and clears independent IP throttles."""
        cache.clear()
        self.user = account()
        self.now = timezone.now()

    def attempt(self, password="wrong", *, portal="login", email=None, now=None, ip="192.0.2.1"):
        """Uses distinct peer addresses without bypassing the account restriction."""
        cache.clear()
        with patch("apps.authentication.services.login_service.timezone.now", return_value=now or self.now):
            return self.client.post(reverse(portal), {
                "email": email or self.user.USER_EMAIL, "password": password,
            }, format="json", REMOTE_ADDR=ip)

    def lock(self):
        """Consumes the approved five attempts and verifies the shared threshold."""
        for index in range(5):
            response = self.attempt(ip=f"192.0.2.{index + 1}")
            self.assertEqual(response.status_code, 429 if index == 4 else 401)
        return response

    def test_threshold_shares_case_variants_portals_and_ips(self):
        """Counts bad passwords against one account across mobile and admin routes."""
        for index in range(5):
            response = self.attempt(
                portal="admin_login" if index % 2 else "login",
                email=self.user.USER_EMAIL.upper() if index % 2 else self.user.USER_EMAIL,
                ip=f"192.0.2.{index + 1}",
            )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data["code"], "ACCOUNT_LOCKED")
        self.assertEqual(response.data["errors"]["retry_after"], 900)
        self.assertEqual(response["Retry-After"], "900")
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 5)
        self.assertEqual(self.user.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertIsNone(self.user.last_login)
        self.assertEqual(LoginEvent.objects.filter(USER=self.user, LEVT_OUTCOME="failed").count(), 5)
        self.assertEqual(OutstandingToken.objects.count(), 0)

    def test_active_lock_rejects_correct_password_without_extending_or_rehashing(self):
        """Denies all password attempts until the fixed deadline without checking proof."""
        self.lock()
        self.user.refresh_from_db()
        deadline = self.user.USER_PASSWORD_LOCKED_UNTIL
        with patch.object(User, "check_password", side_effect=AssertionError("must not check while locked")):
            response = self.attempt("StrongPassword123!", now=self.now + timedelta(minutes=5))
        self.assertEqual(response.data["errors"]["retry_after"], 600)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_PASSWORD_LOCKED_UNTIL, deadline)
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 5)
        self.assertEqual(OutstandingToken.objects.count(), 0)

    def test_expiry_and_observation_window_reset(self):
        """Allows the deadline boundary and starts a new window after older failures."""
        self.attempt()
        self.attempt()
        self.attempt(now=self.now + timedelta(minutes=15))
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 1)
        self.assertEqual(self.attempt("StrongPassword123!", now=self.now + timedelta(minutes=15)).status_code, 200)
        self.now += timedelta(minutes=15)
        self.lock()
        response = self.attempt("StrongPassword123!", now=self.now + timedelta(minutes=15))
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 0)
        self.assertIsNone(self.user.USER_PASSWORD_LOCKED_UNTIL)

    def test_completed_success_clears_failures_but_wrong_portal_does_not(self):
        """Clears counters only after the account is eligible for the requested portal."""
        self.attempt()
        self.assertEqual(self.attempt("StrongPassword123!", portal="admin_login").status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 1)
        self.assertEqual(self.attempt("StrongPassword123!").status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 0)
        self.assertIsNone(self.user.USER_LOGIN_WINDOW_STARTED_AT)

    def test_admin_and_superadmin_are_protected(self):
        """Enforces the same password policy for privileged portal accounts."""
        for role in [User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN]:
            with self.subTest(role=role):
                User.objects.filter(pk=self.user.pk).update(
                    USER_ROLE=role, USER_LOGIN_FAILURE_COUNT=0,
                    USER_LOGIN_WINDOW_STARTED_AT=None, USER_PASSWORD_LOCKED_UNTIL=None,
                )
                for _ in range(5):
                    response = self.attempt(portal="admin_login")
                self.assertEqual(response.data["code"], "ACCOUNT_LOCKED")
                self.assertEqual(self.attempt("StrongPassword123!", portal="admin_login").status_code, 429)

    def test_unknown_inactive_unverified_and_oauth_only_accounts_do_not_accumulate(self):
        """Preserves status restrictions without creating lockout state for unknown identities."""
        for _ in range(6):
            self.assertEqual(self.attempt(email="missing@example.com").status_code, 401)
        for status, verified in [(User.UserStatus.DISABLED, True), (User.UserStatus.ACTIVE, False)]:
            self.user.USER_STATUS = status
            self.user.EMAIL_VERIFIED = verified
            self.user.save(update_fields=["USER_STATUS", "EMAIL_VERIFIED"])
            for _ in range(5):
                self.attempt()
            self.user.refresh_from_db()
            self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 0)
        self.user.USER_STATUS = User.UserStatus.ACTIVE
        self.user.EMAIL_VERIFIED = True
        self.user.set_unusable_password()
        self.user.save(update_fields=["password", "USER_STATUS", "EMAIL_VERIFIED"])
        self.attempt()
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 0)

    def test_verified_password_reset_clears_lock_but_invalid_proof_does_not(self):
        """Makes recovery atomic with the password update and existing session revocation."""
        self.lock()
        self.user.refresh_from_db()
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = password_reset_token_generator.make_token(self.user)
        self.assertIsNone(PasswordResetService.reset_password(uid, "invalid", "Replacement123!"))
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.USER_PASSWORD_LOCKED_UNTIL)
        self.assertIsNotNone(PasswordResetService.reset_password(uid, token, "Replacement123!"))
        self.assertEqual(self.attempt("Replacement123!").status_code, 200)

    def test_password_change_and_verified_oauth_can_recover(self):
        """Permits authenticated proof while preventing anonymous lock state from disabling OAuth."""
        self.lock()
        ChangePasswordService.change_password(self.user, "StrongPassword123!", "Fresh-Password-482!")
        self.user.refresh_from_db()
        self.assertIsNone(self.user.USER_PASSWORD_LOCKED_UNTIL)
        self.lock()
        identity = OAuthUser("google", "lock-google", self.user.USER_EMAIL, "Lockout", "Tester")
        with patch("apps.authentication.views.google_login.GoogleOAuthService.verify_id_token", return_value=identity):
            response = self.client.post(reverse("google_login"), {"id_token": "proof"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.USER_PASSWORD_LOCKED_UNTIL)

    def test_existing_sessions_continue_and_forgot_password_stays_available(self):
        """Restricts new password sign-ins without revoking valid sessions or recovery."""
        tokens = self.attempt("StrongPassword123!").data["data"]
        self.lock()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get(reverse("login_history")).status_code, 200)
        self.client.credentials()
        self.assertEqual(self.client.post(reverse("token_refresh"), {"refresh": tokens["refresh"]}, format="json").status_code, 200)
        with patch("apps.authentication.views.forgot_password.EmailService.send_password_reset_email"):
            self.assertEqual(self.client.post(reverse("forgot_password"), {"email": self.user.USER_EMAIL}, format="json").status_code, 200)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AccountLockoutConcurrencyTests(TransactionTestCase):
    """Uses real PostgreSQL connections to verify account locking under concurrency."""

    def setUp(self):
        """Starts just below the threshold without creating an active lock."""
        cache.clear()
        self.user = account()
        self.user.USER_LOGIN_FAILURE_COUNT = 3
        self.user.USER_LOGIN_WINDOW_STARTED_AT = timezone.now()
        self.user.save(update_fields=["USER_LOGIN_FAILURE_COUNT", "USER_LOGIN_WINDOW_STARTED_AT"])
        self.barrier = Barrier(3)

    def attempt(self, index):
        """Submits an independently connected attempt against the shared account row."""
        close_old_connections()
        self.barrier.wait(timeout=10)
        try:
            response = APIClient().post(reverse("login"), {
                "email": self.user.USER_EMAIL, "password": "wrong",
            }, format="json", REMOTE_ADDR=f"192.0.2.{index + 1}")
            return response.status_code
        finally:
            close_old_connections()

    def test_parallel_failures_are_counted_once_and_stop_at_threshold(self):
        """Prevents lost increments and prevents active locks from being extended."""
        with ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(self.attempt, range(3)))
        self.assertEqual(sorted(results), [401, 429, 429])
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 5)
        self.assertIsNotNone(self.user.USER_PASSWORD_LOCKED_UNTIL)
        self.assertEqual(OutstandingToken.objects.count(), 0)

    def test_user_lock_is_held_until_successful_token_issuance_finishes(self):
        """Serializes a late bad attempt after a completed login rather than bypassing a new lock."""
        User.objects.filter(pk=self.user.pk).update(USER_LOGIN_FAILURE_COUNT=4)
        issuing = Event()
        release = Event()
        failed = Event()

        def delayed_issue(*args, **kwargs):
            """Pauses token issuance while the authenticated account lock is held."""
            issuing.set()
            if not release.wait(timeout=10):
                raise AssertionError("Token issuance was not released")
            return issue_tokens(*args, **kwargs)

        def submit(password):
            """Submits a login through its own connection and signals the bad attempt's completion."""
            close_old_connections()
            try:
                result = APIClient().post(reverse("login"), {
                    "email": self.user.USER_EMAIL, "password": password,
                }, format="json", REMOTE_ADDR="198.51.100.1" if password == "wrong" else "198.51.100.2")
                return result.status_code
            finally:
                if password == "wrong":
                    failed.set()
                close_old_connections()

        with patch("apps.authentication.views.login_view.issue_tokens", side_effect=delayed_issue):
            with ThreadPoolExecutor(max_workers=2) as executor:
                success = executor.submit(submit, "StrongPassword123!")
                try:
                    self.assertTrue(issuing.wait(timeout=10))
                    failure = executor.submit(submit, "wrong")
                    self.assertFalse(failed.wait(timeout=0.2))
                finally:
                    release.set()
                self.assertEqual(success.result(timeout=10), 200)
                self.assertEqual(failure.result(timeout=10), 401)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 1)
        self.assertIsNone(self.user.USER_PASSWORD_LOCKED_UNTIL)
