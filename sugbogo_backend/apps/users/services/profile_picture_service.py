from apps.users.models import User
from apps.shared.services.cloudinary_service import CloudinaryService


class ProfilePictureService:
    """
    Handles profile picture uploads.
    """

    @staticmethod
    def upload(user: User, image):
        
        # Delete the existing profile picture from Cloudinary if it exists
        if user.USER_PROFILE_PICTURE_PUBLIC_ID:
            CloudinaryService.delete_image(
                user.USER_PROFILE_PICTURE_PUBLIC_ID
            )

        # Upload the new profile picture to Cloudinary
        result = CloudinaryService.upload_image(
            file=image,
            folder="profile_pictures",
        )

        user.USER_PROFILE_PICTURE = result["secure_url"]
        user.USER_PROFILE_PICTURE_PUBLIC_ID = result["public_id"]

        user.save(
             update_fields=[
                "USER_PROFILE_PICTURE",
                "USER_PROFILE_PICTURE_PUBLIC_ID",
            ]
        )

        return result["secure_url"]
    

    @staticmethod
    def delete(user: User):
        """
        Removes the user's custom profile picture.

        This deletes the image from Cloudinary (if one exists) and clears the
        stored profile picture information. The frontend will automatically
        fall back to the OAuth avatar (if enabled) or the default placeholder.
        """

        if not user.USER_PROFILE_PICTURE_PUBLIC_ID:
            return

        CloudinaryService.delete_image(
            user.USER_PROFILE_PICTURE_PUBLIC_ID
        )

        user.USER_PROFILE_PICTURE = None
        user.USER_PROFILE_PICTURE_PUBLIC_ID = None

        user.save(
            update_fields=[
                "USER_PROFILE_PICTURE",
                "USER_PROFILE_PICTURE_PUBLIC_ID",
            ]
        )

