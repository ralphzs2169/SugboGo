import logging

import cloudinary.uploader
import cloudinary.utils
from cloudinary.exceptions import NotFound

logger = logging.getLogger(__name__)


class CloudinaryService:

    @staticmethod
    def destroy_asset(
        public_id: str,
        resource_type: str,
    ) -> dict:
        """Destroy an uploaded image or raw asset and require a confirmed outcome."""
        if not public_id or resource_type not in ("image", "raw"):
            raise ValueError("A supported Cloudinary asset identifier is required.")
        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type=resource_type,
                type="upload",
                timeout=15,
            )
        except NotFound:
            return {"result": "not found"}
        if (
            not isinstance(result, dict)
            or result.get("result") not in ("ok", "not found")
        ):
            raise RuntimeError("Cloudinary did not confirm asset deletion.")
        return result

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
