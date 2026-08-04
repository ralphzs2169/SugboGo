import logging

import cloudinary.uploader

logger = logging.getLogger(__name__)

class CloudinaryService:

    @staticmethod
    def upload_image(file, folder, resource_type="image"):
        return cloudinary.uploader.upload(
            file,
            folder=folder,
            resource_type=resource_type,
        )

    @staticmethod
    def delete_image(public_id):
        if not public_id:
            return

        try:
            return cloudinary.uploader.destroy(public_id)
        except Exception:
            logger.exception("Failed to delete Cloudinary image.")
            return None