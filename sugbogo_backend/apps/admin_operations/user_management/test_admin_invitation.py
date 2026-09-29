from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.admin_operations.activity_management.models import AdminActivity
from apps.users.models import User


class AdminProvisioningAPITests(APITestCase):
    """Covers protected Admin creation, audit, and invitation resend APIs."""

    password = "TestOnly-StrongPassword-482!"

    def setUp(self):
        self.super_admin = self.create_user(
            email="super-admin@example.com",
            role=User.UserRole.SUPER_ADMIN,
        )
        self.admin = self.create_user(
            email="admin@example.com",
            role=User.UserRole.ADMIN,
        )
        self.explorer = self.create_user(
            email="explorer@example.com",
            role=User.UserRole.EXPLORER,
        )
        self.merchant = self.create_user(
            email="merchant@example.com",
            role=User.UserRole.MERCHANT,
        )
        self.create_url = reverse("admin-create")

    def create_user(
        self,
        *,
        email,
        role,
        status_value=User.UserStatus.ACTIVE,
        verified=True,
        password=None,
        first_name="Test",
        last_name="User",
    ):
        """Creates a deterministic user for provisioning API tests."""
        return User.objects.create_user(
            email=email,
            password=self.password if password is None else password,
            USER_FNAME=first_name,
            USER_LNAME=last_name,
            USER_ROLE=role,
            USER_STATUS=status_value,
            EMAIL_VERIFIED=verified,
            USER_REPUTATION=Decimal("0.20000"),
        )

    def create_invited_admin(self, *, email="invited@example.com"):
        """Creates an incomplete pending Admin eligible for resend."""
        return User.objects.create_user(
            email=email,
            password=None,
            USER_FNAME="Invited",
            USER_LNAME="Admin",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.PENDING,
            EMAIL_VERIFIED=False,
            EMAIL_VERIFIED_AT=None,
            is_staff=False,
            is_superuser=False,
            USER_REPUTATION=Decimal("0.20000"),
        )

    def authenticate(self, user):
        """Authenticates the client as the supplied user."""
        self.client.force_authenticate(user=user)

    def create_payload(self, **overrides):
        """Returns a valid Create Admin payload with optional overrides."""
        payload = {
            "email": "new-admin@example.com",
            "first_name": "Juan",
            "last_name": "Dela Cruz",
        }
        payload.update(overrides)
        return payload

    @patch(
        "apps.admin_operations.user_management.views.EmailService.send_admin_invitation_email"
    )
    def test_super_admin_creates_exact_pending_admin_and_audit(
        self,
        mock_send_invitation,
    ):
        self.authenticate(self.super_admin)

        def assert_audit_exists(user):
            self.assertTrue(
                AdminActivity.objects.filter(
                    ACTOR_ID=self.super_admin,
                    TARGET_USER_ID=user,
                    AACT_ACTION=AdminActivity.Action.ADMIN_CREATED,
                ).exists()
            )

        mock_send_invitation.side_effect = assert_audit_exists

        response = self.client.post(
            self.create_url,
            self.create_payload(
                email="New-Admin@Example.COM",
                role=User.UserRole.SUPER_ADMIN,
                status=User.UserStatus.ACTIVE,
                password=self.password,
                email_verified=True,
                is_staff=True,
                is_superuser=True,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invited_admin = User.objects.get(
            USER_EMAIL="new-admin@example.com",
        )
        self.assertEqual(invited_admin.USER_ROLE, User.UserRole.ADMIN)
        self.assertEqual(invited_admin.USER_STATUS, User.UserStatus.PENDING)
        self.assertFalse(invited_admin.EMAIL_VERIFIED)
        self.assertIsNone(invited_admin.EMAIL_VERIFIED_AT)
        self.assertFalse(invited_admin.has_usable_password())
        self.assertFalse(invited_admin.is_staff)
        self.assertFalse(invited_admin.is_superuser)
        self.assertTrue(response.data["data"]["invitation_email_sent"])

        activity = AdminActivity.objects.get(
            TARGET_USER_ID=invited_admin,
            AACT_ACTION=AdminActivity.Action.ADMIN_CREATED,
        )
        self.assertEqual(activity.ACTOR_ID, self.super_admin)
        self.assertEqual(activity.AACT_CONTEXT, {})
        self.assertIsNotNone(activity.AACT_CREATED_AT)
        self.assertNotIn("token", str(activity.AACT_CONTEXT).lower())
        self.assertNotIn("password", str(activity.AACT_CONTEXT).lower())

    def test_only_super_admin_can_create_admin(self):
        for actor in (
            self.admin,
            self.explorer,
            self.merchant,
        ):
            with self.subTest(role=actor.USER_ROLE):
                self.authenticate(actor)
                response = self.client.post(
                    self.create_url,
                    self.create_payload(
                        email=f"{actor.USER_ROLE}-denied@example.com",
                    ),
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_unauthenticated_user_cannot_create_admin(self):
        response = self.client.post(
            self.create_url,
            self.create_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_duplicate_email_conflicts_never_reuse_existing_accounts(self):
        cases = (
            (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
            (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
            (User.UserRole.ADMIN, User.UserStatus.DISABLED),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
        )
        self.authenticate(self.super_admin)

        for index, (role, status_value) in enumerate(cases):
            email = f"conflict-{index}@example.com"
            existing = self.create_user(
                email=email,
                role=role,
                status_value=status_value,
            )
            original_role = existing.USER_ROLE
            original_status = existing.USER_STATUS

            with self.subTest(role=role, status=status_value):
                response = self.client.post(
                    self.create_url,
                    self.create_payload(email=email.upper()),
                    format="json",
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                existing.refresh_from_db()
                self.assertEqual(existing.USER_ROLE, original_role)
                self.assertEqual(existing.USER_STATUS, original_status)
                self.assertEqual(
                    User.objects.filter(USER_EMAIL__iexact=email).count(),
                    1,
                )

    @patch(
        "apps.admin_operations.user_management.services.User.objects.create_user",
        side_effect=IntegrityError("simulated unique-email race"),
    )
    def test_create_admin_handles_unique_email_race(self, _mock_create_user):
        self.authenticate(self.super_admin)

        response = self.client.post(
            self.create_url,
            self.create_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "VALIDATION_ERROR")
        self.assertFalse(
            AdminActivity.objects.filter(
                AACT_ACTION=AdminActivity.Action.ADMIN_CREATED,
            ).exists()
        )

    @patch(
        "apps.admin_operations.user_management.views.EmailService.send_admin_invitation_email",
        side_effect=Exception("simulated delivery failure"),
    )
    def test_email_failure_keeps_created_admin_and_audit(self, _mock_send):
        self.authenticate(self.super_admin)

        response = self.client.post(
            self.create_url,
            self.create_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertFalse(response.data["data"]["invitation_email_sent"])
        invited_admin = User.objects.get(USER_EMAIL="new-admin@example.com")
        self.assertEqual(invited_admin.USER_STATUS, User.UserStatus.PENDING)
        self.assertTrue(
            AdminActivity.objects.filter(
                TARGET_USER_ID=invited_admin,
                AACT_ACTION=AdminActivity.Action.ADMIN_CREATED,
            ).exists()
        )

    @patch(
        "apps.admin_operations.user_management.views.EmailService.send_admin_invitation_email"
    )
    def test_super_admin_can_resend_eligible_invitation(self, mock_send):
        invited_admin = self.create_invited_admin()
        self.authenticate(self.super_admin)

        response = self.client.post(
            reverse(
                "admin-invitation-resend",
                args=[invited_admin.USER_ID],
            ),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send.assert_called_once_with(invited_admin)

    def test_admin_cannot_resend_invitation(self):
        invited_admin = self.create_invited_admin()
        self.authenticate(self.admin)

        response = self.client.post(
            reverse(
                "admin-invitation-resend",
                args=[invited_admin.USER_ID],
            ),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_resend_rejects_ineligible_target_states_and_roles(self):
        targets = (
            self.create_user(
                email="completed@example.com",
                role=User.UserRole.ADMIN,
            ),
            self.create_user(
                email="suspended@example.com",
                role=User.UserRole.ADMIN,
                status_value=User.UserStatus.SUSPENDED,
            ),
            self.create_user(
                email="disabled@example.com",
                role=User.UserRole.ADMIN,
                status_value=User.UserStatus.DISABLED,
            ),
            self.create_user(
                email="wrong-role@example.com",
                role=User.UserRole.EXPLORER,
                status_value=User.UserStatus.PENDING,
                verified=False,
            ),
        )
        self.authenticate(self.super_admin)

        for target in targets:
            with self.subTest(role=target.USER_ROLE, state=target.USER_STATUS):
                response = self.client.post(
                    reverse(
                        "admin-invitation-resend",
                        args=[target.USER_ID],
                    ),
                    {},
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_resend_rejects_missing_user(self):
        self.authenticate(self.super_admin)

        response = self.client.post(
            reverse("admin-invitation-resend", args=[999999]),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch(
        "apps.admin_operations.user_management.views.EmailService.send_admin_invitation_email",
        side_effect=Exception("simulated delivery failure"),
    )
    def test_resend_reports_delivery_failure_without_changing_account(
        self,
        _mock_send,
    ):
        invited_admin = self.create_invited_admin()
        self.authenticate(self.super_admin)

        response = self.client.post(
            reverse(
                "admin-invitation-resend",
                args=[invited_admin.USER_ID],
            ),
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["code"], "INVITATION_DELIVERY_FAILED")
        invited_admin.refresh_from_db()
        self.assertEqual(
            invited_admin.USER_STATUS,
            User.UserStatus.PENDING,
        )
        self.assertFalse(invited_admin.EMAIL_VERIFIED)
        self.assertFalse(invited_admin.has_usable_password())
