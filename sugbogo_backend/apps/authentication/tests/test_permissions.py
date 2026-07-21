from django.test import TestCase
from rest_framework.test import APIRequestFactory
# from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import (
    HasRole,
    user_has_role,
)
from apps.users.models import User


class AuthorizationPermissionTests(TestCase):
    """Tests for authentication authorization permissions."""

    def setUp(self):
        self.factory = APIRequestFactory()

        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        self.super_admin = User.objects.create_user(
            email="superadmin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Super",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        self.merchant = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

        self.explorer = User.objects.create_user(
            email="explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="User",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    def test_admin_has_admin_role(self):
        self.assertTrue(
            user_has_role(
                self.admin,
                User.UserRole.ADMIN,
            )
        )

    def test_super_admin_inherits_admin_role(self):
        self.assertTrue(
            user_has_role(
                self.super_admin,
                User.UserRole.ADMIN,
            )
        )

    def test_merchant_does_not_have_admin_role(self):
        self.assertFalse(
            user_has_role(
                self.merchant,
                User.UserRole.ADMIN,
            )
        )

    def test_explorer_does_not_have_admin_role(self):
        self.assertFalse(
            user_has_role(
                self.explorer,
                User.UserRole.ADMIN,
            )
        )

    def test_has_role_denies_inactive_user(self):
        self.admin.USER_STATUS = User.UserStatus.SUSPENDED
        self.admin.save()

        request = self.factory.get("/")
        request.user = self.admin

        permission = HasRole(User.UserRole.ADMIN)

        self.assertFalse(
            permission.has_permission(
                request,
                None,
            )
        )

    def test_has_role_denies_anonymous_user(self):
        request = self.factory.get("/")
        request.user = None

        permission = HasRole(User.UserRole.ADMIN)

        self.assertFalse(
            permission.has_permission(
                request,
                None,
            )
        )