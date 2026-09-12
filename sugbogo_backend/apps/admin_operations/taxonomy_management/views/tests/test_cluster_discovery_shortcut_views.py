from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    ClusterDiscoveryShortcut,
    Location,
)
from apps.users.models import User


class ClusterDiscoveryShortcutAdminViewTests(APITestCase):
    """Tests admin Discovery Shortcut CRUD, listing, filtering, and access."""

    def setUp(self):
        self.admin = self._create_user(
            "shortcut-admin@example.com",
            User.UserRole.ADMIN,
        )
        self.super_admin = self._create_user(
            "shortcut-super-admin@example.com",
            User.UserRole.SUPER_ADMIN,
        )
        self.explorer = self._create_user(
            "shortcut-explorer@example.com",
            User.UserRole.EXPLORER,
        )

        self.culinary = Cluster.objects.create(
            CLUS_NAME="Culinary",
            CLUS_ICON=Cluster.ClusterIcon.UTENSILS,
        )
        self.creative = Cluster.objects.create(
            CLUS_NAME="Creative",
            CLUS_ICON=Cluster.ClusterIcon.PALETTE,
        )

        self.list_url = "/api/admin/taxonomy/discovery-shortcuts/"

    def _create_user(self, email, role):
        return User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Discovery",
            USER_LNAME="Shortcut",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _create_shortcut(
        self,
        *,
        cluster=None,
        title="Find something to eat",
        subtitle="Discover local food",
        is_active=True,
    ):
        return ClusterDiscoveryShortcut.objects.create(
            CLUS_ID=cluster or self.culinary,
            CDS_TITLE=title,
            CDS_SUBTITLE=subtitle,
            CDS_IS_ACTIVE=is_active,
        )

    def _create_business(
        self,
        *,
        cluster,
        index,
        status=Business.BusinessStatus.ACTIVE,
    ):
        category, _ = Category.objects.get_or_create(
            CLUS_ID=cluster,
            CTGRY_NAME=f"Category {cluster.CLUS_ID}",
        )

        location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS=f"Address {index}",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        owner = self._create_user(
            f"owner-{cluster.CLUS_ID}-{index}@example.com",
            User.UserRole.MERCHANT,
        )

        return Business.objects.create(
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
            BUSN_NAME=f"Business {cluster.CLUS_ID}-{index}",
            BUSN_DESCRIPTION="Discovery Shortcut test business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status,
            BUSN_IS_VERIFIED=False,
        )

    def test_admin_can_create_discovery_shortcut(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            self.list_url,
            {
                "cluster_id": self.culinary.CLUS_ID,
                "title": "Find something to eat",
                "subtitle": "Discover local food",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertTrue(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "Discovery Shortcut created successfully.",
        )

        shortcut = ClusterDiscoveryShortcut.objects.get(
            CDS_ID=response.data["data"]["id"],
        )

        self.assertEqual(
            shortcut.CLUS_ID_id,
            self.culinary.CLUS_ID,
        )
        self.assertEqual(
            shortcut.CDS_TITLE,
            "Find something to eat",
        )
        self.assertTrue(shortcut.CDS_IS_ACTIVE)

    def test_admin_can_list_discovery_shortcuts_with_business_count(self):
        shortcut = self._create_shortcut()

        self._create_business(
            cluster=self.culinary,
            index=1,
        )
        self._create_business(
            cluster=self.culinary,
            index=2,
        )
        self._create_business(
            cluster=self.culinary,
            index=3,
            status=Business.BusinessStatus.SUSPENDED,
        )

        self.client.force_authenticate(self.admin)

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        items = response.data["data"]["items"]

        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["id"],
            shortcut.CDS_ID,
        )
        self.assertEqual(
            items[0]["business_count"],
            2,
        )
        self.assertEqual(
            items[0]["cluster"]["id"],
            self.culinary.CLUS_ID,
        )

    def test_admin_can_search_discovery_shortcuts(self):
        self._create_shortcut(
            cluster=self.culinary,
            title="Find something to eat",
            subtitle="Discover local food",
        )
        self._create_shortcut(
            cluster=self.creative,
            title="Discover local crafts",
            subtitle="Browse handmade goods",
        )

        self.client.force_authenticate(self.admin)

        response = self.client.get(
            self.list_url,
            {
                "search": "crafts",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        items = response.data["data"]["items"]

        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["title"],
            "Discover local crafts",
        )

    def test_admin_can_order_discovery_shortcuts_by_business_count(self):
        culinary_shortcut = self._create_shortcut(
            cluster=self.culinary,
            title="Culinary",
        )
        creative_shortcut = self._create_shortcut(
            cluster=self.creative,
            title="Creative",
        )

        self._create_business(
            cluster=self.culinary,
            index=1,
        )
        self._create_business(
            cluster=self.culinary,
            index=2,
        )
        self._create_business(
            cluster=self.creative,
            index=1,
        )

        self.client.force_authenticate(self.admin)

        response = self.client.get(
            self.list_url,
            {
                "ordering": "-business_count",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        items = response.data["data"]["items"]

        self.assertEqual(
            [item["id"] for item in items],
            [
                culinary_shortcut.CDS_ID,
                creative_shortcut.CDS_ID,
            ],
        )
        self.assertEqual(
            [item["business_count"] for item in items],
            [2, 1],
        )

    def test_admin_can_patch_discovery_shortcut(self):
        shortcut = self._create_shortcut()

        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f"{self.list_url}{shortcut.CDS_ID}/",
            {
                "title": "Find local food",
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["message"],
            "Discovery Shortcut updated successfully.",
        )

        shortcut.refresh_from_db()

        self.assertEqual(
            shortcut.CDS_TITLE,
            "Find local food",
        )
        self.assertFalse(shortcut.CDS_IS_ACTIVE)

        # PATCH must preserve unspecified fields.
        self.assertEqual(
            shortcut.CDS_SUBTITLE,
            "Discover local food",
        )
        self.assertEqual(
            shortcut.CLUS_ID_id,
            self.culinary.CLUS_ID,
        )

    def test_admin_can_put_discovery_shortcut(self):
        shortcut = self._create_shortcut()

        self.client.force_authenticate(self.admin)

        response = self.client.put(
            f"{self.list_url}{shortcut.CDS_ID}/",
            {
                "cluster_id": self.culinary.CLUS_ID,
                "title": "Taste Cebu",
                "subtitle": "Explore Cebuano food and cafés",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        shortcut.refresh_from_db()

        self.assertEqual(
            shortcut.CDS_TITLE,
            "Taste Cebu",
        )
        self.assertEqual(
            shortcut.CDS_SUBTITLE,
            "Explore Cebuano food and cafés",
        )
        self.assertTrue(shortcut.CDS_IS_ACTIVE)

    def test_admin_can_delete_shortcut_without_deleting_cluster(self):
        shortcut = self._create_shortcut()
        cluster_id = self.culinary.CLUS_ID

        self.client.force_authenticate(self.admin)

        response = self.client.delete(
            f"{self.list_url}{shortcut.CDS_ID}/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["message"],
            "Discovery Shortcut deleted successfully.",
        )

        self.assertFalse(
            ClusterDiscoveryShortcut.objects.filter(
                CDS_ID=shortcut.CDS_ID,
            ).exists()
        )
        self.assertTrue(
            Cluster.objects.filter(
                CLUS_ID=cluster_id,
            ).exists()
        )

    def test_missing_shortcut_returns_not_found(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            f"{self.list_url}999999/",
            {
                "title": "Missing shortcut",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_super_admin_can_access_discovery_shortcuts(self):
        self.client.force_authenticate(self.super_admin)

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_explorer_cannot_access_admin_discovery_shortcuts(self):
        self.client.force_authenticate(self.explorer)

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_unauthenticated_user_cannot_access_admin_discovery_shortcuts(
        self,
    ):
        response = self.client.get(self.list_url)

        self.assertIn(
            response.status_code,
            (
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ),
        )