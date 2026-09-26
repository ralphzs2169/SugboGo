from decimal import Decimal

from django.contrib.gis.geos import Point
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.admin_operations.activity_management.models import AdminActivity
from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import MerchantApplication
from apps.users.models import User


class AdminUserManagementAPITests(APITestCase):
    """Covers administrator user queries, transitions, sessions, and audit history."""

    password = "StrongPassword123!"

    def setUp(self):
        self.admin = self.create_user(
            email="admin@example.com",
            role=User.UserRole.ADMIN,
            first_name="Ada",
            last_name="Admin",
        )
        self.super_admin = self.create_user(
            email="super@example.com",
            role=User.UserRole.SUPER_ADMIN,
            first_name="Sofia",
            last_name="Super",
        )
        self.other_admin = self.create_user(
            email="other-admin@example.com",
            role=User.UserRole.ADMIN,
            first_name="Otto",
            last_name="Admin",
        )
        self.explorer = self.create_user(
            email="explorer@example.com",
            role=User.UserRole.EXPLORER,
            first_name="Eli",
            last_name="Explorer",
        )
        self.merchant = self.create_user(
            email="merchant@example.com",
            role=User.UserRole.MERCHANT,
            first_name="Mara",
            last_name="Merchant",
        )

    def create_user(
        self,
        *,
        email,
        role,
        first_name="Test",
        last_name="User",
        user_status=User.UserStatus.ACTIVE,
    ):
        """Creates one verified user for a management API test."""
        return User.objects.create_user(
            email=email,
            password=self.password,
            USER_FNAME=first_name,
            USER_LNAME=last_name,
            USER_ROLE=role,
            USER_STATUS=user_status,
            EMAIL_VERIFIED=True,
            USER_REPUTATION=Decimal("0.20000"),
        )

    def authenticate(self, user):
        """Authenticates the API client as the supplied administrator."""
        self.client.force_authenticate(
            user=user,
        )

    def suspend(self, actor, target, reason="Repeated policy violations"):
        """Calls the suspend endpoint as the supplied administrator."""
        self.authenticate(actor)
        payload = {}

        if reason is not None:
            payload["reason"] = reason

        return self.client.post(
            reverse(
                "admin-user-suspend",
                args=[target.USER_ID],
            ),
            payload,
            format="json",
        )

    def reactivate(self, actor, target):
        """Calls the reactivate endpoint as the supplied administrator."""
        self.authenticate(actor)
        return self.client.post(
            reverse(
                "admin-user-reactivate",
                args=[target.USER_ID],
            ),
            {},
            format="json",
        )

    def test_admin_can_list_users_with_standard_pagination(self):
        self.authenticate(self.admin)

        response = self.client.get(
            reverse("admin-user-list"),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("items", response.data["data"])
        self.assertIn("pagination", response.data["data"])

    def test_user_list_filters_by_role(self):
        self.authenticate(self.admin)

        response = self.client.get(
            reverse("admin-user-list"),
            {
                "role": User.UserRole.MERCHANT,
            },
        )

        roles = {
            item["role"]
            for item in response.data["data"]["items"]
        }
        self.assertEqual(roles, {User.UserRole.MERCHANT})

    def test_user_list_filters_by_status(self):
        self.explorer.USER_STATUS = User.UserStatus.SUSPENDED
        self.explorer.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )
        self.authenticate(self.admin)

        response = self.client.get(
            reverse("admin-user-list"),
            {
                "status": User.UserStatus.SUSPENDED,
            },
        )

        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [self.explorer.USER_ID],
        )

    def test_user_list_searches_full_name_and_email(self):
        self.authenticate(self.admin)

        name_response = self.client.get(
            reverse("admin-user-list"),
            {
                "search": "Eli Explorer",
            },
        )
        email_response = self.client.get(
            reverse("admin-user-list"),
            {
                "search": "merchant@example.com",
            },
        )

        self.assertEqual(
            name_response.data["data"]["items"][0]["id"],
            self.explorer.USER_ID,
        )
        self.assertEqual(
            email_response.data["data"]["items"][0]["id"],
            self.merchant.USER_ID,
        )

    def test_user_list_paginates_results(self):
        for index in range(12):
            self.create_user(
                email=f"explorer-{index}@example.com",
                role=User.UserRole.EXPLORER,
            )

        self.authenticate(self.admin)
        response = self.client.get(
            reverse("admin-user-list"),
            {
                "page_size": 5,
            },
        )

        self.assertEqual(len(response.data["data"]["items"]), 5)
        self.assertEqual(
            response.data["data"]["pagination"]["page_size"],
            5,
        )
        self.assertGreater(
            response.data["data"]["pagination"]["total_pages"],
            1,
        )

    def test_user_detail_includes_profile_relationship_and_summary(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
        )
        self.authenticate(self.admin)

        response = self.client.get(
            reverse(
                "admin-user-detail",
                args=[self.merchant.USER_ID],
            ),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = response.data["data"]
        self.assertEqual(user["id"], self.merchant.USER_ID)
        self.assertEqual(user["application"]["id"], application.MAPP_ID)
        self.assertEqual(user["activity_summary"]["reviews"], 0)
        self.assertIn("review_disputes", user["activity_summary"])

    def test_recent_activity_returns_normalized_merchant_application_event(self):
        application = MerchantApplication.objects.create(
            USER_ID=self.merchant,
        )
        self.authenticate(self.admin)

        response = self.client.get(
            reverse(
                "admin-user-activity",
                args=[self.merchant.USER_ID],
            ),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"][0]["type"], "merchant_application_created")
        self.assertEqual(
            response.data["data"][0]["description_data"]["application_id"],
            application.MAPP_ID,
        )

    def test_admin_can_suspend_explorer(self):
        response = self.suspend(
            self.admin,
            self.explorer,
        )

        self.explorer.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.explorer.USER_STATUS,
            User.UserStatus.SUSPENDED,
        )

    def test_admin_can_suspend_merchant(self):
        response = self.suspend(
            self.admin,
            self.merchant,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_cannot_suspend_another_admin(self):
        response = self.suspend(
            self.admin,
            self.other_admin,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_suspend_super_admin(self):
        response = self.suspend(
            self.admin,
            self.super_admin,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_suspend_themselves(self):
        response = self.suspend(
            self.admin,
            self.admin,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_suspend_admin(self):
        response = self.suspend(
            self.super_admin,
            self.other_admin,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_super_admin_cannot_suspend_themselves(self):
        response = self.suspend(
            self.super_admin,
            self.super_admin,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_suspended_user_cannot_be_suspended_again(self):
        self.explorer.USER_STATUS = User.UserStatus.SUSPENDED
        self.explorer.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        response = self.suspend(
            self.admin,
            self.explorer,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_suspended_user_can_be_reactivated(self):
        self.explorer.USER_STATUS = User.UserStatus.SUSPENDED
        self.explorer.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        response = self.reactivate(
            self.admin,
            self.explorer,
        )

        self.explorer.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.explorer.USER_STATUS,
            User.UserStatus.ACTIVE,
        )

    def test_active_user_cannot_be_reactivated(self):
        response = self.reactivate(
            self.admin,
            self.explorer,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_disabled_user_cannot_be_reactivated(self):
        self.explorer.USER_STATUS = User.UserStatus.DISABLED
        self.explorer.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        response = self.reactivate(
            self.admin,
            self.explorer,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pending_user_cannot_be_reactivated(self):
        self.explorer.USER_STATUS = User.UserStatus.PENDING
        self.explorer.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        response = self.reactivate(
            self.admin,
            self.explorer,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_suspend_requires_non_blank_reason(self):
        missing_response = self.suspend(
            self.admin,
            self.explorer,
            reason=None,
        )
        blank_response = self.suspend(
            self.admin,
            self.explorer,
            reason="   ",
        )

        self.assertEqual(
            missing_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            blank_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_suspension_revokes_all_outstanding_refresh_sessions(self):
        first_refresh = RefreshToken.for_user(
            self.explorer,
        )
        second_refresh = RefreshToken.for_user(
            self.explorer,
        )

        self.suspend(
            self.admin,
            self.explorer,
        )

        blacklisted_jtis = set(
            BlacklistedToken.objects
            .filter(
                token__user=self.explorer,
            )
            .values_list(
                "token__jti",
                flat=True,
            )
        )
        self.assertIn(first_refresh["jti"], blacklisted_jtis)
        self.assertIn(second_refresh["jti"], blacklisted_jtis)

    def test_suspension_blocks_access_refresh_and_login_until_reactivated(self):
        access = str(
            RefreshToken.for_user(self.explorer).access_token,
        )
        refresh = str(
            RefreshToken.for_user(self.explorer),
        )

        self.suspend(
            self.admin,
            self.explorer,
        )

        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        access_response = self.client.get(
            reverse("me"),
        )
        self.client.credentials()

        refresh_response = self.client.post(
            reverse("token_refresh"),
            {
                "refresh": refresh,
            },
            format="json",
        )
        login_response = self.client.post(
            reverse("login"),
            {
                "email": self.explorer.USER_EMAIL,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(access_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(login_response.status_code, status.HTTP_403_FORBIDDEN)

        self.reactivate(
            self.admin,
            self.explorer,
        )
        self.client.force_authenticate(user=None)
        login_response = self.client.post(
            reverse("login"),
            {
                "email": self.explorer.USER_EMAIL,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_suspend_and_reactivate_create_ordered_audit_history(self):
        reason = "Repeated policy violations"
        self.suspend(
            self.admin,
            self.explorer,
            reason=reason,
        )
        self.reactivate(
            self.super_admin,
            self.explorer,
        )

        activities = AdminActivity.objects.filter(
            TARGET_USER_ID=self.explorer,
        )
        suspension = activities.get(
            AACT_ACTION=AdminActivity.Action.USER_SUSPENDED,
        )
        reactivation = activities.get(
            AACT_ACTION=AdminActivity.Action.USER_REACTIVATED,
        )

        self.assertEqual(suspension.ACTOR_ID, self.admin)
        self.assertEqual(suspension.TARGET_USER_ID, self.explorer)
        self.assertEqual(suspension.AACT_CONTEXT["reason"], reason)
        self.assertEqual(reactivation.ACTOR_ID, self.super_admin)

        self.authenticate(self.admin)
        response = self.client.get(
            reverse(
                "admin-user-administrative-history",
                args=[self.explorer.USER_ID],
            ),
        )

        history = response.data["data"]["items"]
        self.assertEqual(history[0]["action"], "user_reactivated")
        self.assertEqual(history[1]["action"], "user_suspended")

    def test_suspending_merchant_does_not_change_business_status(self):
        cluster = Cluster.objects.create(
            CLUS_NAME="Food",
        )
        category = Category.objects.create(
            CTGRY_NAME="Cafe",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                123.9,
                10.3,
                srid=4326,
            ),
            LOCT_ADDRESS="Cebu City",
        )
        business = Business.objects.create(
            BUSN_NAME="Merchant Cafe",
            BUSN_CONTACT_NUMBER="09123456789",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

        response = self.suspend(
            self.admin,
            self.merchant,
        )

        business.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            business.BUSN_STATUS,
            Business.BusinessStatus.ACTIVE,
        )
