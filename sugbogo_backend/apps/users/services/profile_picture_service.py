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