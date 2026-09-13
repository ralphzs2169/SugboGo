from base64 import b64decode
from unittest.mock import patch

from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


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
		self.assertIn("avatar_key", response.data["data"])
		self.assertIsNone(response.data["data"]["avatar_key"])

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

	def test_patch_saves_valid_avatar_key(self):
		response = self.client.patch(
			self.url,
			{"avatar_key": User.AvatarKey.EXPLORER_AVATAR_3},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Profile updated successfully.",
		)
		self.user.refresh_from_db()
		self.assertEqual(
			self.user.USER_AVATAR_KEY,
			User.AvatarKey.EXPLORER_AVATAR_3,
		)
		self.assertEqual(
			response.data["data"]["avatar_key"],
			User.AvatarKey.EXPLORER_AVATAR_3,
		)

	def test_patch_replaces_valid_avatar_key(self):
		self.user.USER_AVATAR_KEY = User.AvatarKey.EXPLORER_AVATAR_2
		self.user.save(update_fields=["USER_AVATAR_KEY"])

		response = self.client.patch(
			self.url,
			{"avatar_key": User.AvatarKey.EXPLORER_AVATAR_6},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Profile updated successfully.",
		)
		self.user.refresh_from_db()
		self.assertEqual(
			self.user.USER_AVATAR_KEY,
			User.AvatarKey.EXPLORER_AVATAR_6,
		)

	def test_patch_rejects_invalid_avatar_key(self):
		response = self.client.patch(
			self.url,
			{"avatar_key": "shared/assets/avatars/explorer-avatar-1.webp"},
			format="json",
		)

		self.assertValidationError(response, "avatar_key")

	def test_patch_accepts_null_avatar_key(self):
		self.user.USER_AVATAR_KEY = User.AvatarKey.EXPLORER_AVATAR_4
		self.user.save(update_fields=["USER_AVATAR_KEY"])

		response = self.client.patch(
			self.url,
			{"avatar_key": None},
			format="json",
		)

		self.assertSuccessResponse(
			response,
			message="Profile updated successfully.",
		)
		self.user.refresh_from_db()
		self.assertIsNone(self.user.USER_AVATAR_KEY)

	def test_uploaded_profile_picture_remains_avatar_url(self):
		self.user.USER_AVATAR_KEY = User.AvatarKey.EXPLORER_AVATAR_5
		self.user.USER_PROFILE_PICTURE = "https://example.com/uploaded.jpg"
		self.user.save(
			update_fields=[
				"USER_AVATAR_KEY",
				"USER_PROFILE_PICTURE",
			],
		)

		response = self.client.get(self.url)

		self.assertEqual(
			response.data["data"]["avatar_url"],
			"https://example.com/uploaded.jpg",
		)
		self.assertEqual(
			response.data["data"]["avatar_key"],
			User.AvatarKey.EXPLORER_AVATAR_5,
		)

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
