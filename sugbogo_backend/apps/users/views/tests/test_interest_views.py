from apps.business.models import Category, Cluster, SpecialtyTag
from apps.users.models import (
	User,
	UserCategoryInterest,
	UserSpecialtyTagInterest,
)
from core.tests.assertions import APIResponseAssertionsMixin
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class UserInterestsViewTests(APIResponseAssertionsMixin, APITestCase):
	"""Tests for retrieving and updating authenticated user interests."""

	def setUp(self):
		self.user = User.objects.create_user(
			email="interests-view@example.com",
			password="StrongPassword123!",
			USER_FNAME="Interest",
			USER_LNAME="Explorer",
			USER_ROLE=User.UserRole.EXPLORER,
			USER_STATUS=User.UserStatus.ACTIVE,
		)
		self.client.force_authenticate(self.user)
		self.url = reverse("user-interests")
		self.cluster = Cluster.objects.create(
			CLUS_NAME="View Interest Cluster",
		)
		self.category = Category.objects.create(
			CTGRY_NAME="View Interest Category",
			CLUS_ID=self.cluster,
		)
		self.tags = [
			SpecialtyTag.objects.create(TAG_NAME=f"View Interest Tag {index}")
			for index in range(4)
		]

	def test_get_returns_selected_and_available_interests(self):
		UserCategoryInterest.objects.create(
			USER_ID=self.user,
			CTGRY_ID=self.category,
		)
		UserSpecialtyTagInterest.objects.create(
			USER_ID=self.user,
			TAG_ID=self.tags[0],
		)

		response = self.client.get(self.url)

		self.assertSuccessResponse(
			response,
			message="Interests retrieved successfully.",
		)
		self.assertEqual(
			response.data["data"]["categories"],
			[
				{
					"id": self.category.CTGRY_ID,
					"name": self.category.CTGRY_NAME,
					"cluster": {
						"id": self.cluster.CLUS_ID,
						"name": self.cluster.CLUS_NAME,
					},
				},
			],
		)
		self.assertEqual(
			response.data["data"]["specialty_tags"][0]["id"],
			self.tags[0].TAG_ID,
		)
		self.assertEqual(
			response.data["data"]["available_categories"][0]["id"],
			self.category.CTGRY_ID,
		)
		self.assertEqual(
			len(response.data["data"]["available_specialty_tags"]),
			len(self.tags),
		)

	def test_put_replaces_selected_interests(self):
		response = self.client.put(
			self.url,
			{
				"category_ids": [self.category.CTGRY_ID],
				"specialty_tag_ids": [self.tags[0].TAG_ID],
			},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Interests updated successfully.",
		)
		self.assertEqual(
			list(
				UserCategoryInterest.objects.filter(USER_ID=self.user)
				.values_list("CTGRY_ID", flat=True),
			),
			[self.category.CTGRY_ID],
		)
		self.assertEqual(
			list(
				UserSpecialtyTagInterest.objects.filter(USER_ID=self.user)
				.values_list("TAG_ID", flat=True),
			),
			[self.tags[0].TAG_ID],
		)

	def test_patch_completes_onboarding_and_defaults_missing_tags_to_empty(self):
		response = self.client.patch(
			self.url,
			{"category_ids": [self.category.CTGRY_ID]},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Interest selection completed successfully.",
		)
		self.user.refresh_from_db()
		self.assertTrue(self.user.HAS_COMPLETED_INTEREST_SELECTION)
		self.assertFalse(
			UserSpecialtyTagInterest.objects.filter(USER_ID=self.user).exists(),
		)

	def test_patch_rejects_more_than_three_specialty_tags(self):
		response = self.client.patch(
			self.url,
			{
				"specialty_tag_ids": [tag.TAG_ID for tag in self.tags],
			},
			format="json",
		)

		self.assertValidationError(response, "specialty_tag_ids")

	def test_interests_require_authentication(self):
		self.client.force_authenticate(user=None)

		response = self.client.get(self.url)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
