from django.contrib.auth.hashers import is_password_usable, make_password
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class LegacyBootstrapMigrationTests(TransactionTestCase):
    """Tests for forward-safe retirement of the former bootstrap identity."""

    migrate_from = [("users", "0014_remove_user_user_use_oauth_avatar_and_more")]
    migrate_to = [("users", "0015_disable_legacy_bootstrap_superadmin")]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        self.old_apps = executor.loader.project_state(self.migrate_from).apps

    def create_legacy_shaped_user(self, **overrides):
        """Create a real user record with the historical bootstrap values."""
        values = {
            "USER_EMAIL": "superadmin@gmail.com",
            "USER_FNAME": "Super",
            "USER_LNAME": "Admin",
            "USER_ROLE": "super_admin",
            "USER_STATUS": "active",
            "EMAIL_VERIFIED": True,
            "EMAIL_VERIFIED_AT": None,
            "USER_IS_VERIFIED": True,
            "is_staff": True,
            "is_superuser": True,
            "password": make_password("TestOnly-LegacyBootstrap-482!"),
        }
        values.update(overrides)
        user_model = self.old_apps.get_model("users", "User")
        return user_model.objects.create(**values)

    def migrate_forward(self):
        """Run the remediation and return the post-0015 historical model."""
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        return executor.loader.project_state(self.migrate_to).apps.get_model(
            "users", "User"
        )

    def test_genuine_legacy_bootstrap_account_is_retired(self):
        user = self.create_legacy_shaped_user()
        self.assertTrue(is_password_usable(user.password))

        user_model = self.migrate_forward()

        user = user_model.objects.get(pk=user.pk)
        self.assertEqual(user.USER_STATUS, "disabled")
        self.assertFalse(is_password_usable(user.password))
        self.assertFalse(user.EMAIL_VERIFIED)
        self.assertIsNone(user.EMAIL_VERIFIED_AT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_unrelated_same_email_account_is_unchanged(self):
        verified_at = timezone.now()
        user = self.create_legacy_shaped_user(
            USER_FNAME="Legitimate",
            USER_LNAME="User",
            USER_ROLE="explorer",
            EMAIL_VERIFIED_AT=verified_at,
            USER_IS_VERIFIED=False,
            is_staff=False,
            is_superuser=False,
        )
        original_password_hash = user.password

        user_model = self.migrate_forward()

        user = user_model.objects.get(pk=user.pk)
        self.assertEqual(user.USER_STATUS, "active")
        self.assertEqual(user.password, original_password_hash)
        self.assertTrue(is_password_usable(user.password))
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertEqual(user.EMAIL_VERIFIED_AT, verified_at)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
