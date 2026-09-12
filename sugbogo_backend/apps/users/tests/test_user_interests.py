from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.business.models import Category, Cluster, SpecialtyTag
from apps.users.models import (
    User,
    UserCategoryInterest,
    UserSpecialtyTagInterest,
)


class UserInterestApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="interests@example.com",
            password="StrongPassword123!",
            USER_FNAME="Interest",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.cluster = Cluster.objects.create(CLUS_NAME="Interest Cluster")
        self.category = Category.objects.create(
            CTGRY_NAME="Interest Category",
            CLUS_ID=self.cluster,
        )
        self.tags = [
            SpecialtyTag.objects.create(TAG_NAME=f"Interest Tag {index}")
            for index in range(4)
        ]
        self.url = "/api/users/me/interests/"

    def test_put_persists_and_gets_authoritative_interests(self):
        response = self.client.put(
            self.url,
            {
                "category_ids": [self.category.CTGRY_ID],
                "specialty_tag_ids": [self.tags[0].TAG_ID],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(UserCategoryInterest.objects.count(), 1)
        self.assertEqual(UserSpecialtyTagInterest.objects.count(), 1)
        self.assertEqual(
            response.data["data"]["categories"][0]["id"],
            self.category.CTGRY_ID,
        )
        self.assertEqual(
            response.data["data"]["available_categories"][0]["cluster"],
            {
                "id": self.cluster.CLUS_ID,
                "name": self.cluster.CLUS_NAME,
            },
        )
        self.assertEqual(
            {
                specialty_tag["id"]
                for specialty_tag in response.data["data"][
                    "available_specialty_tags"
                ]
            },
            {
                specialty_tag.TAG_ID
                for specialty_tag in self.tags
            },
        )

    def test_onboarding_accepts_skip_and_deduplicates_ids(self):
        response = self.client.patch(
            self.url,
            {
                "specialty_tag_ids": [
                    self.tags[0].TAG_ID,
                    self.tags[0].TAG_ID,
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(UserSpecialtyTagInterest.objects.count(), 1)
        self.user.refresh_from_db()
        self.assertTrue(self.user.HAS_COMPLETED_INTEREST_SELECTION)

        skip_response = self.client.patch(self.url, {}, format="json")

        self.assertEqual(skip_response.status_code, status.HTTP_200_OK)
        self.assertEqual(UserSpecialtyTagInterest.objects.count(), 0)

    def test_onboarding_rejects_more_than_three_unique_tags(self):
        response = self.client.patch(
            self.url,
            {
                "specialty_tag_ids": [tag.TAG_ID for tag in self.tags],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("specialty_tag_ids", response.data["errors"])

    def test_invalid_update_is_transactional(self):
        UserCategoryInterest.objects.create(
            USER_ID=self.user,
            CTGRY_ID=self.category,
        )

        response = self.client.put(
            self.url,
            {
                "category_ids": [],
                "specialty_tag_ids": [999999],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            UserCategoryInterest.objects.filter(
                USER_ID=self.user,
                CTGRY_ID=self.category,
            ).exists(),
        )

    def test_database_constraints_prevent_duplicate_interests(self):
        UserCategoryInterest.objects.create(
            USER_ID=self.user,
            CTGRY_ID=self.category,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            UserCategoryInterest.objects.create(
                USER_ID=self.user,
                CTGRY_ID=self.category,
            )
