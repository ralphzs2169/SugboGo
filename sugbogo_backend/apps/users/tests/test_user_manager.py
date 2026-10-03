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
