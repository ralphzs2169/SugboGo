from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.db import DatabaseError
from django.urls import reverse
from django.utils import timezone
from google.auth.exceptions import GoogleAuthError, TransportError
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.authentication.models import LoginEvent
from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.services.oauth.facebook import FacebookAuthError
from apps.authentication.services.login_history_service import LoginHistoryService
from apps.authentication.tasks import prune_login_history
from apps.users.models import User


class LoginHistoryTests(APITestCase):
    """Covers final authentication outcomes, privacy, ownership, and retention."""

    def setUp(self):
        """Creates a verified explorer without generating a login event."""
        cache.clear()
        self.password = "StrongPassword123!"
        self.user = User.objects.create_user(
            email="history@example.com", password=self.password,
            USER_FNAME="History", USER_LNAME="Tester",
            USER_ROLE=User.UserRole.EXPLORER, USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    def login(self, **overrides):
        """Posts password proof with deterministic peer and client metadata."""
        return self.client.post(reverse("login"), {
            "email": self.user.USER_EMAIL.upper(), "password": self.password, **overrides,
        }, format="json", REMOTE_ADDR="192.0.2.1",
            HTTP_X_FORWARDED_FOR="198.51.100.1", HTTP_USER_AGENT="okhttp/4 Android secret-token")

    def test_password_success_and_failure_update_last_login_only_on_success(self):
        """Persists final password outcomes without advancing last_login on rejection."""
        self.assertEqual(self.login().status_code, 200)
        self.user.refresh_from_db()
        last_login = self.user.last_login
        self.assertIsNotNone(last_login)
        event = LoginEvent.objects.get()
        self.assertEqual(event.USER, self.user)
        self.assertEqual(event.LEVT_OUTCOME, "success")
        self.assertEqual(event.LEVT_METHOD, "password")
        self.assertEqual(event.LEVT_IP_ADDRESS, "192.0.2.1")
        self.assertEqual((event.LEVT_PLATFORM, event.LEVT_CLIENT), ("Android", "Mobile app"))
        self.assertNotIn("secret", str(event.__dict__))
        self.assertEqual(self.login(password="wrong").status_code, 401)
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_login, last_login)
        self.assertEqual(LoginEvent.objects.first().LEVT_OUTCOME, "failed")

    def test_unknown_email_and_malformed_payload_are_not_attached_to_an_account(self):
        """Retains anonymous outcomes without saving an attempted address or password."""
        self.assertEqual(self.login(email="missing@example.com").status_code, 401)
        response = self.client.post(reverse("login"), [], format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(LoginEvent.objects.filter(USER__isnull=True).count(), 2)
        self.assertNotIn("missing@example.com", str(list(LoginEvent.objects.values())))

    def test_wrong_portal_and_inactive_accounts_are_failures(self):
        """Does not count credential proof alone as a completed sign-in."""
        response = self.client.post(reverse("admin_login"), {
            "email": self.user.USER_EMAIL, "password": self.password,
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(LoginEvent.objects.get().LEVT_METHOD, "admin")
        self.user.USER_STATUS = User.UserStatus.DISABLED
        self.user.save(update_fields=["USER_STATUS"])
        self.assertEqual(self.login().status_code, 403)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.last_login)
        self.assertFalse(LoginEvent.objects.filter(LEVT_OUTCOME="success").exists())

    def test_admin_success_and_mobile_role_denial_are_recorded(self):
        """Records administrative authentication after portal eligibility checks."""
        self.user.USER_ROLE = User.UserRole.ADMIN
        self.user.save(update_fields=["USER_ROLE"])
        response = self.client.post(reverse("admin_login"), {
            "email": self.user.USER_EMAIL, "password": self.password,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        event = LoginEvent.objects.get()
        self.assertEqual((event.LEVT_METHOD, event.LEVT_OUTCOME), ("admin", "success"))
        self.user.refresh_from_db()
        last_login = self.user.last_login
        self.assertEqual(self.login().status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_login, last_login)

    def test_refresh_does_not_create_login_events_or_advance_last_login(self):
        """Excludes token renewal from completed interactive sign-ins."""
        response = self.login()
        self.user.refresh_from_db()
        last_login = self.user.last_login
        self.assertEqual(self.client.post(reverse("token_refresh"), {
            "refresh": response.data["data"]["refresh"],
        }, format="json").status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_login, last_login)
        self.assertEqual(LoginEvent.objects.count(), 1)

    def test_token_or_history_failure_rolls_back_success_and_last_login(self):
        """Fails closed when the success event cannot be committed with the session."""
        self.client.raise_request_exception = False
        with patch.object(LoginHistoryService, "record", side_effect=DatabaseError("unavailable")):
            response = self.login()
        self.assertEqual(response.status_code, 500)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.last_login)
        self.assertEqual(OutstandingToken.objects.count(), 0)

    def test_oauth_success_and_verified_denial_for_both_providers(self):
        """Links outcomes only after provider verification and final account checks."""
        for provider, target, field in [
            ("google", "google_login.GoogleOAuthService.verify_id_token", "id_token"),
            ("facebook", "facebook_login_view.FacebookOAuthService.verify_access_token", "access_token"),
        ]:
            with self.subTest(provider=provider):
                cache.clear()
                self.user.USER_STATUS = User.UserStatus.ACTIVE
                self.user.save(update_fields=["USER_STATUS"])
                identity = OAuthUser(provider, f"{provider}-id", self.user.USER_EMAIL, "History", "Tester")
                with patch(f"apps.authentication.views.{target}", return_value=identity):
                    response = self.client.post(reverse(f"{provider}_login"), {field: "proof"}, format="json")
                self.assertEqual(response.status_code, 200)
                event = LoginEvent.objects.first()
                self.assertEqual((event.USER, event.LEVT_METHOD, event.LEVT_OUTCOME), (self.user, provider, "success"))
                self.user.refresh_from_db()
                last_login = self.user.last_login
                self.user.USER_STATUS = User.UserStatus.DISABLED
                self.user.save(update_fields=["USER_STATUS"])
                # A linked identity remains authoritative even after its email changes.
                identity.email = "unrelated@example.com"
                with patch(f"apps.authentication.views.{target}", return_value=identity):
                    response = self.client.post(reverse(f"{provider}_login"), {field: "proof"}, format="json")
                self.assertEqual(response.status_code, 403)
                event = LoginEvent.objects.first()
                self.assertEqual((event.USER, event.LEVT_OUTCOME), (self.user, "failed"))
                self.user.refresh_from_db()
                self.assertEqual(self.user.last_login, last_login)

    def test_invalid_oauth_proof_and_provider_outage_remain_unattributed(self):
        """Never uses caller-supplied emails to identify rejected OAuth claims."""
        for provider, target, field, error in [
            ("google", "google_login.GoogleOAuthService.verify_id_token", "id_token", GoogleAuthError("bad")),
            ("facebook", "facebook_login_view.FacebookOAuthService.verify_access_token", "access_token", FacebookAuthError("bad")),
        ]:
            with self.subTest(provider=provider), patch(f"apps.authentication.views.{target}", side_effect=error):
                response = self.client.post(reverse(f"{provider}_login"), {
                    field: "bad-proof", "email": self.user.USER_EMAIL,
                }, format="json")
            self.assertEqual(response.status_code, 401)
            self.assertIsNone(LoginEvent.objects.first().USER_id)
        with patch("apps.authentication.views.google_login.GoogleOAuthService.verify_id_token", side_effect=TransportError("offline")):
            self.assertEqual(self.client.post(reverse("google_login"), {"id_token": "proof"}, format="json").status_code, 503)
        self.assertEqual(LoginEvent.objects.first().LEVT_OUTCOME, "unavailable")

    def test_history_is_authenticated_owned_retained_and_paginated(self):
        """Ignores user filters and exposes a minimal, deterministically ordered page."""
        url = reverse("login_history")
        self.assertEqual(self.client.get(url).status_code, 401)
        event = LoginHistoryService.record(request=self.client.get(url).wsgi_request,
            method="password", outcome="failed", user=self.user)
        LoginEvent.objects.filter(pk=event.pk).update(LEVT_CREATED_AT=timezone.now() - timedelta(days=91))
        for _ in range(12):
            LoginEvent.objects.create(USER=self.user, LEVT_METHOD="password", LEVT_OUTCOME="success")
        other = User.objects.create_user(email="other@example.com", password=self.password,
            USER_FNAME="Other", USER_LNAME="Tester", USER_STATUS=User.UserStatus.ACTIVE, EMAIL_VERIFIED=True)
        LoginEvent.objects.create(USER=other, LEVT_METHOD="admin", LEVT_OUTCOME="failed")
        LoginEvent.objects.create(LEVT_METHOD="google", LEVT_OUTCOME="failed")
        self.client.force_authenticate(self.user)
        response = self.client.get(url, {"user_id": other.pk})
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["pagination"]["total_items"], 12)
        self.assertTrue(data["pagination"]["has_next"])
        self.assertEqual(set(data["items"][0]), {"id", "method", "outcome", "ip_address", "platform", "client", "created_at"})
        ids = [item["id"] for item in data["items"]]
        self.assertEqual(ids, sorted(ids, reverse=True))
        page_two = self.client.get(url, {"page": 2}).data["data"]
        self.assertEqual(len(page_two["items"]), 2)
        self.assertFalse(page_two["pagination"]["has_next"])

    def test_prune_removes_expired_owned_and_anonymous_events(self):
        """Physically deletes old records while preserving the retention boundary."""
        now = timezone.now()
        for owner in [self.user, None]:
            LoginEvent.objects.create(USER=owner, LEVT_METHOD="password", LEVT_OUTCOME="failed", LEVT_CREATED_AT=now - timedelta(days=91))
        retained = LoginEvent.objects.create(USER=self.user, LEVT_METHOD="password", LEVT_OUTCOME="success", LEVT_CREATED_AT=now - timedelta(days=90))
        with patch("apps.authentication.services.login_history_service.timezone.now", return_value=now):
            call_command("prune_login_history", stdout=StringIO())
        self.assertEqual(list(LoginEvent.objects.values_list("pk", flat=True)), [retained.pk])

    def test_metadata_does_not_trust_forwarded_headers_or_persist_arbitrary_text(self):
        """Normalizes only recognized client labels and valid direct peer addresses."""
        request = self.client.get(reverse("login_history"), REMOTE_ADDR="invalid",
            HTTP_X_FORWARDED_FOR="203.0.113.4", HTTP_USER_AGENT="password=secret\r\nBearer proof").wsgi_request
        self.assertEqual(LoginHistoryService.metadata(request), {
            "LEVT_IP_ADDRESS": None, "LEVT_PLATFORM": "Unknown", "LEVT_CLIENT": "Unknown",
        })

    def test_scheduled_pruning_is_idempotent(self):
        """Allows a retry of the scheduled job without removing recent records."""
        LoginEvent.objects.create(LEVT_METHOD="google", LEVT_OUTCOME="failed", LEVT_CREATED_AT=timezone.now() - timedelta(days=91))
        LoginEvent.objects.create(USER=self.user, LEVT_METHOD="password", LEVT_OUTCOME="success")
        self.assertEqual(prune_login_history.run(), 1)
        self.assertEqual(prune_login_history.run(), 0)
        self.assertEqual(LoginEvent.objects.count(), 1)
