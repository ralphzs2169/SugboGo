from apps.business.models import Business, BusinessPhoto, Category, Cluster, Location
from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.explorer_operations.explore_businesses.services.discovery_feed_service import (
    DiscoveryFeedService,
)
from apps.explorer_operations.explore_businesses.serializers.explore_business_serializer import (
    ExploreBusinessSerializer,
)
from apps.users.models import User
from django.contrib.gis.geos import Point
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext


class DisplayCoverPhotoTests(TestCase):
    def setUp(self):
        self.explorer = User.objects.create_user(
            email="cover-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Cover",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        self.category = Category.objects.create(
            CTGRY_NAME="Cafe",
            CLUS_ID=cluster,
        )
        self.location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Main Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        self.business = self._business(1)

    def _business(self, number):
        owner = User.objects.create_user(
            email=f"cover-merchant-{number}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Cover",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        return Business.objects.create(
            BUSN_NAME=f"Cafe {number}",
            BUSN_DESCRIPTION="A local Cebu cafe.",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )

    def _photo(self, business, category, url):
        return BusinessPhoto.objects.create(
            BUSN_ID=business,
            BPHO_CATEGORY=category,
            BPHO_PHOTO_URL=url,
            BPHO_PHOTO_PUBLIC_ID=f"cover-test-{BusinessPhoto.objects.count()}",
        )

    def _display_url(self):
        return (
            Business.objects
            .annotate(display_cover_photo_url=display_cover_photo_expression())
            .get(pk=self.business.pk)
            .display_cover_photo_url
        )

    def test_dedicated_cover_precedes_ordered_storefront(self):
        self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.STOREFRONT,
            "https://example.com/first.jpg",
        )
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/cover.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])

        self.assertEqual(self._display_url(), "https://example.com/cover.jpg")
        self.business.refresh_from_db()
        self.assertEqual(
            self.business.BUSN_COVER_PHOTO_URL,
            "https://example.com/cover.jpg",
        )
        self.assertEqual(self.business.photos.count(), 1)

    def test_first_usable_storefront_is_selected_and_deletion_advances_it(self):
        self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.INTERIOR,
            "https://example.com/interior.jpg",
        )
        self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.PRODUCTS,
            "https://example.com/product.jpg",
        )
        self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.STOREFRONT,
            "",
        )
        first = self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.STOREFRONT,
            "https://example.com/first.jpg",
        )
        self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.STOREFRONT,
            "https://example.com/second.jpg",
        )

        self.assertEqual(self._display_url(), "https://example.com/first.jpg")
        first.delete()
        self.assertEqual(self._display_url(), "https://example.com/second.jpg")
        self.business.refresh_from_db()
        self.assertIsNone(self.business.BUSN_COVER_PHOTO_URL)

    def test_missing_dedicated_cover_and_storefront_returns_none(self):
        self._photo(
            self.business,
            BusinessPhoto.PhotoCategory.INTERIOR,
            "https://example.com/interior.jpg",
        )
        self.assertIsNone(self._display_url())

    def test_explorer_list_resolves_multiple_businesses_without_photo_queries(self):
        for number in range(2, 5):
            business = self._business(number)
            self._photo(
                business,
                BusinessPhoto.PhotoCategory.STOREFRONT,
                f"https://example.com/storefront-{number}.jpg",
            )

        queryset = DiscoveryFeedService.list_discovery_businesses(self.explorer)
        with CaptureQueriesContext(connection) as queries:
            businesses = list(queryset)
            serialized = ExploreBusinessSerializer(businesses, many=True).data
            urls = [business["display_cover_photo_url"] for business in serialized]

        self.assertEqual(len(businesses), 4)
        self.assertEqual(len(queries), 2)
        self.assertIn("https://example.com/storefront-2.jpg", urls)
