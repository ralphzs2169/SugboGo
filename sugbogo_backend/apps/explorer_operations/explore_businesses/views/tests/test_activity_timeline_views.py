from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessPhoto,
    BusinessSpecialtyTag,
    BusinessVouch,
    PocketCollection,
    PocketMembership,
    SpecialtyTag,
)
from apps.reviews.models import Review
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class ActivityTimelineViewTests(
    SummaryFixtureMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Verifies privacy, eligibility, and database pagination across activity types."""

    @classmethod
    def setUpTestData(cls):
        cls.business = cls.create_business()
        cls.other_business = cls.create_business(1)
        cls.user = cls.create_user("timeline")
        cls.other_user = cls.create_user("timeline-other")
        cls.tag = SpecialtyTag.objects.create(
            TAG_NAME="Timeline Coffee",
            TAG_ICON="coffee",
            TAG_COLOR="orange",
        )
        cls.assignment = BusinessSpecialtyTag.objects.create(
            BUSN_ID=cls.business,
            TAG_ID=cls.tag,
        )

    @staticmethod
    def create_user(name):
        """Creates an active Explorer account for private timeline requests."""
        return User.objects.create_user(
            email=f"{name}@example.com",
            password=None,
            USER_FNAME="Timeline",
            USER_LNAME=name,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    def setUp(self):
        """Authenticates the default timeline owner."""
        self.url = reverse("activity-timeline")
        self.client.force_authenticate(self.user)

    def make_activity(
        self,
        user=None,
        business=None,
    ):
        """Creates one retained action of each supported type without write side effects."""
        owner = user or self.user
        target = business or self.business
        saved = BusinessPocket.objects.create(
            USER_ID=owner,
            BUSN_ID=target,
        )
        vouch = BusinessVouch.objects.create(
            USER_ID=owner,
            BUSN_ID=target,
            TAG_ID=self.tag,
            VOUCH_REPUTATION_SNAPSHOT="0.50000",
        )
        review = Review.objects.create(
            USER_ID=owner,
            BUSN_ID=target,
            REVW_TEXT="A memorable experience. " * 20,
        )
        return saved, vouch, review

    def test_requires_authentication_and_accepts_bearer_jwt(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertAuthenticationError(response, code="NOT_AUTHENTICATED")
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.user)}",
        )
        self.assertSuccessResponse(self.client.get(self.url), message="Success.")

    def test_role_and_account_status_permissions(self):
        self.user.USER_ROLE = User.UserRole.MERCHANT
        self.assertEqual(self.client.get(self.url).status_code, 200)
        for role, account_status in (
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.SUSPENDED),
            (User.UserRole.EXPLORER, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, account_status=account_status):
                self.user.USER_ROLE = role
                self.user.USER_STATUS = account_status
                self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_only_requesting_users_activity_is_returned(self):
        saved, vouch, review = self.make_activity()
        self.make_activity(user=self.other_user)
        response = self.client.get(self.url, {"user_id": self.other_user.pk})
        data = response.data["data"]
        self.assertEqual(data["pagination"]["total_items"], 3)
        self.assertEqual(
            {item["id"] for item in data["items"]},
            {f"save:{saved.pk}", f"vouch:{vouch.pk}", f"review:{review.pk}"},
        )
        self.client.force_authenticate(self.other_user)
        other_response = self.client.get(self.url)
        self.assertTrue(
            {item["id"] for item in data["items"]}.isdisjoint(
                item["id"] for item in other_response.data["data"]["items"]
            ),
        )

    def test_filters_and_invalid_filter(self):
        self.make_activity()
        for selected, expected in (
            ("saves", "save"),
            ("vouches", "vouch"),
            ("reviews", "review"),
        ):
            with self.subTest(selected=selected):
                response = self.client.get(self.url, {"activity_type": selected})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
                self.assertEqual(response.data["data"]["items"][0]["type"], expected)
        self.assertEqual(
            self.client.get(self.url, {"activity_type": "likes"}).status_code,
            400,
        )

    def test_global_order_is_applied_before_pagination(self):
        saved, vouch, review = self.make_activity()
        now = timezone.now()
        BusinessPocket.objects.filter(pk=saved.pk).update(PCKT_CREATED_AT=now)
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_CREATED_AT=now - timedelta(hours=1),
        )
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=now - timedelta(hours=2),
        )
        ids = []
        for page in (1, 2, 3):
            response = self.client.get(self.url, {"page_size": 1, "page": page})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 3)
            ids.extend(item["id"] for item in response.data["data"]["items"])
        self.assertEqual(ids, [f"save:{saved.pk}", f"vouch:{vouch.pk}", f"review:{review.pk}"])

    def test_equal_timestamps_use_type_then_descending_source_id(self):
        saved, vouch, review = self.make_activity()
        second_save = BusinessPocket.objects.create(
            USER_ID=self.user,
            BUSN_ID=self.other_business,
        )
        now = timezone.now()
        BusinessPocket.objects.filter(USER_ID=self.user).update(PCKT_CREATED_AT=now)
        BusinessVouch.objects.filter(pk=vouch.pk).update(VOUCH_CREATED_AT=now)
        Review.objects.filter(pk=review.pk).update(REVW_CREATED_AT=now)
        ids = []
        for page in (1, 2):
            response = self.client.get(self.url, {"page_size": 2, "page": page})
            ids.extend(item["id"] for item in response.data["data"]["items"])
        self.assertEqual(
            ids,
            [
                f"review:{review.pk}",
                f"save:{second_save.pk}",
                f"save:{saved.pk}",
                f"vouch:{vouch.pk}",
            ],
        )

    def test_visibility_preserves_private_review_history(self):
        self.make_activity()
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        Review.objects.filter(USER_ID=self.user).update(
            REVW_STATUS=Review.ReviewStatus.REJECTED,
            REVW_SHOW_IN_COMMUNITY=False,
        )
        response = self.client.get(self.url)
        items = response.data["data"]["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["type"], "review")
        self.assertEqual(items[0]["review"]["status"], "rejected")
        self.assertEqual(items[0]["business"]["status"], "suspended")

    def test_retired_specialty_is_excluded_and_removals_disappear(self):
        saved, vouch, review = self.make_activity()
        BusinessSpecialtyTag.objects.filter(pk=self.assignment.pk).update(
            BST_IS_ACTIVE=False,
        )
        response = self.client.get(self.url, {"activity_type": "vouches"})
        self.assertEqual(response.data["data"]["items"], [])
        saved.delete()
        review.delete()
        self.assertEqual(self.client.get(self.url).data["data"]["items"], [])

    def test_compact_contract_and_bounded_database_query(self):
        self.make_activity()
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(self.url, {"activity_type": "all"})
        items = response.data["data"]["items"]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(queries), 2)
        self.assertIn("UNION ALL", queries[-1]["sql"])
        review = next(item for item in items if item["type"] == "review")
        self.assertEqual(len(review["review"]["excerpt"]), 180)
        self.assertEqual(
            set(review),
            {"id", "type", "source_id", "occurred_at", "business", "specialty", "review"},
        )
        self.assertIsNone(review["specialty"])
        self.assertIsNone(review["review"]["edited_at"])
        self.assertEqual(review["business"]["id"], self.business.pk)

    def test_multiple_collections_do_not_duplicate_saves(self):
        saved, vouch, review = self.make_activity()
        for name in ("Weekend", "Coffee"):
            collection = PocketCollection.objects.create(
                USER_ID=self.user,
                PCOL_NAME=name,
            )
            PocketMembership.objects.create(
                PCOL_ID=collection,
                PCKT_ID=saved,
            )
        response = self.client.get(
            self.url,
            {"activity_type": "saves"},
        )
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(response.data["data"]["items"][0]["id"], f"save:{saved.pk}")

    def test_vouch_context_and_review_edits_preserve_creation_order(self):
        saved, vouch, review = self.make_activity()
        created_at = timezone.now() - timedelta(days=2)
        Review.objects.filter(pk=review.pk).update(
            REVW_CREATED_AT=created_at,
            REVW_EDITED_AT=timezone.now(),
            REVW_TEXT="Updated review text.",
        )
        response = self.client.get(self.url)
        items = response.data["data"]["items"]
        self.assertEqual(items[-1]["id"], f"review:{review.pk}")
        self.assertEqual(items[-1]["review"]["excerpt"], "Updated review text.")
        self.assertIsNotNone(items[-1]["review"]["edited_at"])
        endorsement = next(item for item in items if item["type"] == "vouch")
        self.assertEqual(
            endorsement["specialty"],
            {
                "id": self.tag.pk,
                "name": self.tag.TAG_NAME,
                "color": self.tag.TAG_COLOR,
                "icon": self.tag.TAG_ICON,
            },
        )
        self.assertIsNone(endorsement["review"])

    def test_empty_and_invalid_pages(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
        self.assertEqual(self.client.get(self.url, {"page": 2}).status_code, 404)

    def test_cover_prefers_dedicated_photo_then_uses_business_storefront(self):
        self.make_activity()
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_COVER_PHOTO_URL="https://example.com/dedicated.jpg",
        )
        BusinessPhoto.objects.create(
            BUSN_ID=self.business,
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
            BPHO_PHOTO_URL="https://example.com/storefront.jpg",
            BPHO_PHOTO_PUBLIC_ID="timeline-storefront",
        )
        for activity in self.client.get(self.url).data["data"]["items"]:
            self.assertEqual(
                activity["business"]["display_cover_photo_url"],
                "https://example.com/dedicated.jpg",
            )
        Business.objects.filter(pk=self.business.pk).update(BUSN_COVER_PHOTO_URL="")
        BusinessPocket.objects.create(
            USER_ID=self.user,
            BUSN_ID=self.other_business,
        )
        response = self.client.get(self.url)
        for activity in response.data["data"]["items"]:
            if activity["business"]["id"] == self.business.pk:
                self.assertEqual(
                    activity["business"]["display_cover_photo_url"],
                    "https://example.com/storefront.jpg",
                )
            else:
                self.assertIsNone(activity["business"]["display_cover_photo_url"])
