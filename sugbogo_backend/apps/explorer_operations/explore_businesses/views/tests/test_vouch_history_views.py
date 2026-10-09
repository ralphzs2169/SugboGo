from datetime import timedelta

from django.contrib.gis.geos import Point
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.business_specialty_service import BusinessSpecialtyService
from apps.business.services.vouch_service import VouchService
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class VouchHistoryViewTests(APIResponseAssertionsMixin, APITestCase):
    """Covers current specialty vouch history and the existing mutation contract."""

    @classmethod
    def setUpTestData(cls):
        cls.user = cls.create_user("history-explorer")
        cls.other_user = cls.create_user("history-other")
        cls.owner = cls.create_user("history-owner", User.UserRole.MERCHANT)
        cls.cluster = Cluster.objects.create(CLUS_NAME="History Food")
        cls.category = Category.objects.create(
            CTGRY_NAME="History Restaurants",
            CLUS_ID=cls.cluster,
        )
        cls.location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="History Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.tags = [
            SpecialtyTag.objects.create(
                TAG_NAME=name,
                TAG_ICON=icon,
                TAG_COLOR=color,
            )
            for name, icon, color in (
                ("History Spicy", "utensils", "red"),
                ("History Traditional", "chef_hat", "blue"),
                ("History Cozy", "heart", "green"),
            )
        ]
        cls.business = cls.create_business("History Bistro", cls.owner)

    @staticmethod
    def create_user(name, role=User.UserRole.EXPLORER):
        return User.objects.create_user(
            email=f"{name}@example.com",
            password=None,
            USER_FNAME="History",
            USER_LNAME=name,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    @classmethod
    def create_business(cls, name, owner=None):
        business = Business.objects.create(
            BUSN_NAME=name,
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            BUSN_COVER_PHOTO_URL="https://example.com/history-cover.jpg",
            USER_ID=owner or cls.create_user(name, User.UserRole.MERCHANT),
            CTGRY_ID=cls.category,
            LOCT_ID=cls.location,
        )
        for tag in cls.tags:
            BusinessSpecialtyTag.objects.create(BUSN_ID=business, TAG_ID=tag)
        return business

    def setUp(self):
        self.url = reverse("vouch-history")
        self.mutation_url = reverse(
            "business-vouch",
            kwargs={"business_id": self.business.pk},
        )
        self.client.force_authenticate(self.user)

    def create_vouch(self, business=None, tag=None, user=None):
        return VouchService.create_vouch(
            user=user or self.user,
            business_id=(business or self.business).pk,
            tag_id=(tag or self.tags[0]).pk,
        )

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertAuthenticationError(response, code="NOT_AUTHENTICATED")

    def test_accepts_bearer_jwt(self):
        self.create_vouch()
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.user)}")
        response = self.client.get(self.url)
        self.assertSuccessResponse(response, message="Success.")
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)

    def test_allows_merchant_explorer_access_like_existing_vouch_endpoint(self):
        self.create_vouch(user=self.owner, business=self.create_business("Other Bistro"))
        self.client.force_authenticate(self.owner)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)

    def test_rejects_admin_and_inactive_users(self):
        for role, user_status in (
            (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
            (User.UserRole.EXPLORER, User.UserStatus.SUSPENDED),
            (User.UserRole.EXPLORER, User.UserStatus.DISABLED),
        ):
            with self.subTest(role=role, user_status=user_status):
                self.user.USER_ROLE = role
                self.user.USER_STATUS = user_status
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, 403)
                self.assertFalse(response.data["success"])

    def test_returns_only_requesting_users_vouches(self):
        own_vouch = self.create_vouch()
        self.create_vouch(tag=self.tags[1], user=self.other_user)
        response = self.client.get(self.url, {"user_id": self.other_user.pk})
        self.assertEqual([item["id"] for item in response.data["data"]["items"]], [own_vouch.pk])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)

        self.client.force_authenticate(self.other_user)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["items"][0]["specialty"]["id"], self.tags[1].pk)

    def test_serializes_business_specialty_timestamp_counts_and_user_flags(self):
        vouch = self.create_vouch()
        self.create_vouch(user=self.other_user)
        response = self.client.get(self.url)
        self.assertSuccessResponse(response, message="Success.")
        item = response.data["data"]["items"][0]
        self.assertEqual(item, {
            "id": vouch.pk,
            "business_id": self.business.pk,
            "business_name": "History Bistro",
            "cover_photo_url": "https://example.com/history-cover.jpg",
            "category": {"id": self.category.pk, "name": "History Restaurants"},
            "specialty": {
                "id": self.tags[0].pk,
                "name": self.tags[0].TAG_NAME,
                "color": "red",
                "icon": "utensils",
            },
            "created_at": vouch.VOUCH_CREATED_AT.isoformat().replace("+00:00", "Z"),
            "specialty_tags": [
                {
                    "id": tag.pk,
                    "name": tag.TAG_NAME,
                    "color": tag.TAG_COLOR,
                    "icon": tag.TAG_ICON,
                    "vouch_count": 2 if index == 0 else 0,
                    "is_vouched": index == 0,
                }
                for index, tag in enumerate(self.tags)
            ],
        })

    def test_supports_missing_cover_photo(self):
        self.create_vouch()
        Business.objects.filter(pk=self.business.pk).update(BUSN_COVER_PHOTO_URL=None)
        response = self.client.get(self.url)
        self.assertIsNone(response.data["data"]["items"][0]["cover_photo_url"])

    def test_preserves_multiple_specialty_vouches_and_duplicate_restriction(self):
        for tag in self.tags[:2]:
            response = self.client.post(self.mutation_url, {"tag_id": tag.pk}, format="json")
            self.assertEqual(response.status_code, 200)
        duplicate = self.client.post(
            self.mutation_url, {"tag_id": self.tags[0].pk}, format="json",
        )
        self.assertValidationError(duplicate)
        self.assertEqual(duplicate.data["message"], "You have already vouched for this specialty.")
        response = self.client.get(self.url)
        items = response.data["data"]["items"]
        self.assertEqual(len(items), 2)
        self.assertEqual({item["business_id"] for item in items}, {self.business.pk})
        self.assertEqual({item["specialty"]["id"] for item in items}, {tag.pk for tag in self.tags[:2]})
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 2)
        self.assertEqual([tag["is_vouched"] for tag in items[0]["specialty_tags"]], [True, True, False])
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_VOUCH_COUNT, 2)

    def test_orders_by_creation_time_newest_by_default_and_oldest_when_requested(self):
        first = self.create_vouch()
        second = self.create_vouch(tag=self.tags[1])
        third = self.create_vouch(business=self.create_business("Recent Bistro"))
        now = timezone.now()
        for index, vouch in enumerate((first, second, third)):
            BusinessVouch.objects.filter(pk=vouch.pk).update(
                VOUCH_CREATED_AT=now - timedelta(days=2 - index),
            )
        for params, expected in (
            ({}, [third.pk, second.pk, first.pk]),
            ({"ordering": "newest"}, [third.pk, second.pk, first.pk]),
            ({"ordering": "oldest"}, [first.pk, second.pk, third.pk]),
        ):
            with self.subTest(params=params):
                response = self.client.get(self.url, params)
                self.assertEqual([item["id"] for item in response.data["data"]["items"]], expected)

    def test_equal_timestamps_use_id_for_deterministic_pagination(self):
        vouches = [self.create_vouch(tag=tag) for tag in self.tags]
        BusinessVouch.objects.filter(USER_ID=self.user).update(VOUCH_CREATED_AT=timezone.now())
        for ordering, expected in (
            ("newest", [vouch.pk for vouch in reversed(vouches)]),
            ("oldest", [vouch.pk for vouch in vouches]),
        ):
            actual = []
            for page in (1, 2, 3):
                response = self.client.get(self.url, {
                    "ordering": ordering, "page_size": 1, "page": page,
                })
                actual.extend(item["id"] for item in response.data["data"]["items"])
                self.assertEqual(response.data["data"]["pagination"], {
                    "page": page,
                    "page_size": 1,
                    "total_items": 3,
                    "total_pages": 3,
                    "has_next": page < 3,
                    "has_previous": page > 1,
                })
            self.assertEqual(actual, expected)

    def test_default_page_size_total_count_and_maximum_page_size(self):
        businesses = [self.business] + [self.create_business(f"Page Bistro {i}") for i in range(3)]
        for index in range(11):
            self.create_vouch(business=businesses[index // 3], tag=self.tags[index % 3])
        first = self.client.get(self.url)
        second = self.client.get(self.url, {"page": 2})
        self.assertEqual(len(first.data["data"]["items"]), 10)
        self.assertEqual(len(second.data["data"]["items"]), 1)
        self.assertEqual(first.data["data"]["pagination"]["total_items"], 11)
        self.assertEqual(second.data["data"]["pagination"]["total_items"], 11)
        self.assertEqual(first.data["data"]["pagination"]["total_pages"], 2)
        first_ids = {item["id"] for item in first.data["data"]["items"]}
        self.assertNotIn(second.data["data"]["items"][0]["id"], first_ids)
        capped = self.client.get(self.url, {"page_size": 500})
        self.assertEqual(capped.data["data"]["pagination"]["page_size"], 100)

    def test_empty_history_uses_existing_pagination_contract(self):
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"], {
            "items": [],
            "pagination": {
                "page": 1, "page_size": 10, "total_items": 0,
                "total_pages": 0, "has_next": False, "has_previous": False,
            },
        })

    def test_rejects_invalid_ordering_and_out_of_range_page(self):
        response = self.client.get(self.url, {"ordering": "invalid"})
        self.assertValidationError(response, "ordering")
        response = self.client.get(self.url, {"page": 2})
        self.assertEqual(response.status_code, 404)

    def test_removed_vouch_disappears_and_recreation_has_new_identity(self):
        old_vouch = self.create_vouch()
        self.create_vouch(user=self.other_user)
        response = self.client.delete(self.mutation_url, {"tag_id": self.tags[0].pk}, format="json")
        self.assertEqual(response.status_code, 200)
        history = self.client.get(self.url)
        self.assertEqual(history.data["data"]["items"], [])
        self.assertEqual(history.data["data"]["pagination"]["total_items"], 0)
        self.assertTrue(BusinessVouch.objects.filter(USER_ID=self.other_user).exists())
        recreated = self.create_vouch()
        history = self.client.get(self.url)
        self.assertNotEqual(recreated.pk, old_vouch.pk)
        self.assertEqual(history.data["data"]["items"][0]["id"], recreated.pk)

    def test_excludes_suspended_businesses_and_restores_active_businesses(self):
        self.create_vouch()
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.SUSPENDED)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
        Business.objects.filter(pk=self.business.pk).update(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)

    def test_deleted_business_is_excluded_by_existing_cascade(self):
        vouch = self.create_vouch()
        self.business.delete()
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
        self.assertFalse(BusinessVouch.objects.filter(pk=vouch.pk).exists())

    def test_excludes_retired_specialties_without_deleting_vouches(self):
        retired = self.create_vouch()
        current = self.create_vouch(tag=self.tags[1])
        BusinessSpecialtyService.deactivate_specialty(self.business.pk, self.tags[0].pk)
        response = self.client.get(self.url)
        self.assertEqual([item["id"] for item in response.data["data"]["items"]], [current.pk])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(
            [tag["id"] for tag in response.data["data"]["items"][0]["specialty_tags"]],
            [tag.pk for tag in self.tags[1:]],
        )
        self.assertTrue(BusinessVouch.objects.filter(pk=retired.pk).exists())
        BusinessSpecialtyService.reactivate_specialty(self.business.pk, self.tags[0].pk)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 2)

    def test_evidence_validity_does_not_change_existing_vouch_visibility(self):
        vouch = self.create_vouch()
        BusinessVouch.objects.filter(pk=vouch.pk).update(VOUCH_EVIDENCE_IS_VALID=False)
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["items"][0]["id"], vouch.pk)
        self.assertTrue(response.data["data"]["items"][0]["specialty_tags"][0]["is_vouched"])

    def test_query_count_is_constant_for_multiple_businesses_and_vouches(self):
        self.create_vouch()
        with self.assertNumQueries(3):
            single = self.client.get(self.url)
        self.assertEqual(single.status_code, 200)
        for index in range(3):
            business = self.create_business(f"Efficient Bistro {index}")
            for tag in self.tags:
                self.create_vouch(business=business, tag=tag)
        with self.assertNumQueries(3):
            multiple = self.client.get(self.url)
        self.assertEqual(len(multiple.data["data"]["items"]), 10)
