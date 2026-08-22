from apps.business.models import Business
from apps.shared.services.cloudinary_service import CloudinaryService
from django.db import transaction
from rest_framework.exceptions import NotFound


class BusinessProfileService:
    """Service class for merchant-facing business profile management."""

    @staticmethod
    def get_business_for_merchant(user):
        """Retrieve the business owned by the authenticated merchant."""

        try:
            return (
                Business.objects
                .select_related(
                    "USER_ID",
                )
                .get(
                    USER_ID=user,
                )
            )
        except Business.DoesNotExist:
            raise NotFound(
                "Your business could not be found.",
            )

    @staticmethod
    @transaction.atomic
    def update_cover_photo(business, photo):
        """
        Replace the business cover photo with a newly uploaded image.

        The previous Cloudinary asset is removed only after the database
        transaction successfully commits.
        """

        old_public_id = business.BUSN_COVER_PHOTO_PUBLIC_ID

        try:
            result = CloudinaryService.upload_image(
                file=photo,
                folder="business_profile_covers",
            )

            business.BUSN_COVER_PHOTO_URL = result["secure_url"]
            business.BUSN_COVER_PHOTO_PUBLIC_ID = result["public_id"]

            business.save(
                update_fields=[
                    "BUSN_COVER_PHOTO_URL",
                    "BUSN_COVER_PHOTO_PUBLIC_ID",
                    "BUSN_UPDATED_AT",
                ],
            )

        except Exception:
            if "result" in locals() and result.get("public_id"):
                CloudinaryService.delete_image(
                    result["public_id"],
                )

            raise

        if old_public_id:
            transaction.on_commit(
                lambda: CloudinaryService.delete_image(
                    old_public_id,
                )
            )

        return business