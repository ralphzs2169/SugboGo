import logging

import cloudinary.uploader
import cloudinary.utils

logger = logging.getLogger(__name__)


class CloudinaryService:

    @staticmethod
    def upload_image(
        file,
        folder,
        resource_type="image",
        **kwargs,
    ):
        return cloudinary.uploader.upload(
            file,
            folder=folder,
            resource_type=resource_type,
            **kwargs,
        )

    @staticmethod
    def generate_authenticated_document_url(
        public_id,
        format,
        version,
    ):
        """Generate a signed delivery URL for an authenticated document."""

        return cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="image",
            type="authenticated",
            format=format,
            version=version,
            secure=True,
            sign_url=True,
        )[0]

    @staticmethod
    def delete_image(public_id):
        if not public_id:
            return

        try:
            return cloudinary.uploader.destroy(public_id)
        except Exception:
            logger.exception("Failed to delete Cloudinary image.")
            return None