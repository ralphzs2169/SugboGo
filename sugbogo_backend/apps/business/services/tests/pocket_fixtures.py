from decimal import Decimal

from django.contrib.gis.geos import Point

from apps.business.models import Business, Category, Cluster, Location, PocketCollection
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.users.models import User


class PocketFixtures:
    """Shares a small real database fixture between Pocket services and API tests."""

    @classmethod
    def setUpTestData(cls):
        """Creates two save owners, a merchant, two businesses, and empty collections."""
        cls.user = cls.make_user("pocket-explorer")
        cls.other = cls.make_user("pocket-other")
        cls.owner = cls.make_user("pocket-merchant", User.UserRole.MERCHANT)
        cls.favorites = PocketCollection.objects.get(USER_ID=cls.user, PCOL_IS_DEFAULT=True)
        cls.custom = PocketCollectionService.create_collection(cls.user, "Cafes")
        cls.second = PocketCollectionService.create_collection(cls.user, "Weekend")
        cls.foreign = PocketCollection.objects.get(USER_ID=cls.other, PCOL_IS_DEFAULT=True)
        cluster = Cluster.objects.create(CLUS_NAME="Pocket food")
        cls.category = Category.objects.create(CTGRY_NAME="Pocket cafe", CLUS_ID=cluster)
        cls.location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Pocket street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.business = Business.objects.create(
            BUSN_NAME="Pocket Cafe",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=cls.owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )
        cls.business_two = Business.objects.create(
            BUSN_NAME="Pocket Bakery",
            BUSN_CONTACT_NUMBER="09171234568",
            USER_ID=cls.other,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )

    @classmethod
    def make_user(cls, name, role=User.UserRole.EXPLORER):
        """Creates an eligible account without depending on discovery configuration."""
        return User.objects.create_user(
            email=f"{name}@example.com",
            password=None,
            USER_FNAME="Pocket",
            USER_LNAME=name,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=Decimal("0.20000"),
        )
