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
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

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

    def submit(self, **overrides):
        """Submit both pieces of proof without setting a password."""
        return self.client.post(
            self.url,
            {
                **self.proof,
                "password": self.original_password,
                **overrides,
            },
            format="json",
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

        self.assertEqual(self.submit().status_code, 200)
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists(),
        )
        self.assertFalse(OAuthAccount.objects.filter(USER=self.user).exists())

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
        response = self.submit(token=email_verification_token_generator.make_token(self.user))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["message"], "Email is already verified.")
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
            response = self.submit(token=proof)

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["code"], "INVALID_VERIFICATION_LINK")
        self.user.refresh_from_db()
        self.assertFalse(self.user.EMAIL_VERIFIED)
        self.assertIsNone(self.user.EMAIL_VERIFIED_AT)


@skipUnlessDBFeature("has_select_for_update_nowait")
class VerifyEmailConcurrencyTests(APITransactionTestCase):
    """Exercise overlapping verification requests on independent database connections."""

    def test_concurrent_requests_verify_once_with_one_timestamp(self):
        self.assert_concurrent_proof_redemption(
            ("verify_email", "verify_email"),
            expected_rejection="INVALID_VERIFICATION_LINK",
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
