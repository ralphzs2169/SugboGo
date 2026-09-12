from apps.admin_operations.taxonomy_management.services.cluster_discovery_shortcut_service import (
    ClusterDiscoveryShortcutAdminService,
)
from apps.business.models import (
    Business,
    Category,
    Cluster,
    ClusterDiscoveryShortcut,
    Location,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import NotFound


class ClusterDiscoveryShortcutAdminServiceTests(TestCase):
    """Tests Discovery Shortcut retrieval, business counts, and CRUD behavior."""

    def setUp(self):
        self.culinary = Cluster.objects.create(
            CLUS_NAME="Culinary",
            CLUS_DESCRIPTION="Food and dining businesses.",
        )

        self.creative = Cluster.objects.create(
            CLUS_NAME="Creative",
            CLUS_DESCRIPTION="Creative and handmade businesses.",
        )

        self.leisure = Cluster.objects.create(
            CLUS_NAME="Leisure",
            CLUS_DESCRIPTION="Leisure and recreation businesses.",
        )

        self.culinary_category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CTGRY_DESCRIPTION="Coffee shops and cafes.",
            CLUS_ID=self.culinary,
        )

        self.culinary_secondary_category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining places.",
            CLUS_ID=self.culinary,
        )

        self.creative_category = Category.objects.create(
            CTGRY_NAME="Handicrafts",
            CTGRY_DESCRIPTION="Local arts and handmade products.",
            CLUS_ID=self.creative,
        )

        self.leisure_category = Category.objects.create(
            CTGRY_NAME="Recreation",
            CTGRY_DESCRIPTION="Leisure and recreation experiences.",
            CLUS_ID=self.leisure,
        )

        self.location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Cebu City",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )

        self.culinary_shortcut = ClusterDiscoveryShortcut.objects.create(
            CLUS_ID=self.culinary,
            CDS_TITLE="Find something to eat",
            CDS_SUBTITLE="Discover local food, cafés, and treats",
            CDS_IS_ACTIVE=True,
        )

        self.creative_shortcut = ClusterDiscoveryShortcut.objects.create(
            CLUS_ID=self.creative,
            CDS_TITLE="Discover local crafts",
            CDS_SUBTITLE="Browse handmade goods and creative finds",
            CDS_IS_ACTIVE=True,
        )

    def create_business(
        self,
        *,
        category,
        name,
        status=Business.BusinessStatus.ACTIVE,
    ):
        business_number = Business.objects.count() + 1

        merchant = User.objects.create_user(
            email=f"shortcut-merchant-{business_number}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Test",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status,
            USER_ID=merchant,
            CTGRY_ID=category,
            LOCT_ID=self.location,
        )

    def test_list_shortcuts_uses_cluster_name_as_default_ordering(self):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts()
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [
                self.creative_shortcut.CDS_ID,
                self.culinary_shortcut.CDS_ID,
            ],
        )

    def test_list_shortcuts_includes_inactive_shortcuts_for_admin_management(
        self,
    ):
        inactive_shortcut = ClusterDiscoveryShortcut.objects.create(
            CLUS_ID=self.leisure,
            CDS_TITLE="Find somewhere to unwind",
            CDS_SUBTITLE="Explore relaxing and leisure experiences",
            CDS_IS_ACTIVE=False,
        )

        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts()
        )

        self.assertIn(
            inactive_shortcut.CDS_ID,
            [shortcut.CDS_ID for shortcut in shortcuts],
        )

    def test_list_shortcuts_counts_active_businesses_across_cluster_categories(
        self,
    ):
        self.create_business(
            category=self.culinary_category,
            name="Local Coffee Shop",
        )

        self.create_business(
            category=self.culinary_secondary_category,
            name="Cebu Restaurant",
        )

        shortcut = (
            ClusterDiscoveryShortcutAdminService
            .list_shortcuts()
            .get(
                CDS_ID=self.culinary_shortcut.CDS_ID,
            )
        )

        self.assertEqual(
            shortcut.business_count,
            2,
        )

    def test_list_shortcuts_does_not_count_suspended_businesses(self):
        self.create_business(
            category=self.culinary_category,
            name="Active Cafe",
        )

        self.create_business(
            category=self.culinary_category,
            name="Suspended Cafe",
            status=Business.BusinessStatus.SUSPENDED,
        )

        shortcut = (
            ClusterDiscoveryShortcutAdminService
            .list_shortcuts()
            .get(
                CDS_ID=self.culinary_shortcut.CDS_ID,
            )
        )

        self.assertEqual(
            shortcut.business_count,
            1,
        )

    def test_list_shortcuts_counts_active_business_even_when_not_verified(
        self,
    ):
        business = self.create_business(
            category=self.culinary_category,
            name="Unverified Active Cafe",
        )

        self.assertFalse(
            business.BUSN_IS_VERIFIED,
        )

        shortcut = (
            ClusterDiscoveryShortcutAdminService
            .list_shortcuts()
            .get(
                CDS_ID=self.culinary_shortcut.CDS_ID,
            )
        )

        self.assertEqual(
            shortcut.business_count,
            1,
        )

    def test_list_shortcuts_can_search_by_title(self):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                search="crafts",
            )
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [self.creative_shortcut.CDS_ID],
        )

    def test_list_shortcuts_can_search_by_subtitle(self):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                search="cafés",
            )
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [self.culinary_shortcut.CDS_ID],
        )

    def test_list_shortcuts_can_search_by_cluster_name(self):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                search="Creative",
            )
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [self.creative_shortcut.CDS_ID],
        )

    def test_list_shortcuts_search_is_case_insensitive(self):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                search="CULINARY",
            )
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [self.culinary_shortcut.CDS_ID],
        )

    def test_list_shortcuts_supports_title_ordering(self):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                ordering="title",
            )
        )

        self.assertEqual(
            [shortcut.CDS_TITLE for shortcut in shortcuts],
            [
                "Discover local crafts",
                "Find something to eat",
            ],
        )

    def test_list_shortcuts_supports_business_count_ordering(self):
        self.create_business(
            category=self.culinary_category,
            name="Culinary One",
        )

        self.create_business(
            category=self.culinary_secondary_category,
            name="Culinary Two",
        )

        self.create_business(
            category=self.culinary_category,
            name="Culinary Three",
        )

        self.create_business(
            category=self.creative_category,
            name="Creative One",
        )

        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                ordering="-business_count",
            )
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [
                self.culinary_shortcut.CDS_ID,
                self.creative_shortcut.CDS_ID,
            ],
        )

        self.assertEqual(
            [shortcut.business_count for shortcut in shortcuts],
            [3, 1],
        )

    def test_list_shortcuts_falls_back_to_cluster_name_for_unknown_ordering(
        self,
    ):
        shortcuts = list(
            ClusterDiscoveryShortcutAdminService.list_shortcuts(
                ordering="unsupported",
            )
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [
                self.creative_shortcut.CDS_ID,
                self.culinary_shortcut.CDS_ID,
            ],
        )

    def test_get_shortcut_returns_requested_shortcut(self):
        shortcut = ClusterDiscoveryShortcutAdminService.get_shortcut(
            self.culinary_shortcut.CDS_ID,
        )

        self.assertEqual(
            shortcut.CDS_ID,
            self.culinary_shortcut.CDS_ID,
        )

        self.assertEqual(
            shortcut.CLUS_ID.CLUS_ID,
            self.culinary.CLUS_ID,
        )

    def test_get_shortcut_raises_controlled_not_found_when_missing(self):
        with self.assertRaisesMessage(
            NotFound,
            "Discovery Shortcut not found.",
        ):
            ClusterDiscoveryShortcutAdminService.get_shortcut(
                999999,
            )

    def test_create_shortcut_creates_shortcut(self):
        shortcut = ClusterDiscoveryShortcutAdminService.create_shortcut(
            {
                "CLUS_ID": self.leisure,
                "CDS_TITLE": "Find somewhere to unwind",
                "CDS_SUBTITLE": (
                    "Explore relaxing and leisure experiences"
                ),
                "CDS_IS_ACTIVE": True,
            }
        )

        self.assertIsNotNone(
            shortcut.CDS_ID,
        )

        self.assertTrue(
            ClusterDiscoveryShortcut.objects.filter(
                CDS_ID=shortcut.CDS_ID,
                CLUS_ID=self.leisure,
            ).exists()
        )

    def test_update_shortcut_updates_provided_fields(self):
        shortcut = ClusterDiscoveryShortcutAdminService.update_shortcut(
            self.culinary_shortcut,
            {
                "CDS_TITLE": "Taste something local",
                "CDS_SUBTITLE": (
                    "Discover Cebuano favorites and neighborhood cafés"
                ),
                "CDS_IS_ACTIVE": False,
            },
        )

        shortcut.refresh_from_db()

        self.assertEqual(
            shortcut.CDS_TITLE,
            "Taste something local",
        )

        self.assertEqual(
            shortcut.CDS_SUBTITLE,
            "Discover Cebuano favorites and neighborhood cafés",
        )

        self.assertFalse(
            shortcut.CDS_IS_ACTIVE,
        )

    def test_update_shortcut_preserves_unspecified_fields(self):
        original_subtitle = self.culinary_shortcut.CDS_SUBTITLE
        original_cluster_id = self.culinary_shortcut.CLUS_ID_id

        ClusterDiscoveryShortcutAdminService.update_shortcut(
            self.culinary_shortcut,
            {
                "CDS_TITLE": "Taste something local",
            },
        )

        self.culinary_shortcut.refresh_from_db()

        self.assertEqual(
            self.culinary_shortcut.CDS_TITLE,
            "Taste something local",
        )

        self.assertEqual(
            self.culinary_shortcut.CDS_SUBTITLE,
            original_subtitle,
        )

        self.assertEqual(
            self.culinary_shortcut.CLUS_ID_id,
            original_cluster_id,
        )

    def test_delete_shortcut_removes_shortcut(self):
        shortcut_id = self.culinary_shortcut.CDS_ID

        ClusterDiscoveryShortcutAdminService.delete_shortcut(
            self.culinary_shortcut,
        )

        self.assertFalse(
            ClusterDiscoveryShortcut.objects.filter(
                CDS_ID=shortcut_id,
            ).exists()
        )

    def test_delete_shortcut_preserves_linked_cluster(self):
        cluster_id = self.culinary.CLUS_ID

        ClusterDiscoveryShortcutAdminService.delete_shortcut(
            self.culinary_shortcut,
        )

        self.assertTrue(
            Cluster.objects.filter(
                CLUS_ID=cluster_id,
            ).exists()
        )