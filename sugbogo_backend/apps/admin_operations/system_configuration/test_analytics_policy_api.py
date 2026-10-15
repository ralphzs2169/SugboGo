"""Configuration role access, strict command validation, envelopes, and audit pagination."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import AnalyticsPolicyChange, AnalyticsPolicyConfiguration


class AnalyticsPolicyAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = {role: User.objects.create_user(email=f"policy-{role}@example.com", password=None,
            USER_FNAME="Policy", USER_LNAME="Fixture", USER_ROLE=role, USER_STATUS=User.UserStatus.ACTIVE)
            for role in User.UserRole.values}

    def setUp(self):
        self.url = reverse("analytics-policy")
        self.history_url = reverse("analytics-policy-history")
        self.client.force_authenticate(self.users[User.UserRole.SUPER_ADMIN])

    def command(self, **overrides):
        return {"expected_version": 1, "reason": "Approved review.", "values": {"peer_min_businesses": 6}, **overrides}

    def test_get_exposes_current_policy_and_fixed_form_metadata(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["version"], 1)
        self.assertEqual(response.data["data"]["schema"]["peer_min_businesses"]["minimum"], 5)
        self.assertEqual(response.data["data"]["fixed_policy"]["low_exposure_window_days"], 30)

    def test_only_active_super_admin_can_read_update_and_view_history(self):
        for role in (User.UserRole.ADMIN, User.UserRole.MERCHANT, User.UserRole.EXPLORER):
            self.client.force_authenticate(self.users[role])
            with self.subTest(role=role):
                self.assertEqual(self.client.get(self.url).status_code, 403)
                self.assertEqual(self.client.patch(self.url, self.command(), format="json").status_code, 403)
                self.assertEqual(self.client.get(self.history_url).status_code, 403)
        admin = self.users[User.UserRole.SUPER_ADMIN]
        admin.USER_STATUS = User.UserStatus.DISABLED
        admin.save(update_fields=["USER_STATUS"])
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    def test_patch_returns_new_revision_and_paginated_audit(self):
        response = self.client.patch(self.url, self.command(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["version"], 2)
        self.assertTrue(response.data["data"]["changed"])
        history = self.client.get(self.history_url, {"page_size": 1})
        self.assertEqual(history.data["data"]["items"][0]["version"], 2)
        self.assertEqual(history.data["data"]["pagination"]["total_items"], 2)
        self.assertTrue(history.data["data"]["pagination"]["has_next"])
        self.assertNotIn("email", history.data["data"]["items"][0])

    def test_noop_and_conflict_have_explicit_response_behavior(self):
        unchanged = self.client.patch(self.url, self.command(values={"peer_min_businesses": 5}), format="json")
        self.assertFalse(unchanged.data["data"]["changed"])
        self.client.patch(self.url, self.command(), format="json")
        conflict = self.client.patch(self.url, self.command(values={"peer_min_businesses": 7}), format="json")
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.data["code"], "ANALYTICS_POLICY_VERSION_CONFLICT")
        self.assertEqual(AnalyticsPolicyChange.objects.count(), 2)

    def test_rejects_unknown_fields_unsafe_values_and_missing_change_evidence(self):
        for command in (self.command(expected_version=True), self.command(reason=""), self.command(values={}),
                        self.command(values={"peer_min_businesses": 4}), self.command(values={"coverage_verified": True}),
                        self.command(extra="ignored")):
            with self.subTest(command=command):
                self.assertEqual(self.client.patch(self.url, command, format="json").status_code, 400)
        self.assertEqual(AnalyticsPolicyChange.objects.count(), 1)

    def test_missing_policy_returns_unavailable_without_creating_defaults(self):
        AnalyticsPolicyConfiguration.objects.all().delete()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "ANALYTICS_POLICY_UNAVAILABLE")
        self.assertFalse(AnalyticsPolicyConfiguration.objects.exists())

    def test_history_is_read_only_and_placeholder_endpoint_is_preserved(self):
        self.assertEqual(self.client.patch(self.history_url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.get(reverse("get_system_configuration_data")).status_code, 200)
