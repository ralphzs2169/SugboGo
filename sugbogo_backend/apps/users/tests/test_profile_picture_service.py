from unittest.mock import patch, MagicMock

from rest_framework.test import APITestCase

from apps.users.models import User
from apps.users.services.profile_picture_service import ProfilePictureService


class ProfilePictureServiceTests(APITestCase):
    """Tests for profile picture upload and deletion services."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="john@example.com",
            password="StrongPassword123!",
            USER_FNAME="John",
            USER_LNAME="Doe",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.image = MagicMock()

    @patch(
        "apps.users.services.profile_picture_service.CloudinaryService.upload_image"
    )
    def test_upload_profile_picture_successfully(self, mock_upload):
        mock_upload.return_value = {
            "secure_url": "https://cloudinary.com/profile.jpg",
            "public_id": "profile_pictures/john",
        }

        result = ProfilePictureService.upload(
            user=self.user,
            image=self.image,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            result,
            "https://cloudinary.com/profile.jpg",
        )

        self.assertEqual(
            self.user.USER_PROFILE_PICTURE,
            "https://cloudinary.com/profile.jpg",
        )

        self.assertEqual(
            self.user.USER_PROFILE_PICTURE_PUBLIC_ID,
            "profile_pictures/john",
        )

        mock_upload.assert_called_once_with(
            file=self.image,
            folder="profile_pictures",
        )


    @patch(
        "apps.users.services.profile_picture_service.CloudinaryService.delete_image"
    )
    @patch(
        "apps.users.services.profile_picture_service.CloudinaryService.upload_image"
    )
    def test_upload_profile_picture_deletes_existing_picture_first(
        self,
        mock_upload,
        mock_delete,
    ):
        self.user.USER_PROFILE_PICTURE = (
            "https://cloudinary.com/old-profile.jpg"
        )

        self.user.USER_PROFILE_PICTURE_PUBLIC_ID = (
            "profile_pictures/old"
        )

        self.user.save()

        mock_upload.return_value = {
            "secure_url": "https://cloudinary.com/new-profile.jpg",
            "public_id": "profile_pictures/new",
        }

        ProfilePictureService.upload(
            user=self.user,
            image=self.image,
        )

        mock_delete.assert_called_once_with(
            "profile_pictures/old",
        )

        mock_upload.assert_called_once()


    @patch(
        "apps.users.services.profile_picture_service.CloudinaryService.delete_image"
    )
    def test_delete_profile_picture_successfully_removes_picture(
        self,
        mock_delete,
    ):
        self.user.USER_PROFILE_PICTURE = (
            "https://cloudinary.com/profile.jpg"
        )

        self.user.USER_PROFILE_PICTURE_PUBLIC_ID = (
            "profile_pictures/john"
        )

        self.user.save()

        ProfilePictureService.delete(
            user=self.user,
        )

        self.user.refresh_from_db()

        mock_delete.assert_called_once_with(
            "profile_pictures/john",
        )

        self.assertIsNone(
            self.user.USER_PROFILE_PICTURE,
        )

        self.assertIsNone(
            self.user.USER_PROFILE_PICTURE_PUBLIC_ID,
        )


    @patch(
        "apps.users.services.profile_picture_service.CloudinaryService.delete_image"
    )
    def test_delete_profile_picture_does_nothing_when_no_picture_exists(
        self,
        mock_delete,
    ):
        ProfilePictureService.delete(
            user=self.user,
        )

        self.user.refresh_from_db()

        mock_delete.assert_not_called()

        self.assertIsNone(
            self.user.USER_PROFILE_PICTURE,
        )

        self.assertIsNone(
            self.user.USER_PROFILE_PICTURE_PUBLIC_ID,
        )