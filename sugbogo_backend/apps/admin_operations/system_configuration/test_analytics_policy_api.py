"""Read-only analytics policy API and retirement checks."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import AnalyticsPolicyConfiguration


class AnalyticsPolicyAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = {role: User.objects.create_user(email=f"policy-{role}@example.com", password=None,
            USER_FNAME="Policy", USER_LNAME="Fixture", USER_ROLE=role, USER_STATUS=User.UserStatus.ACTIVE)
            for role in User.UserRole.values}

    def setUp(self):
        self.url = reverse("analytics-policy")
        self.client.force_authenticate(self.users[User.UserRole.SUPER_ADMIN])

    def test_get_exposes_current_policy_and_fixed_form_metadata(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["version"], 1)
        self.assertEqual(response.data["data"]["schema"]["peer_min_businesses"]["minimum"], 5)
        self.assertEqual(response.data["data"]["fixed_policy"]["low_exposure_window_days"], 30)

    def test_only_active_super_admin_can_read_policy(self):
        for role in (User.UserRole.ADMIN, User.UserRole.MERCHANT, User.UserRole.EXPLORER):
            self.client.force_authenticate(self.users[role])
            with self.subTest(role=role):
                self.assertEqual(self.client.get(self.url).status_code, 403)
        admin = self.users[User.UserRole.SUPER_ADMIN]
        admin.USER_STATUS = User.UserStatus.DISABLED
        admin.save(update_fields=["USER_STATUS"])
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    def test_patch_and_dedicated_history_are_retired(self):
        response = self.client.patch(
            self.url,
            {"values": {"peer_min_businesses": 6}},
            format="json",
        )
        self.assertEqual(response.status_code, 405)
        self.assertEqual(self.client.get(f"{self.url}history/").status_code, 404)
        self.assertEqual(AnalyticsPolicyConfiguration.objects.get(pk=1).APC_VERSION, 1)

    def test_missing_policy_returns_unavailable_without_creating_defaults(self):
        AnalyticsPolicyConfiguration.objects.all().delete()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "ANALYTICS_POLICY_UNAVAILABLE")
        self.assertFalse(AnalyticsPolicyConfiguration.objects.exists())

    def test_placeholder_endpoint_is_preserved(self):
        self.assertEqual(self.client.get(reverse("get_system_configuration_data")).status_code, 200)
