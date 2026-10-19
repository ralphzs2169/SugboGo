from datetime import timedelta
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch
import uuid

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.authentication.models import EmailChangeRequest, OAuthAccount
from apps.authentication.services.email_service import EmailService
from apps.authentication.services.oauth.account import OAuthAccountService
from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.tokens import password_reset_token_generator
from apps.authentication.utils.jwt import issue_tokens
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class EmailChangeTests(APIResponseAssertionsMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = "OriginalSecure739!"
        cls.user = User.objects.create_user(
            email="original@example.com", password=cls.password,
            USER_FNAME="Cebu", USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE, EMAIL_VERIFIED=True,
        )

    def setUp(self):
        cache.clear()
        self.tokens = issue_tokens(self.user, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        self.payload = {"new_email": "new@example.com", "current_password": self.password}
        self.delivery = patch("apps.authentication.services.email_change_service.EmailService.send_email_change_verification").start()
        self.notice = patch("apps.authentication.services.email_change_service.EmailService.send_email_changed_notice").start()
        self.addCleanup(patch.stopall)

    def request_change(self, **changes):
        return self.client.post(reverse("request_email_change"), {**self.payload, **changes}, format="json")

    def proof(self):
        query = parse_qs(urlparse(self.delivery.call_args.args[2]).query)
        return {"request_id": query["request_id"][0], "token": query["token"][0], "current_password": self.password}

    def confirm(self, proof=None):
        return self.client.post(reverse("confirm_email_change"), proof or self.proof(), format="json")

    def test_request_keeps_current_email_password_and_sessions_until_confirmation(self):
        old_hash = self.user.password
        self.assertEqual(self.request_change(new_email="  NEW@Example.COM  ").status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_EMAIL, "original@example.com")
        self.assertEqual(self.user.password, old_hash)
        self.assertFalse(BlacklistedToken.objects.filter(token__user=self.user).exists())
        pending = EmailChangeRequest.objects.get(USER_ID=self.user)
        self.assertEqual(pending.ECHG_NEW_EMAIL, "new@example.com")
        self.assertNotEqual(pending.ECHG_TOKEN_HASH, self.proof()["token"])
        self.assertEqual(self.delivery.call_args.args[1], "new@example.com")
        self.assertEqual(urlparse(self.delivery.call_args.args[2]).scheme, "com.sugbogo.app")
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

    def test_authenticated_status_exposes_no_token_or_auth_state(self):
        self.assertIsNone(self.client.get(reverse("email_change_status")).data["data"]["pending"])
        self.request_change()
        data = self.client.get(reverse("email_change_status")).data["data"]
        self.assertEqual(data["current_email"], self.user.USER_EMAIL)
        self.assertEqual(set(data["pending"]), {"new_email", "expires_at"})
        self.assertEqual(data["pending"]["new_email"], "new@example.com")

    def test_confirmation_changes_verified_identity_and_revokes_old_sessions(self):
        other = issue_tokens(self.user, True)
        reset_token = password_reset_token_generator.make_token(self.user)
        old_hash = self.user.password
        self.request_change()
        proof = self.proof()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.confirm(proof)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], {"user_id": self.user.pk, "email": "new@example.com"})
        self.user.refresh_from_db()
        self.assertTrue(self.user.EMAIL_VERIFIED)
        self.assertIsNotNone(self.user.EMAIL_VERIFIED_AT)
        self.assertTrue(self.user.check_password(self.password))
        self.assertNotEqual(self.user.password, old_hash)
        self.assertFalse(EmailChangeRequest.objects.filter(USER_ID=self.user).exists())
        self.assertFalse(password_reset_token_generator.check_token(self.user, reset_token))
        self.notice.assert_called_once()
        self.assertEqual(self.notice.call_args.args[1], "original@example.com")
        for tokens in [self.tokens, other]:
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
            self.assertEqual(self.client.get(reverse("me")).status_code, 401)
            self.client.credentials()
            self.assertEqual(self.client.post(reverse("token_refresh"), {"refresh": tokens["refresh"]}).status_code, 401)
        self.assertEqual(self.client.post(reverse("login"), {"email": "original@example.com", "password": self.password}).status_code, 401)
        self.assertEqual(self.client.post(reverse("login"), {"email": "new@example.com", "password": self.password}).status_code, 200)
        self.assertEqual(self.client.post(reverse("login"), {"email": "NEW@EXAMPLE.COM", "password": self.password}).status_code, 200)
        self.assertValidationError(self.confirm(proof), "token")

    def test_reading_or_opening_confirmation_does_not_consume_proof(self):
        self.request_change()
        response = self.client.get(reverse("confirm_email_change"), self.proof())
        self.assertEqual(response.status_code, 405)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_EMAIL, "original@example.com")

    def test_request_status_and_cancel_require_authentication(self):
        self.client.credentials()
        self.assertEqual(self.request_change().status_code, 401)
        self.assertEqual(self.client.get(reverse("email_change_status")).status_code, 401)
        self.assertEqual(self.client.post(reverse("cancel_email_change")).status_code, 401)

    def test_confirmation_works_signed_out_and_ignores_expired_authorization(self):
        self.request_change()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer expired-or-unrelated")
        self.assertEqual(self.confirm().status_code, 200)

    def test_request_requires_both_fields_and_valid_email(self):
        for field in self.payload:
            payload = {key: value for key, value in self.payload.items() if key != field}
            self.assertValidationError(self.client.post(reverse("request_email_change"), payload), field)
        self.assertValidationError(self.request_change(new_email="invalid"), "new_email")
        self.assertValidationError(self.request_change(new_email="a" * 101 + "@example.com"), "new_email")

    def test_wrong_password_creates_no_request_or_delivery(self):
        self.assertValidationError(self.request_change(current_password="Incorrect739!"), "current_password")
        self.assertFalse(EmailChangeRequest.objects.exists())
        self.delivery.assert_not_called()

    def test_passwordless_accounts_must_complete_password_setup(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        tokens = issue_tokens(self.user, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertValidationError(self.request_change(), "current_password")

    def test_same_or_taken_email_is_rejected_case_insensitively(self):
        other = User.objects.create_user(email="taken@example.com", USER_ROLE=User.UserRole.EXPLORER)
        self.assertValidationError(self.request_change(new_email="ORIGINAL@EXAMPLE.COM"), "new_email")
        self.assertValidationError(self.request_change(new_email="TAKEN@EXAMPLE.COM"), "new_email")
        other.refresh_from_db()
        self.assertEqual(other.USER_EMAIL, "taken@example.com")

    def test_database_prevents_case_variant_duplicate_accounts(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(email="ORIGINAL@EXAMPLE.COM", USER_ROLE=User.UserRole.EXPLORER)

    def test_latest_request_replaces_older_link_without_changing_current_email(self):
        self.request_change()
        previous = self.proof()
        self.request_change(new_email="replacement@example.com")
        self.assertEqual(EmailChangeRequest.objects.filter(USER_ID=self.user).count(), 1)
        self.assertValidationError(self.confirm(previous), "token")
        self.assertEqual(self.confirm().data["data"]["email"], "replacement@example.com")

    def test_resending_same_destination_invalidates_previous_secret(self):
        self.request_change()
        old = self.proof()
        self.request_change()
        self.assertNotEqual(old["token"], self.proof()["token"])
        self.assertValidationError(self.confirm(old), "token")
        self.assertEqual(self.confirm().status_code, 200)

    def test_cancellation_invalidates_link_and_keeps_current_email(self):
        self.request_change()
        proof = self.proof()
        self.assertEqual(self.client.post(reverse("cancel_email_change")).status_code, 200)
        self.assertValidationError(self.confirm(proof), "token")
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_EMAIL, "original@example.com")
        self.assertEqual(self.client.post(reverse("cancel_email_change")).status_code, 200)

    def test_expired_request_is_hidden_and_cannot_be_confirmed(self):
        self.request_change()
        EmailChangeRequest.objects.filter(USER_ID=self.user).update(ECHG_EXPIRES_AT=timezone.now() - timedelta(seconds=1))
        self.assertIsNone(self.client.get(reverse("email_change_status")).data["data"]["pending"])
        self.assertValidationError(self.confirm(), "token")

    def test_password_change_invalidates_pending_email_proof(self):
        self.request_change()
        self.user.set_password("ReplacementSecure981!")
        self.user.save(update_fields=["password"])
        self.client.credentials()
        self.assertValidationError(self.confirm(), "token")

    def test_suspended_and_disabled_accounts_cannot_confirm_or_reactivate(self):
        self.request_change()
        for status in [User.UserStatus.SUSPENDED, User.UserStatus.DISABLED]:
            User.objects.filter(pk=self.user.pk).update(USER_STATUS=status)
            self.assertEqual(self.confirm().status_code, 403)
            self.user.refresh_from_db()
            self.assertEqual(self.user.USER_STATUS, status)

    def test_address_taken_after_request_is_rejected_at_confirmation(self):
        self.request_change()
        User.objects.create_user(email="NEW@example.com", USER_ROLE=User.UserRole.EXPLORER)
        self.assertValidationError(self.confirm(), "new_email")
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_EMAIL, "original@example.com")
        self.assertTrue(EmailChangeRequest.objects.filter(USER_ID=self.user).exists())

    def test_malformed_missing_and_tampered_proofs_are_rejected(self):
        self.request_change()
        proof = self.proof()
        for field in proof:
            self.assertValidationError(self.confirm({key: value for key, value in proof.items() if key != field}), field)
        self.assertValidationError(self.confirm({**proof, "request_id": "invalid"}), "request_id")
        self.assertValidationError(self.confirm({**proof, "request_id": str(uuid.uuid4())}), "token")
        cache.clear()
        self.assertValidationError(self.confirm({**proof, "token": "not-the-secret"}), "token")

    def test_wrong_confirmation_password_preserves_pending_request(self):
        self.request_change()
        self.assertValidationError(self.confirm({**self.proof(), "current_password": "Incorrect739!"}), "current_password")
        self.assertTrue(EmailChangeRequest.objects.filter(USER_ID=self.user).exists())
        self.assertEqual(self.confirm().status_code, 200)

    def test_password_whitespace_is_preserved_at_request_and_confirmation(self):
        self.password = "  OriginalSecure739!  "
        self.user.set_password(self.password)
        self.user.save(update_fields=["password"])
        tokens = issue_tokens(self.user, False)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.request_change(current_password=self.password).status_code, 200)
        self.assertEqual(self.confirm().status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))

    def test_delivery_failure_preserves_previous_pending_link(self):
        self.request_change()
        previous = self.proof()
        self.delivery.side_effect = RuntimeError("Delivery failed")
        self.assertEqual(self.request_change(new_email="replacement@example.com").status_code, 503)
        self.assertEqual(self.confirm(previous).data["data"]["email"], "new@example.com")

    @patch("apps.authentication.services.email_change_service.SessionService.revoke_all_sessions")
    def test_revocation_failure_rolls_back_email_password_and_consumption(self, revoke):
        self.request_change()
        original_hash = self.user.password
        revoke.side_effect = RuntimeError("Revocation failed")
        with self.assertRaises(RuntimeError):
            self.confirm()
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_EMAIL, "original@example.com")
        self.assertEqual(self.user.password, original_hash)
        self.assertTrue(EmailChangeRequest.objects.filter(USER_ID=self.user).exists())

    def test_security_notice_failure_does_not_undo_confirmed_change(self):
        self.request_change()
        self.notice.side_effect = RuntimeError("Notice delivery failed")
        with self.assertLogs("apps.authentication.services.email_change_service", level="ERROR"), self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.confirm().status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_EMAIL, "new@example.com")

    def test_linked_oauth_identity_retains_new_email_after_provider_sign_in(self):
        OAuthAccount.objects.create(USER=self.user, OAUTH_PROVIDER="google", OAUTH_PROVIDER_ID="google-123")
        self.request_change()
        self.confirm()
        account = OAuthAccountService.get_or_create_user(OAuthUser(
            "google", "google-123", "original@example.com", "Cebu", "Explorer",
        ))
        self.assertEqual(account.pk, self.user.pk)
        self.assertEqual(account.USER_EMAIL, "new@example.com")

    def test_administrative_roles_cannot_use_mobile_email_change(self):
        for role in [User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN]:
            User.objects.filter(pk=self.user.pk).update(USER_ROLE=role)
            self.assertEqual(self.request_change().status_code, 403)

    def test_merchant_can_change_email_without_changing_role(self):
        User.objects.filter(pk=self.user.pk).update(USER_ROLE=User.UserRole.MERCHANT)
        self.request_change()
        self.assertEqual(self.confirm().status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.USER_ROLE, User.UserRole.MERCHANT)

    def test_request_and_confirmation_have_independent_throttles(self):
        for index in range(5):
            self.assertEqual(self.request_change().status_code, 200)
        self.assertEqual(self.request_change().status_code, 429)
        self.assertEqual(self.client.get(reverse("email_change_status")).status_code, 200)
        for index in range(5):
            self.assertEqual(self.confirm({**self.proof(), "current_password": "Incorrect739!"}).status_code, 400)
        self.assertEqual(self.confirm().status_code, 429)
        self.assertEqual(self.client.post(reverse("cancel_email_change")).status_code, 200)

    def test_email_templates_render_proof_and_security_notice(self):
        for extension in ["html", "txt"]:
            body = render_to_string(f"emails/change_email.{extension}", {
                "user": self.user, "verification_link": "com.sugbogo.app://confirm-email-change?token=proof", "expiry_minutes": 30,
            })
            self.assertIn("confirm-email-change", body)
            self.assertIn("30", body)
            self.assertIn(self.user.USER_EMAIL, render_to_string(f"emails/email_changed.{extension}", {"user": self.user}))
