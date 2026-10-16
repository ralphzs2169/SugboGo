from datetime import timedelta
from decimal import Decimal

from django.contrib.gis.geos import Point
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessPhoto,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.reviews.models import Review, ReviewPhoto, ReviewReply
from apps.reviews.services.review_like_service import ReviewLikeService
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class CommunityReviewViewTests(APIResponseAssertionsMixin, APITestCase):
    """Tests the public cross-business Community review feed."""

    def setUp(self):
        self.user_index = 0
        self.business_index = 0
        self.url = "/api/reviews/community/"

        self.explorer = self._create_user(
            role=User.UserRole.EXPLORER,
            prefix="community-explorer",
        )
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses.",
        )
        self.other_cluster = Cluster.objects.create(
            CLUS_NAME="Arts & Culture",
            CLUS_DESCRIPTION="Creative businesses.",
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Restaurants and dining establishments.",
            CLUS_ID=self.cluster,
        )
        self.other_category = Category.objects.create(
            CTGRY_NAME="Galleries",
            CTGRY_DESCRIPTION="Art galleries and creative spaces.",
            CLUS_ID=self.other_cluster,
        )
        self.business = self._create_business(
            name="Sugbo Bistro",
            category=self.category,
            address="Gorordo Avenue",
        )
        self.other_business = self._create_business(
            name="Sugbo Gallery",
            category=self.other_category,
            address="Colon Street",
        )

        self.client.force_authenticate(self.explorer)

    def _create_user(self, role=User.UserRole.EXPLORER, prefix="reviewer"):
        """Create an active user with a unique Community test identity."""
        self.user_index += 1
        return User.objects.create_user(
            email=f"{prefix}-{self.user_index}@example.com",
            password="StrongPassword123!",
            USER_FNAME=f"User{self.user_index}",
            USER_LNAME="Reviewer",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def _create_business(
        self,
        *,
        name,
        category,
        address,
        status_value=Business.BusinessStatus.ACTIVE,
        cover_photo_url=None,
    ):
        """Create a business with its required owner and permanent location."""
        self.business_index += 1
        owner = self._create_user(
            role=User.UserRole.MERCHANT,
            prefix=f"owner-{self.business_index}",
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                123.88 + self.business_index / 1000,
                10.31 + self.business_index / 1000,
                srid=4326,
            ),
            LOCT_ADDRESS=address,
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_DESCRIPTION=f"Description for {name}.",
            BUSN_STATUS=status_value,
            BUSN_COVER_PHOTO_URL=cover_photo_url,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    def _create_review(self, *, business=None, author=None, **fields):
        """Create one review without invoking asynchronous review processing."""
        return Review.objects.create(
            USER_ID=author or self._create_user(),
            BUSN_ID=business or self.business,
            REVW_TEXT=fields.pop("REVW_TEXT", "A Community review."),
            **fields,
        )

    def _items(self, **params):
        """Return Community items after asserting the standard success envelope."""
        response = self.client.get(
            self.url,
            params,
        )
        self.assertSuccessResponse(
            response,
            message="Success.",
        )
        return response.data["data"]["items"]

    def test_requires_authentication_and_supported_role(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        admin = self._create_user(
            role=User.UserRole.ADMIN,
            prefix="community-admin",
        )
        self.client.force_authenticate(admin)
        response = self.client.get(self.url)
        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        for user in (self.explorer, self.business.USER_ID):
            with self.subTest(role=user.USER_ROLE):
                self.client.force_authenticate(user)
                response = self.client.get(self.url)
                self.assertSuccessResponse(
                    response,
                    message="Success.",
                )

    def test_returns_only_published_reviews(self):
        published = self._create_review()
        diagnostic = self._create_review(
            REVW_IS_REPORT_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
            REVW_IS_OUTLIER_SENTIMENT=True,
        )
        self._create_review(
            REVW_STATUS=Review.ReviewStatus.FLAGGED,
        )
        self._create_review(
            REVW_STATUS=Review.ReviewStatus.REJECTED,
        )

        self.assertEqual(
            {item["id"] for item in self._items()},
            {published.pk, diagnostic.pk},
        )

    def test_excludes_reviews_for_suspended_businesses(self):
        visible = self._create_review()
        suspended = self._create_business(
            name="Suspended Shop",
            category=self.category,
            address="Suspended Street",
            status_value=Business.BusinessStatus.SUSPENDED,
        )
        self._create_review(
            business=suspended,
        )

        self.assertEqual(
            [item["id"] for item in self._items()],
            [visible.pk],
        )

    def test_opted_out_reviews_are_excluded_from_every_feed_variant(self):
        visible = self._create_review()
        self.assertTrue(visible.REVW_SHOW_IN_COMMUNITY)
        hidden = self._create_review(
            REVW_SHOW_IN_COMMUNITY=False,
            REVW_LIKE_COUNT=99,
        )
        ReviewPhoto.objects.create(
            REVW_ID=hidden,
            RPHO_PHOTO_URL="https://example.com/hidden.jpg",
            RPHO_PHOTO_PUBLIC_ID="hidden",
        )
        for params in (
            {},
            {"ordering": "most_helpful"},
            {"cluster": self.cluster.pk},
            {"has_photos": "true"},
            {"cluster": self.cluster.pk, "ordering": "most_helpful",
             "has_photos": "true"},
        ):
            with self.subTest(params=params):
                ids = [item["id"] for item in self._items(**params)]
                self.assertNotIn(hidden.pk, ids)
                if params.get("has_photos"):
                    self.assertEqual(ids, [])
                else:
                    self.assertEqual(ids, [visible.pk])

    def test_opted_out_reviews_do_not_count_toward_pagination(self):
        for _ in range(10):
            self._create_review(REVW_SHOW_IN_COMMUNITY=False)
        visible = self._create_review()
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(
            [item["id"] for item in response.data["data"]["items"]],
            [visible.pk],
        )

    def test_newest_ordering_uses_review_id_as_tie_breaker(self):
        reviews = [
            self._create_review()
            for _ in range(3)
        ]
        moment = timezone.now()
        Review.objects.filter(
            pk__in=[review.pk for review in reviews],
        ).update(
            REVW_CREATED_AT=moment,
        )

        self.assertEqual(
            [item["id"] for item in self._items(ordering="newest")],
            [review.pk for review in reversed(reviews)],
        )

    def test_most_helpful_orders_by_count_date_and_review_id(self):
        oldest = self._create_review(
            REVW_LIKE_COUNT=7,
        )
        tied_first = self._create_review(
            REVW_LIKE_COUNT=7,
        )
        tied_second = self._create_review(
            REVW_LIKE_COUNT=7,
        )
        most_helpful = self._create_review(
            REVW_LIKE_COUNT=10,
        )
        moment = timezone.now()
        Review.objects.filter(pk=oldest.pk).update(
            REVW_CREATED_AT=moment - timedelta(days=1),
        )
        Review.objects.filter(
            pk__in=[tied_first.pk, tied_second.pk],
        ).update(
            REVW_CREATED_AT=moment,
        )
        Review.objects.filter(pk=most_helpful.pk).update(
            REVW_CREATED_AT=moment - timedelta(days=2),
        )

        self.assertEqual(
            [
                item["id"]
                for item in self._items(ordering="most_helpful")
            ],
            [
                most_helpful.pk,
                tied_second.pk,
                tied_first.pk,
                oldest.pk,
            ],
        )

    def test_filters_reviews_by_business_cluster(self):
        matching = self._create_review(
            business=self.business,
        )
        self._create_review(
            business=self.other_business,
        )

        self.assertEqual(
            [
                item["id"]
                for item in self._items(cluster=self.cluster.pk)
            ],
            [matching.pk],
        )

    def test_category_filter_uses_or_and_validates_cluster(self):
        """Selected categories match any business category within the cluster."""
        second_category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CLUS_ID=self.cluster,
        )
        second_business = self._create_business(
            name="Cafe",
            category=second_category,
            address="Cafe Street",
        )
        first = self._create_review()
        second = self._create_review(business=second_business)
        self._create_review(business=self.other_business)

        response = self.client.get(
            self.url,
            {
                "cluster": self.cluster.pk,
                "category": [self.category.pk, second_category.pk],
            },
        )
        self.assertEqual(
            {item["id"] for item in response.data["data"]["items"]},
            {first.pk, second.pk},
        )

        for params, field in (
            ({"cluster": 999999}, "cluster"),
            ({"category": [999999]}, "category"),
            (
                {
                    "cluster": self.cluster.pk,
                    "category": [self.other_category.pk],
                },
                "category",
            ),
            ({"specialty_tag": 999999}, "specialty_tag"),
        ):
            with self.subTest(params=params):
                self.assertValidationError(
                    self.client.get(self.url, params),
                    field,
                )

    def test_specialty_filter_matches_author_business_and_active_tag(self):
        """A review matches only its author's vouch at its own business."""
        tag = SpecialtyTag.objects.create(TAG_NAME="Local Favorite")
        other_tag = SpecialtyTag.objects.create(TAG_NAME="Other Specialty")
        for business in (self.business, self.other_business):
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=business,
                TAG_ID=tag,
            )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=other_tag,
        )
        first_author = self._create_user()
        second_author = self._create_user()
        matched = self._create_review(author=first_author)
        same_business_other_author = self._create_review(
            author=second_author,
        )
        other_business_same_author = self._create_review(
            business=self.other_business,
            author=first_author,
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=first_author,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=second_author,
            TAG_ID=other_tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.other_business,
            USER_ID=first_author,
            TAG_ID=other_tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
        )

        matching_items = self._items(specialty_tag=tag.pk)
        self.assertEqual(
            [item["id"] for item in matching_items],
            [matched.pk],
        )
        for item in matching_items:
            self.assertIn(
                tag.pk,
                {
                    specialty["id"]
                    for specialty in item["vouched_specialties"]
                },
            )
        self.assertNotIn(
            same_business_other_author.pk,
            [item["id"] for item in self._items(specialty_tag=tag.pk)],
        )
        self.assertNotIn(
            other_business_same_author.pk,
            [item["id"] for item in self._items(specialty_tag=tag.pk)],
        )

        BusinessSpecialtyTag.objects.filter(
            BUSN_ID=self.business,
            TAG_ID=tag,
        ).update(BST_IS_ACTIVE=False)
        self.assertEqual(self._items(specialty_tag=tag.pk), [])

    def test_combined_filters_sort_and_paginate_without_duplicates(self):
        """All filters apply before ordering and pagination."""
        tag = SpecialtyTag.objects.create(TAG_NAME="Heritage Food")
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=tag,
        )
        reviews = []
        for index in range(11):
            author = self._create_user()
            BusinessVouch.objects.create(
                BUSN_ID=self.business,
                USER_ID=author,
                TAG_ID=tag,
                VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
            )
            review = self._create_review(
                author=author,
                REVW_LIKE_COUNT=index,
            )
            reviews.append(review)
            ReviewPhoto.objects.create(
                REVW_ID=review,
                RPHO_PHOTO_URL=f"https://example.com/combined-{index}.jpg",
                RPHO_PHOTO_PUBLIC_ID=f"combined-{index}",
            )
        self._create_review(author=self._create_user())

        filters = {
            "cluster": self.cluster.pk,
            "category": [self.category.pk],
            "specialty_tag": tag.pk,
            "has_photos": "true",
            "ordering": "most_helpful",
        }
        first_page = self.client.get(self.url, filters)
        second_page = self.client.get(
            self.url,
            {**filters, "page": 2},
        )
        first_ids = [
            item["id"]
            for item in first_page.data["data"]["items"]
        ]
        second_ids = [
            item["id"]
            for item in second_page.data["data"]["items"]
        ]
        self.assertEqual(
            first_ids + second_ids,
            [review.pk for review in reversed(reviews)],
        )
        self.assertEqual(
            first_page.data["data"]["pagination"]["total_items"],
            11,
        )
        self.assertEqual(
            len(set(first_ids + second_ids)),
            11,
        )
        for item in (
            first_page.data["data"]["items"]
            + second_page.data["data"]["items"]
        ):
            self.assertIn(
                tag.pk,
                {
                    specialty["id"]
                    for specialty in item["vouched_specialties"]
                },
            )

    def test_filters_reviews_with_photos_without_duplicates(self):
        with_photos = self._create_review()
        self._create_review()
        for index in range(2):
            ReviewPhoto.objects.create(
                REVW_ID=with_photos,
                RPHO_PHOTO_URL=f"https://example.com/review-{index}.jpg",
                RPHO_PHOTO_PUBLIC_ID=f"review-{index}",
            )

        self.assertEqual(
            [item["id"] for item in self._items(has_photos="true")],
            [with_photos.pk],
        )

    def test_uses_standard_pagination_after_ordering(self):
        reviews = [
            self._create_review()
            for _ in range(11)
        ]

        first_page = self.client.get(self.url)
        second_page = self.client.get(
            self.url,
            {"page": 2},
        )

        self.assertEqual(
            len(first_page.data["data"]["items"]),
            10,
        )
        self.assertEqual(
            len(second_page.data["data"]["items"]),
            1,
        )
        self.assertEqual(
            first_page.data["data"]["pagination"]["total_items"],
            11,
        )
        self.assertEqual(
            second_page.data["data"]["items"][0]["id"],
            reviews[0].pk,
        )

    def test_rejects_invalid_query_parameters(self):
        for params, field in (
            ({"page": 0}, "page"),
            ({"ordering": "random"}, "ordering"),
            ({"cluster": 0}, "cluster"),
            ({"has_photos": "sometimes"}, "has_photos"),
        ):
            with self.subTest(params=params):
                response = self.client.get(
                    self.url,
                    params,
                )
                self.assertValidationError(
                    response,
                    field,
                )

    def test_serializes_review_business_photos_and_merchant_response(self):
        BusinessPhoto.objects.create(
            BUSN_ID=self.business,
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
            BPHO_PHOTO_URL="https://example.com/storefront.jpg",
            BPHO_PHOTO_PUBLIC_ID="storefront",
        )
        review = self._create_review(
            REVW_TEXT="Great food and warm service.",
        )
        ReviewPhoto.objects.create(
            REVW_ID=review,
            RPHO_PHOTO_URL="https://example.com/review.jpg",
            RPHO_PHOTO_PUBLIC_ID="review",
        )
        ReviewReply.objects.create(
            REVW_ID=review,
            RPLY_TEXT="Thank you for visiting!",
        )

        item = self._items()[0]

        self.assertEqual(
            item["text"],
            "Great food and warm service.",
        )
        self.assertEqual(
            item["photos"][0]["photo_url"],
            "https://example.com/review.jpg",
        )
        self.assertEqual(
            item["reply"]["text"],
            "Thank you for visiting!",
        )
        self.assertEqual(
            item["business"],
            {
                "id": self.business.pk,
                "business_name": "Sugbo Bistro",
                "display_cover_photo_url": (
                    "https://example.com/storefront.jpg"
                ),
                "category": {
                    "id": self.category.pk,
                    "name": "Restaurants",
                },
                "cluster_icon": "utensils",
                "barangay": None,
                "address": "Gorordo Avenue",
            },
        )

    def test_attaches_specialty_vouches_by_business_and_reviewer(self):
        author = self._create_user(
            prefix="cross-business-reviewer",
        )
        food_tag = SpecialtyTag.objects.create(
            TAG_NAME="Local Flavors",
            TAG_COLOR=SpecialtyTag.TagColor.GREEN,
            TAG_ICON=SpecialtyTag.TagIcon.UTENSILS,
        )
        art_tag = SpecialtyTag.objects.create(
            TAG_NAME="Local Art",
            TAG_COLOR=SpecialtyTag.TagColor.PURPLE,
            TAG_ICON=SpecialtyTag.TagIcon.PALETTE,
        )
        food_review = self._create_review(
            business=self.business,
            author=author,
        )
        art_review = self._create_review(
            business=self.other_business,
            author=author,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=food_tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.other_business,
            TAG_ID=art_tag,
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=author,
            TAG_ID=food_tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.other_business,
            USER_ID=author,
            TAG_ID=art_tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
        )

        items_by_id = {
            item["id"]: item
            for item in self._items()
        }

        self.assertEqual(
            [
                tag["name"]
                for tag in items_by_id[food_review.pk]["vouched_specialties"]
            ],
            ["Local Flavors"],
        )
        self.assertEqual(
            [
                tag["name"]
                for tag in items_by_id[art_review.pk]["vouched_specialties"]
            ],
            ["Local Art"],
        )

    def test_inactive_business_specialty_is_not_shown_as_review_vouch(self):
        author = self._create_user(
            prefix="inactive-specialty-reviewer",
        )
        review = self._create_review(
            author=author,
        )
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Former Specialty",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=tag,
            BST_IS_ACTIVE=False,
        )
        BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=author,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50"),
        )

        items_by_id = {
            item["id"]: item
            for item in self._items()
        }

        self.assertEqual(
            items_by_id[review.pk]["vouched_specialties"],
            [],
        )
        self.assertTrue(
            BusinessVouch.objects.filter(
                BUSN_ID=self.business,
                USER_ID=author,
                TAG_ID=tag,
            ).exists(),
        )

    def test_serializes_helpful_and_ownership_state_for_current_user(self):
        other_review = self._create_review()
        own_review = self._create_review(
            business=self.other_business,
            author=self.explorer,
        )
        ReviewLikeService.create_like(
            user=self.explorer,
            review_id=other_review.pk,
        )
        items_by_id = {
            item["id"]: item
            for item in self._items()
        }

        self.assertEqual(
            items_by_id[other_review.pk]["like_count"],
            1,
        )
        self.assertTrue(items_by_id[other_review.pk]["is_liked"])
        self.assertFalse(items_by_id[other_review.pk]["is_liked_by_owner"])
        self.assertFalse(items_by_id[other_review.pk]["is_own_review"])
        self.assertTrue(items_by_id[own_review.pk]["is_own_review"])

    def test_excludes_private_moderation_and_diagnostic_fields(self):
        self._create_review(
            REVW_REPORT_COUNT=4,
            REVW_IS_REPORT_FLAGGED=True,
            REVW_IS_DEVICE_ABUSE_FLAGGED=True,
            REVW_IS_OUTLIER_SENTIMENT=True,
            REVW_SENTIMENT_SCORE=-0.9,
            REVW_SENTIMENT_LABEL="negative",
            REVW_MODERATION_NOTES="Internal moderation note.",
        )

        item = self._items()[0]

        for field in (
            "status",
            "report_count",
            "is_report_flagged",
            "is_device_abuse_flagged",
            "is_outlier_sentiment",
            "sentiment_score",
            "sentiment_label",
            "moderation_notes",
            "active_dispute_id",
        ):
            self.assertNotIn(field, item)
