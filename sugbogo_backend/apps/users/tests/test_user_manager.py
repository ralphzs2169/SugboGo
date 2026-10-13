from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.users.models import User


class UserManagerTests(TestCase):
    """Tests for normal and privileged user-manager creation semantics."""

    def test_create_superuser_creates_consistent_sugbo_go_super_admin(self):
        user = User.objects.create_superuser(
            email="managed-super-admin@example.com",
            password="TestOnly-SuperAdmin-482!",
            USER_FNAME="Managed",
            USER_LNAME="Administrator",
        )

        self.assertEqual(user.USER_ROLE, User.UserRole.SUPER_ADMIN)
        self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertIsNotNone(user.EMAIL_VERIFIED_AT)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("TestOnly-SuperAdmin-482!"))

    def test_create_superuser_rejects_contradictory_privilege_values(self):
        invalid_overrides = {
            "USER_ROLE": User.UserRole.ADMIN,
            "USER_STATUS": User.UserStatus.PENDING,
            "EMAIL_VERIFIED": False,
            "is_staff": False,
            "is_superuser": False,
        }

        for field_name, invalid_value in invalid_overrides.items():
            with self.subTest(field_name=field_name):
                with self.assertRaises(ValueError):
                    User.objects.create_superuser(
                        email=f"invalid-{field_name.lower()}@example.com",
                        password="TestOnly-SuperAdmin-482!",
                        USER_FNAME="Invalid",
                        USER_LNAME="Administrator",
                        **{field_name: invalid_value},
                    )

    def test_create_user_preserves_normal_account_defaults(self):
        user = User.objects.create_user(
            email="normal-user@example.com",
            password="TestOnly-NormalUser-482!",
            USER_FNAME="Normal",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
        )

        self.assertEqual(user.USER_ROLE, User.UserRole.EXPLORER)
        self.assertEqual(user.USER_STATUS, User.UserStatus.PENDING)
        self.assertFalse(user.EMAIL_VERIFIED)
        self.assertIsNone(user.EMAIL_VERIFIED_AT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_user_configures_django_email_field(self):
        self.assertEqual(User.get_email_field_name(), "USER_EMAIL")

    def test_create_superuser_accepts_django_username_field_keyword(self):
        user = User.objects.create_superuser(
            USER_EMAIL="command-admin@EXAMPLE.COM",
            password="TestOnly-Command-482!",
            USER_FNAME="Command",
            USER_LNAME="Administrator",
        )
        self.assertEqual(user.USER_EMAIL, "command-admin@example.com")
        self.assertEqual(user.USER_ROLE, User.UserRole.SUPER_ADMIN)
        self.assertEqual(user.USER_STATUS, User.UserStatus.ACTIVE)
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertIsNotNone(user.EMAIL_VERIFIED_AT)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("TestOnly-Command-482!"))

    def test_createsuperuser_management_command_creates_login_eligible_account(self):
        output = StringIO()
        with patch.dict("os.environ", {"DJANGO_SUPERUSER_PASSWORD": "TestOnly-Command-482!"}):
            call_command(
                "createsuperuser", interactive=False,
                USER_EMAIL="management-command@example.com",
                USER_FNAME="Command", USER_LNAME="Administrator", stdout=output,
            )
        user = User.objects.get(USER_EMAIL="management-command@example.com")
        self.assertIn("Superuser created successfully", output.getvalue())
        self.assertEqual(user.USER_ROLE, User.UserRole.SUPER_ADMIN)
        self.assertTrue(user.is_active)
        self.assertTrue(user.EMAIL_VERIFIED)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("TestOnly-Command-482!"))

    def test_create_superuser_rejects_conflicting_email_arguments_without_creating_user(self):
        with self.assertRaisesMessage(ValueError, "Supply the same email"):
            User.objects.create_superuser(
                email="first-admin@example.com", USER_EMAIL="other-admin@example.com",
                password="TestOnly-Command-482!", USER_FNAME="Command", USER_LNAME="Administrator",
            )
        self.assertFalse(User.objects.filter(USER_EMAIL__in=(
            "first-admin@example.com", "other-admin@example.com",
        )).exists())

    def test_create_superuser_accepts_identical_email_arguments(self):
        user = User.objects.create_superuser(
            email="same-admin@example.com", USER_EMAIL="same-admin@example.com",
            password="TestOnly-Command-482!", USER_FNAME="Command", USER_LNAME="Administrator",
        )
        self.assertEqual(user.USER_EMAIL, "same-admin@example.com")

    def test_create_superuser_still_requires_an_email(self):
        with self.assertRaisesMessage(ValueError, "Users must have an email address"):
            User.objects.create_superuser(password="TestOnly-Command-482!")
