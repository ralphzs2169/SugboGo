from base64 import b64decode
from unittest.mock import patch

from core.tests.assertions import APIResponseAssertionsMixin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User


class UserProfileViewTests(APIResponseAssertionsMixin, APITestCase):
	"""Tests for retrieving and updating the authenticated user profile."""

	def setUp(self):
		self.user = User.objects.create_user(
			email="profile-view@example.com",
			password="StrongPassword123!",
			USER_FNAME="Profile",
			USER_LNAME="Explorer",
			USER_ROLE=User.UserRole.EXPLORER,
			USER_STATUS=User.UserStatus.ACTIVE,
		)
		self.client.force_authenticate(self.user)
		self.url = reverse("me")

	def test_get_returns_authenticated_user_profile(self):
		response = self.client.get(self.url)

		self.assertSuccessResponse(
			response,
			message="User retrieved successfully.",
		)
		self.assertEqual(
			response.data["data"]["email"],
			self.user.USER_EMAIL,
		)
		self.assertEqual(
			response.data["data"]["first_name"],
			self.user.USER_FNAME,
		)

	def test_patch_updates_profile_fields(self):
		response = self.client.patch(
			self.url,
			{
				"first_name": "Updated",
				"last_name": "Explorer",
				"gender": User.Gender.PREFER_NOT_TO_SAY,
			},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Profile updated successfully.",
		)
		self.user.refresh_from_db()
		self.assertEqual(self.user.USER_FNAME, "Updated")
		self.assertEqual(self.user.USER_GENDER, User.Gender.PREFER_NOT_TO_SAY)

	def test_profile_requires_authentication(self):
		self.client.force_authenticate(user=None)

		response = self.client.get(self.url)

		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfilePictureViewTests(APIResponseAssertionsMixin, APITestCase):
	"""Tests for profile picture upload and deletion endpoints."""

	def setUp(self):
		self.user = User.objects.create_user(
			email="profile-picture-view@example.com",
			password="StrongPassword123!",
			USER_FNAME="Picture",
			USER_LNAME="Explorer",
			USER_ROLE=User.UserRole.EXPLORER,
			USER_STATUS=User.UserStatus.ACTIVE,
		)
		self.client.force_authenticate(self.user)
		self.url = reverse("profile-picture")

	@patch("apps.users.views.profile_views.ProfilePictureService.upload")
	def test_patch_uploads_profile_picture(self, mock_upload):
		mock_upload.return_value = "https://cloudinary.com/profile.jpg"
		image = SimpleUploadedFile(
			"profile.png",
			b64decode(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
				"+A8AAQUBAScY42YAAAAASUVORK5CYII="
			),
			content_type="image/png",
		)

		response = self.client.patch(
			self.url,
			{"image": image},
			format="multipart",
		)

		self.assertSuccessResponse(
			response,
			message="Profile picture updated successfully.",
		)
		mock_upload.assert_called_once()
		self.assertEqual(mock_upload.call_args.kwargs["user"], self.user)

	@patch("apps.users.views.profile_views.ProfilePictureService.delete")
	def test_delete_removes_profile_picture(self, mock_delete):
		response = self.client.delete(self.url)

		self.assertSuccessResponse(
			response,
			message="Profile picture removed successfully.",
		)
		mock_delete.assert_called_once_with(user=self.user)


class AvatarPreferencesViewTests(APIResponseAssertionsMixin, APITestCase):
	"""Tests for updating authenticated user avatar preferences."""

	def setUp(self):
		self.user = User.objects.create_user(
			email="avatar-preferences-view@example.com",
			password="StrongPassword123!",
			USER_FNAME="Avatar",
			USER_LNAME="Explorer",
			USER_ROLE=User.UserRole.EXPLORER,
			USER_STATUS=User.UserStatus.ACTIVE,
		)
		self.client.force_authenticate(self.user)
		self.url = reverse("avatar-preferences")

	def test_patch_updates_oauth_avatar_preference(self):
		response = self.client.patch(
			self.url,
			{"use_oauth_avatar": False},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Avatar preferences updated successfully.",
		)
		self.user.refresh_from_db()
		self.assertFalse(self.user.USER_USE_OAUTH_AVATAR)

	def test_patch_requires_avatar_preference_value(self):
		response = self.client.patch(
			self.url,
			{},
			format="json",
		)

		self.assertValidationError(response, "use_oauth_avatar")
