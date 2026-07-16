import cloudinary.uploader


class CloudinaryService:

    @staticmethod
    def upload_image(file, folder):
        return cloudinary.uploader.upload(
            file,
            folder=folder,
        )