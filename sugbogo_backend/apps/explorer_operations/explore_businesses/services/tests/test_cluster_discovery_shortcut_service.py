from apps.business.models import (
    Business,
    Category,
    Cluster,
    ClusterDiscoveryShortcut,
    Location,
)
from apps.explorer_operations.explore_businesses.services.cluster_discovery_shortcut_service import (
    ClusterDiscoveryShortcutService,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.test import TestCase


class ClusterDiscoveryShortcutServiceTests(TestCase):
    """Tests Explorer-facing Discovery Shortcut eligibility and ranking."""

    def setUp(self):
        self.culinary = Cluster.objects.create(
            CLUS_NAME="Culinary",
        )

        self.creative = Cluster.objects.create(
            CLUS_NAME="Creative",
        )

        self.leisure = Cluster.objects.create(
            CLUS_NAME="Leisure",
        )

        self.culinary_category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CLUS_ID=self.culinary,
        )

        self.culinary_secondary_category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=self.culinary,
        )

        self.creative_category = Category.objects.create(
            CTGRY_NAME="Handicrafts",
            CLUS_ID=self.creative,
        )

        self.leisure_category = Category.objects.create(
            CTGRY_NAME="Recreation",
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

        self.leisure_shortcut = ClusterDiscoveryShortcut.objects.create(
            CLUS_ID=self.leisure,
            CDS_TITLE="Find somewhere to unwind",
            CDS_SUBTITLE="Explore relaxing and leisure experiences",
            CDS_IS_ACTIVE=True,
        )

    def create_business(
        self,
        *,
        category,
        name,
        status=Business.BusinessStatus.ACTIVE,
    ):
        number = Business.objects.count() + 1

        merchant = User.objects.create_user(
            email=f"discovery-shortcut-{number}@example.com",
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

    def test_returns_only_active_shortcuts(self):
        self.culinary_shortcut.CDS_IS_ACTIVE = False
        self.culinary_shortcut.save(
            update_fields=["CDS_IS_ACTIVE"],
        )

        self.create_business(
            category=self.culinary_category,
            name="Hidden Culinary Business",
        )

        self.create_business(
            category=self.creative_category,
            name="Creative Business",
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [self.creative_shortcut.CDS_ID],
        )

    def test_excludes_shortcuts_with_zero_active_businesses(self):
        self.create_business(
            category=self.culinary_category,
            name="Culinary Business",
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [self.culinary_shortcut.CDS_ID],
        )

    def test_suspended_businesses_do_not_count(self):
        self.create_business(
            category=self.culinary_category,
            name="Suspended Business",
            status=Business.BusinessStatus.SUSPENDED,
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        self.assertEqual(
            shortcuts,
            [],
        )

    def test_active_unverified_businesses_still_count(self):
        business = self.create_business(
            category=self.culinary_category,
            name="Unverified Active Business",
        )

        self.assertFalse(
            business.BUSN_IS_VERIFIED,
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        self.assertEqual(
            len(shortcuts),
            1,
        )

        self.assertEqual(
            shortcuts[0].CDS_ID,
            self.culinary_shortcut.CDS_ID,
        )

        self.assertEqual(
            shortcuts[0].business_count,
            1,
        )

    def test_counts_active_businesses_across_cluster_categories(self):
        self.create_business(
            category=self.culinary_category,
            name="Cafe One",
        )

        self.create_business(
            category=self.culinary_secondary_category,
            name="Restaurant One",
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        self.assertEqual(
            len(shortcuts),
            1,
        )

        self.assertEqual(
            shortcuts[0].business_count,
            2,
        )

    def test_ranks_higher_business_count_first(self):
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
            ClusterDiscoveryShortcutService.list_active_shortcuts()
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

    def test_equal_business_counts_use_cluster_id_as_tiebreaker(self):
        self.create_business(
            category=self.culinary_category,
            name="Culinary One",
        )

        self.create_business(
            category=self.creative_category,
            name="Creative One",
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        expected = sorted(
            [
                self.culinary_shortcut,
                self.creative_shortcut,
            ],
            key=lambda shortcut: shortcut.CLUS_ID_id,
        )

        self.assertEqual(
            [shortcut.CDS_ID for shortcut in shortcuts],
            [shortcut.CDS_ID for shortcut in expected],
        )

    def test_returns_correct_business_count_per_shortcut(self):
        self.create_business(
            category=self.culinary_category,
            name="Culinary One",
        )
        self.create_business(
            category=self.culinary_secondary_category,
            name="Culinary Two",
        )

        self.create_business(
            category=self.creative_category,
            name="Creative One",
        )

        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        counts = {
            shortcut.CDS_ID: shortcut.business_count
            for shortcut in shortcuts
        }

        self.assertEqual(
            counts[self.culinary_shortcut.CDS_ID],
            2,
        )

        self.assertEqual(
            counts[self.creative_shortcut.CDS_ID],
            1,
        )

    def test_returns_empty_queryset_when_no_shortcuts_have_active_businesses(
        self,
    ):
        shortcuts = list(
            ClusterDiscoveryShortcutService.list_active_shortcuts()
        )

        self.assertEqual(
            shortcuts,
            [],
        )

    def test_shortcut_cluster_is_select_related(self):
        self.create_business(
            category=self.culinary_category,
            name="Culinary Business",
        )

        shortcut = (
            ClusterDiscoveryShortcutService
            .list_active_shortcuts()
            .first()
        )

        with self.assertNumQueries(0):
            cluster_name = shortcut.CLUS_ID.CLUS_NAME

        self.assertEqual(
            cluster_name,
            "Culinary",
        )