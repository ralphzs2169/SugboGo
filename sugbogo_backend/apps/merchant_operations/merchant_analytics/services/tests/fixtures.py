from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.contrib.gis.geos import Point

from apps.business.models import Business, BusinessSpecialtyTag, Category, Cluster, Location, SpecialtyTag
from apps.business.services.tests.test_visibility_analytics_service import ReadOnlyCollection
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.reviews.models import Review, ReviewReply
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class MerchantAnalyticsFixtures:
    """Provide two distinct owned businesses and a strictly read-only visibility store."""

    NOW = datetime(2026, 10, 13, 4, 30, tzinfo=UTC)

    @classmethod
    def setUpTestData(cls):
        """Create scoped domain roots with deterministic specialty timestamps."""
        cls.period = resolve_period(now=cls.NOW)
        cls.merchant_a = cls.user("merchant-a", User.UserRole.MERCHANT)
        cls.merchant_b = cls.user("merchant-b", User.UserRole.MERCHANT)
        cls.supporter_a = cls.user("supporter-a")
        cls.supporter_b = cls.user("supporter-b")
        cluster = Cluster.objects.create(CLUS_NAME="Merchant analytics cluster")
        category = Category.objects.create(CTGRY_NAME="Merchant analytics category", CLUS_ID=cluster)
        location = Location.objects.create(LOCT_POINT=Point(123.88, 10.31, srid=4326), LOCT_ADDRESS="Cebu City")
        cls.business_a = Business.objects.create(
            BUSN_NAME="Merchant A", BUSN_CONTACT_NUMBER="09170000000", USER_ID=cls.merchant_a,
            CTGRY_ID=category, LOCT_ID=location, BUSN_POCKET_COUNT=999, BUSN_VOUCH_COUNT=999,
        )
        cls.business_b = Business.objects.create(
            BUSN_NAME="Merchant B", BUSN_CONTACT_NUMBER="09170000001", USER_ID=cls.merchant_b,
            CTGRY_ID=category, LOCT_ID=location,
        )
        cls.tags = [SpecialtyTag.objects.create(TAG_NAME=f"Analytics specialty {index}") for index in range(3)]
        for index, tag in enumerate(cls.tags):
            link = BusinessSpecialtyTag.objects.create(
                BUSN_ID=cls.business_a, TAG_ID=tag, BST_IS_ACTIVE=index < 2, BST_VOUCH_COUNT=999,
            )
            BusinessSpecialtyTag.objects.filter(pk=link.pk).update(BST_CREATED_AT=cls.NOW - timedelta(days=10))

    @staticmethod
    def user(name, role=User.UserRole.EXPLORER):
        """Create an active fixture actor without a login password."""
        return User.objects.create_user(
            email=f"merchant-analytics-{name}@example.com", password=None,
            USER_ROLE=role, USER_STATUS=User.UserStatus.ACTIVE, USER_FNAME="Analytics", USER_LNAME=name,
        )

    def setUp(self):
        """Patch only Mongo collection access and prohibit analytics index creation."""
        super().setUp()
        original = VisibilityEventService._unavailable_until
        VisibilityEventService._unavailable_until = 0
        self.addCleanup(setattr, VisibilityEventService, "_unavailable_until", original)
        self.documents = []
        self.collection = ReadOnlyCollection(self.documents)
        collection = patch.object(VisibilityEventService, "_get_collection", return_value=self.collection)
        collection.start()
        self.addCleanup(collection.stop)
        indexes = patch.object(VisibilityEventService, "ensure_indexes", side_effect=AssertionError("Index write attempted"))
        indexes.start()
        self.addCleanup(indexes.stop)

    def event(self, kind, explorer, timestamp, business=None):
        """Append an observation without SQL identity lookup or tracking writes."""
        self.documents.append({
            "event_type": kind, "explorer_id": explorer,
            "business_id": (business or self.business_a).pk, "occurred_at": timestamp,
        })

    def review(self, created_at, status=Review.ReviewStatus.PUBLISHED, business=None):
        """Create uniquely authored reviews with controlled creation timestamps."""
        author = self.user(f"review-author-{Review.objects.count()}")
        review = Review.objects.create(
            BUSN_ID=business or self.business_a, USER_ID=author, REVW_TEXT="Fixture review", REVW_STATUS=status,
        )
        Review.objects.filter(pk=review.pk).update(REVW_CREATED_AT=created_at)
        review.refresh_from_db()
        return review

    def reply(self, review, created_at):
        """Create a retained owner-reply record with a controlled original timestamp."""
        reply = ReviewReply.objects.create(REVW_ID=review, RPLY_TEXT="Fixture reply")
        ReviewReply.objects.filter(pk=reply.pk).update(RPLY_CREATED_AT=created_at)
        return reply
