from unittest.mock import patch

from apps.business.models import Cluster, ClusterDiscoveryShortcut
from apps.explorer_operations.explore_businesses.views.cluster_discovery_shortcut_views import (
    ClusterDiscoveryShortcutView,
)
from apps.users.models import User
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate


class ClusterDiscoveryShortcutViewTests(SimpleTestCase):
    """Tests Explorer Discovery Shortcut response and access control."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = ClusterDiscoveryShortcutView.as_view()

        self.explorer = User(
            USER_ID=1,
            USER_EMAIL="explorer@example.com",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.merchant = User(
            USER_ID=2,
            USER_EMAIL="merchant@example.com",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.admin = User(
            USER_ID=3,
            USER_EMAIL="admin@example.com",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def create_shortcut(
        self,
        *,
        shortcut_id=1,
        cluster_id=1,
        cluster_name="Culinary",
        cluster_icon="utensils",
        title="Find something to eat",
        subtitle="Discover local food, cafés, and treats",
        business_count=5,
    ):
        cluster = Cluster(
            CLUS_ID=cluster_id,
            CLUS_NAME=cluster_name,
            CLUS_ICON=cluster_icon,
        )

        shortcut = ClusterDiscoveryShortcut(
            CDS_ID=shortcut_id,
            CLUS_ID=cluster,
            CDS_TITLE=title,
            CDS_SUBTITLE=subtitle,
            CDS_IS_ACTIVE=True,
        )

        shortcut.business_count = business_count

        return shortcut

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "cluster_discovery_shortcut_views."
        "ClusterDiscoveryShortcutService.list_active_shortcuts"
    )
    def test_explorer_can_retrieve_discovery_shortcuts(
        self,
        mock_list_active_shortcuts,
    ):
        mock_list_active_shortcuts.return_value = [
            self.create_shortcut(),
        ]

        request = self.factory.get(
            "/api/explorer/explore/discovery-shortcuts/",
        )
        force_authenticate(
            request,
            user=self.explorer,
        )

        response = self.view(request)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertEqual(
            response.data["message"],
            "Discovery shortcuts retrieved successfully.",
        )

        self.assertEqual(
            len(response.data["data"]),
            1,
        )

        mock_list_active_shortcuts.assert_called_once_with()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "cluster_discovery_shortcut_views."
        "ClusterDiscoveryShortcutService.list_active_shortcuts"
    )
    def test_merchant_can_retrieve_discovery_shortcuts(
        self,
        mock_list_active_shortcuts,
    ):
        mock_list_active_shortcuts.return_value = [
            self.create_shortcut(),
        ]

        request = self.factory.get(
            "/api/explorer/explore/discovery-shortcuts/",
        )
        force_authenticate(
            request,
            user=self.merchant,
        )

        response = self.view(request)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        mock_list_active_shortcuts.assert_called_once_with()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "cluster_discovery_shortcut_views."
        "ClusterDiscoveryShortcutService.list_active_shortcuts"
    )
    def test_response_contains_serialized_shortcut_data(
        self,
        mock_list_active_shortcuts,
    ):
        mock_list_active_shortcuts.return_value = [
            self.create_shortcut(
                shortcut_id=10,
                cluster_id=20,
                cluster_name="Creative",
                cluster_icon="palette",
                title="Discover local crafts",
                subtitle="Browse handmade goods and creative finds",
                business_count=7,
            ),
        ]

        request = self.factory.get(
            "/api/explorer/explore/discovery-shortcuts/",
        )
        force_authenticate(
            request,
            user=self.explorer,
        )

        response = self.view(request)

        shortcut = response.data["data"][0]

        self.assertEqual(
            shortcut["id"],
            10,
        )

        self.assertEqual(
            shortcut["title"],
            "Discover local crafts",
        )

        self.assertEqual(
            shortcut["subtitle"],
            "Browse handmade goods and creative finds",
        )

        self.assertEqual(
            shortcut["business_count"],
            7,
        )

        self.assertEqual(
            shortcut["cluster"]["id"],
            20,
        )

        self.assertEqual(
            shortcut["cluster"]["name"],
            "Creative",
        )

        self.assertEqual(
            shortcut["cluster"]["icon"],
            "palette",
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "cluster_discovery_shortcut_views."
        "ClusterDiscoveryShortcutService.list_active_shortcuts"
    )
    def test_returns_empty_list_when_no_shortcuts_are_available(
        self,
        mock_list_active_shortcuts,
    ):
        mock_list_active_shortcuts.return_value = []

        request = self.factory.get(
            "/api/explorer/explore/discovery-shortcuts/",
        )
        force_authenticate(
            request,
            user=self.explorer,
        )

        response = self.view(request)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["data"],
            [],
        )

        self.assertEqual(
            response.data["message"],
            "Discovery shortcuts retrieved successfully.",
        )

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "cluster_discovery_shortcut_views."
        "ClusterDiscoveryShortcutService.list_active_shortcuts"
    )
    def test_admin_cannot_access_discovery_shortcuts(
        self,
        mock_list_active_shortcuts,
    ):
        request = self.factory.get(
            "/api/explorer/explore/discovery-shortcuts/",
        )
        force_authenticate(
            request,
            user=self.admin,
        )

        response = self.view(request)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        mock_list_active_shortcuts.assert_not_called()

    @patch(
        "apps.explorer_operations.explore_businesses.views."
        "cluster_discovery_shortcut_views."
        "ClusterDiscoveryShortcutService.list_active_shortcuts"
    )
    def test_unauthenticated_user_cannot_access_discovery_shortcuts(
        self,
        mock_list_active_shortcuts,
    ):
        request = self.factory.get(
            "/api/explorer/explore/discovery-shortcuts/",
        )

        response = self.view(request)

        self.assertIn(
            response.status_code,
            (
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ),
        )

        mock_list_active_shortcuts.assert_not_called()