from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.cache import cache
from django.db import DatabaseError, close_old_connections, transaction
from django.test import override_settings, skipUnlessDBFeature
from django.urls import reverse
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import status
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.authentication.models import OAuthAccount
from apps.users.models import User
from apps.authentication.tokens import (
    email_verification_token_generator,
    password_reset_token_generator,
)
from core.tests.assertions import APIResponseAssertionsMixin


class VerifyEmailViewTests(APIResponseAssertionsMixin, APITestCase):
    """Exercise safe redemption of signup proofs, including already issued links."""

    original_password = "Preregistration-Demo-342!"

    def setUp(self):
        cache.clear()
        self.url = reverse("verify_email")
        self.user = User.objects.create_user(
            email="john@example.com",
            password=self.original_password,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.proof = {
            "uid": urlsafe_base64_encode(force_bytes(self.user.pk)),
            "token": email_verification_token_generator.make_token(self.user),
        }

    def submit(
        self,
        *,
        client_ip="127.0.0.1",
        **overrides,
    ):
        """Submit both pieces of proof without setting a password."""
        return self.client.post(
            self.url,
            {
                **self.proof,
                "password": self.original_password,
                **overrides,
            },
            format="json",
            REMOTE_ADDR=client_ip,
        )

    def test_legacy_unsolicited_link_cannot_activate_an_attacker_password(self):
        """An emailed proof alone cannot enable the preregistration password."""
        legacy = PasswordResetTokenGenerator()
        legacy.key_salt = email_verification_token_generator.key_salt
        proof = {**self.proof, "token": legacy.make_token(self.user)}
        original_hash = self.user.password

        response = self.client.get(self.url, proof)
        self.assertEqual(response.status_code, 405)

        response = self.client.post(self.url, proof, format="json")
        self.assertValidationError(response, "password")

        self.assertValidationError(
            self.submit(
                token=proof["token"],
                password="Mailbox-Owner-Guess-671!",
            ),
            "password",
        )
        self.user.refresh_from_db()
        self.assertFalse(self.user.EMAIL_VERIFIED)
        self.assertIsNone(self.user.EMAIL_VERIFIED_AT)
        self.assertEqual(self.user.password, original_hash)
        login = self.client.post(
            reverse("login"),
            {"email": self.user.USER_EMAIL, "password": self.original_password},
            format="json",
        )
        self.assertEqual(login.data["code"], "EMAIL_NOT_VERIFIED")

    def test_legacy_link_verifies_with_original_password_without_rehashing(self):
        original_hash = self.user.password
        legacy = PasswordResetTokenGenerator()
        legacy.key_salt = email_verification_token_generator.key_salt
        token = legacy.make_token(self.user)
        legacy.key_salt = password_reset_token_generator.key_salt
        previous_reset = legacy.make_token(self.user)
        current_reset = password_reset_token_generator.make_token(self.user)

        response = self.submit(token=token)
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.EMAIL_VERIFIED)
        self.assertIsNotNone(self.user.EMAIL_VERIFIED_AT)
        self.assertEqual(self.user.password, original_hash)
        self.assertEqual(self.submit(token=token).data["code"], "INVALID_VERIFICATION_LINK")
        self.assertFalse(
            password_reset_token_generator.check_token(self.user, previous_reset),
        )
        self.assertFalse(
            password_reset_token_generator.check_token(self.user, current_reset),
        )
        login = self.client.post(
            reverse("login"),
            {"email": self.user.USER_EMAIL, "password": self.original_password},
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.data)

    def test_legacy_reset_link_issued_after_verification_remains_usable(self):
        self.user.EMAIL_VERIFIED = True
        self.user.EMAIL_VERIFIED_AT = timezone.now() - timedelta(minutes=1)
        self.user.save(update_fields=["EMAIL_VERIFIED", "EMAIL_VERIFIED_AT"])
        legacy = PasswordResetTokenGenerator()
        legacy.key_salt = password_reset_token_generator.key_salt
        response = self.client.post(
            reverse("reset_password"),
            {
                "uid": self.proof["uid"],
                "token": legacy.make_token(self.user),
                "password": "Recovered-Password-531!",
                "confirm_password": "Recovered-Password-531!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_verification_revokes_outstanding_refresh_tokens_and_oauth_links(self):
        """Clear existing credential links in the same verification transaction."""
        refresh = RefreshToken.for_user(self.user)
        OAuthAccount.objects.create(
            USER=self.user,
            OAUTH_PROVIDER=OAuthAccount.OAuthProvider.FACEBOOK,
            OAUTH_PROVIDER_ID="legacy-facebook-subject",
        )

        response = self.submit()
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"])
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists(),
        )
        self.assertFalse(OAuthAccount.objects.filter(USER=self.user).exists())

    def test_fresh_explorer_verification_issues_one_standard_session(self):
        previous_refresh = RefreshToken.for_user(self.user)

        response = self.submit(auto_login=True)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response["Cache-Control"], "no-store")
        session = response.data["data"]
        access = AccessToken(session["access"])
        refresh = RefreshToken(session["refresh"])
        self.assertEqual(access["user_id"], str(self.user.pk))
        self.assertEqual(refresh["user_id"], str(self.user.pk))
        self.assertEqual(refresh["exp"] - refresh["iat"], 12 * 60 * 60)
        self.assertEqual(session["user"]["id"], self.user.pk)
        self.assertFalse(session["user"]["has_completed_interest_selection"])
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=previous_refresh["jti"]).exists(),
        )
        self.assertEqual(self.submit(auto_login=True).data["code"], "INVALID_VERIFICATION_LINK")
        self.assertEqual(OutstandingToken.objects.filter(user=self.user).count(), 2)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session['access']}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

        rotated = self.client.post(
            reverse("token_refresh"),
            {"refresh": session["refresh"]},
            format="json",
        )
        self.assertEqual(rotated.status_code, 200, rotated.data)
        self.assertEqual(RefreshToken(rotated.data["refresh"])["exp"], refresh["exp"])

    def test_merchant_opt_in_verifies_without_issuing_tokens(self):
        self.user.USER_ROLE = User.UserRole.MERCHANT
        self.user.USER_STATUS = User.UserStatus.PENDING
        self.user.save(update_fields=["USER_ROLE", "USER_STATUS"])

        response = self.submit(auto_login=True)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["data"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.EMAIL_VERIFIED)
        self.assertTrue(self.user.is_active)
        self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())

    def test_authenticated_request_can_verify_without_receiving_a_second_session(self):
        current_user = User.objects.create_user(
            email="signed-in@example.com",
            password=self.original_password,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        self.client.force_authenticate(user=current_user)

        response = self.submit(auto_login=True)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["data"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.EMAIL_VERIFIED)
        self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())

    def test_opt_in_rejects_disallowed_roles_and_statuses(self):
        for role, account_status in (
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.SUSPENDED),
            (User.UserRole.EXPLORER, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, account_status=account_status):
                self.user.USER_ROLE = role
                self.user.USER_STATUS = account_status
                self.user.save(update_fields=["USER_ROLE", "USER_STATUS"])

                response = self.submit(auto_login=True)

                self.assertEqual(response.data["code"], "INVALID_VERIFICATION_LINK")
                self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())
                self.user.refresh_from_db()
                self.assertFalse(self.user.EMAIL_VERIFIED)
                self.assertEqual(self.user.USER_STATUS, account_status)

    def test_previously_verified_pending_explorer_can_activate_without_a_session(self):
        self.user.EMAIL_VERIFIED = True
        self.user.USER_STATUS = User.UserStatus.PENDING
        self.user.save(update_fields=["EMAIL_VERIFIED", "USER_STATUS"])

        response = self.submit(
            token=email_verification_token_generator.make_token(self.user),
            auto_login=True,
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["data"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())

    @override_settings(LOGIN_LOCKOUT_THRESHOLD=2)
    def test_password_attempts_are_shared_across_modes_and_addresses(self):
        invalid = self.submit(token="invalid", auto_login=True, password="wrong")
        self.assertEqual(invalid.data["code"], "INVALID_VERIFICATION_LINK")

        self.assertValidationError(
            self.submit(
                auto_login=True,
                password="wrong",
                client_ip="192.0.2.1",
            ),
            "password",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 1)

        locked = self.submit(
            password="wrong",
            client_ip="192.0.2.2",
        )
        self.assertEqual(locked.status_code, 429)
        self.assertEqual(locked.data["code"], "ACCOUNT_LOCKED")
        self.assertGreater(int(locked["Retry-After"]), 0)

        blocked = self.submit(auto_login=True)
        self.assertEqual(blocked.data["code"], "ACCOUNT_LOCKED")
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 2)
        self.assertFalse(self.user.EMAIL_VERIFIED)
        self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())

        self.user.USER_PASSWORD_LOCKED_UNTIL = timezone.now() - timedelta(seconds=1)
        self.user.save(update_fields=["USER_PASSWORD_LOCKED_UNTIL"])
        self.assertEqual(self.submit(auto_login=True).status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_LOGIN_FAILURE_COUNT, 0)

    def test_issuance_failure_rolls_back_verification_revocation_and_token_creation(self):
        previous = RefreshToken.for_user(self.user)

        def fail_issuance(
            user,
            **kwargs,
        ):
            """Fail after creating an outstanding token to exercise transaction rollback."""
            RefreshToken.for_user(user)
            raise RuntimeError("JWT issuance failed")

        with patch(
            "apps.authentication.views.email_verification.issue_tokens",
            side_effect=fail_issuance,
        ):
            with self.assertRaisesMessage(RuntimeError, "JWT issuance failed"):
                self.submit(auto_login=True)

        self.user.refresh_from_db()
        self.assertFalse(self.user.EMAIL_VERIFIED)
        self.assertIsNone(self.user.EMAIL_VERIFIED_AT)
        self.assertFalse(BlacklistedToken.objects.filter(token__jti=previous["jti"]).exists())
        self.assertEqual(OutstandingToken.objects.filter(user=self.user).count(), 1)
        self.assertEqual(self.submit(auto_login=True).status_code, 200)

    def test_used_link_cannot_replace_password_or_timestamp(self):
        """Reject the consumed proof even with the matching password."""
        self.assertEqual(self.submit().status_code, 200)
        self.user.refresh_from_db()
        verified_at = self.user.EMAIL_VERIFIED_AT
        original_hash = self.user.password
        replay = self.submit()
        self.assertEqual(replay.status_code, 400, replay.data)
        self.assertEqual(replay.data["code"], "INVALID_VERIFICATION_LINK")
        self.user.refresh_from_db()
        self.assertEqual(self.user.EMAIL_VERIFIED_AT, verified_at)
        self.assertEqual(self.user.password, original_hash)

    def test_valid_proof_for_an_active_verified_account_never_changes_password(self):
        """Preserve the already-verified no-op for an otherwise valid proof."""
        self.user.EMAIL_VERIFIED = True
        self.user.save(update_fields=["EMAIL_VERIFIED"])
        response = self.submit(
            token=email_verification_token_generator.make_token(self.user),
            auto_login=True,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["message"], "Email is already verified.")
        self.assertIsNone(response.data["data"])
        self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.original_password))

    def test_verify_email_requires_uid_and_token(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertValidationError(response, "uid", "token")

    def test_invalid_credentials_do_not_activate_account(self):
        for invalid_proof in ({"uid": "invalid"}, {"token": "invalid-token"}):
            with self.subTest(invalid_proof=invalid_proof):
                response = self.submit(**invalid_proof)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(response.data["code"], "INVALID_VERIFICATION_LINK")
        self.user.refresh_from_db()
        self.assertFalse(self.user.EMAIL_VERIFIED)

    def test_mismatched_password_leaves_proof_usable(self):
        self.assertValidationError(
            self.submit(password="Does-Not-Match-593!"),
            "password",
        )
        self.assertEqual(self.submit().status_code, 200)

    @override_settings(PASSWORD_RESET_TIMEOUT=1)
    def test_expired_verification_does_not_update_the_account(self):
        """Return the controlled invalid-link error after expiry."""
        issued_at = datetime(2026, 1, 1, 12, 0, 0)
        with patch.object(
            email_verification_token_generator,
            "_now",
            return_value=issued_at,
        ):
            proof = email_verification_token_generator.make_token(self.user)

        with patch.object(
            email_verification_token_generator,
            "_now",
            return_value=issued_at + timedelta(seconds=2),
        ):
            response = self.submit(token=proof, auto_login=True)

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["code"], "INVALID_VERIFICATION_LINK")
        self.user.refresh_from_db()
        self.assertFalse(self.user.EMAIL_VERIFIED)
        self.assertIsNone(self.user.EMAIL_VERIFIED_AT)
        self.assertFalse(OutstandingToken.objects.filter(user=self.user).exists())


@skipUnlessDBFeature("has_select_for_update_nowait")
class VerifyEmailConcurrencyTests(APITransactionTestCase):
    """Exercise overlapping verification requests on independent database connections."""

    def test_concurrent_requests_verify_once_with_one_timestamp(self):
        self.assert_concurrent_proof_redemption(
            ("verify_email", "verify_email"),
            expected_rejection="INVALID_VERIFICATION_LINK",
            auto_login=True,
        )

    def test_verification_and_reset_cannot_both_use_preexisting_proofs(self):
        self.assert_concurrent_proof_redemption(
            ("verify_email", "reset_password"),
        )

    def test_parallel_password_resets_can_only_consume_the_proof_once(self):
        self.assert_concurrent_proof_redemption(
            ("reset_password", "reset_password"),
            expected_rejection="INVALID_RESET_LINK",
        )

    def assert_concurrent_proof_redemption(
        self,
        endpoints,
        expected_rejection=None,
        auto_login=False,
    ):
        """Hold the first write open while a second valid proof races it."""
        cache.clear()
        password = "Registration-Password-671!"
        reset_password = "Recovered-Password-397!"
        user = User.objects.create_user(
            email="verify-concurrency@example.com",
            password=password,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        original_hash = user.password
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        tokens = {
            "verify_email": email_verification_token_generator.make_token(user),
            "reset_password": password_reset_token_generator.make_token(user),
        }
        start = Barrier(2)
        writing = Event()
        release = Event()
        original_save = User.save

        def pause_save(account, **kwargs):
            """Pause the account-state update while the account row is locked."""
            fields = kwargs.get("update_fields", ())
            if "EMAIL_VERIFIED" in fields or "password" in fields:
                writing.set()
                if not release.wait(timeout=10):
                    raise AssertionError("Credential write was not released")
            return original_save(account, **kwargs)

        def submit(endpoint):
            """Submit the proof on a separate database connection."""
            close_old_connections()
            try:
                start.wait(timeout=10)
                payload = {"uid": uid, "token": tokens[endpoint], "password": password}
                if endpoint == "reset_password":
                    payload.update(
                        password=reset_password,
                        confirm_password=reset_password,
                    )
                if endpoint == "verify_email":
                    payload["auto_login"] = auto_login
                return APIClient().post(
                    reverse(endpoint),
                    payload,
                    format="json",
                )
            finally:
                close_old_connections()

        with patch.object(User, "save", autospec=True, side_effect=pause_save) as save:
            with ThreadPoolExecutor(max_workers=2) as executor:
                requests = [executor.submit(submit, endpoint) for endpoint in endpoints]
                try:
                    self.assertTrue(writing.wait(timeout=10))
                    with self.assertRaises(DatabaseError):
                        with transaction.atomic():
                            User.objects.select_for_update(nowait=True).get(pk=user.pk)
                finally:
                    release.set()
                responses = [request.result(timeout=10) for request in requests]

        self.assertCountEqual(
            [response.status_code for response in responses],
            [200, 400],
        )
        if auto_login:
            accepted = next(
                response
                for response in responses
                if response.status_code == 200
            )
            self.assertEqual(accepted.data["data"]["user"]["id"], user.pk)
            refresh = RefreshToken(accepted.data["data"]["refresh"])
            self.assertEqual(refresh["user_id"], str(user.pk))
            self.assertEqual(OutstandingToken.objects.filter(user=user).count(), 1)
        rejected = next(response for response in responses if response.status_code == 400)
        if expected_rejection:
            self.assertEqual(rejected.data["code"], expected_rejection)
        else:
            self.assertIn(
                rejected.data["code"],
                {"INVALID_VERIFICATION_LINK", "INVALID_RESET_LINK"},
            )
        account_writes = [
            call
            for call in save.call_args_list
            if (
                "EMAIL_VERIFIED" in call.kwargs.get("update_fields", ())
                or "password" in call.kwargs.get("update_fields", ())
            )
        ]
        self.assertEqual(len(account_writes), 1)
        user.refresh_from_db()
        if "EMAIL_VERIFIED" in account_writes[0].kwargs["update_fields"]:
            self.assertTrue(user.EMAIL_VERIFIED)
            self.assertEqual(user.EMAIL_VERIFIED_AT, account_writes[0].args[0].EMAIL_VERIFIED_AT)
            self.assertEqual(user.password, original_hash)
        else:
            self.assertFalse(user.EMAIL_VERIFIED)
            self.assertIsNone(user.EMAIL_VERIFIED_AT)
            self.assertTrue(user.check_password(reset_password))
