import cloudinary.uploader


class CloudinaryService:

    @staticmethod
    def upload_image(file, folder):
        return cloudinary.uploader.upload(
            file,
            folder=folder,
        )

    @staticmethod
    def delete_image(public_id):
        return cloudinary.uploader.destroy(
            public_id
        )