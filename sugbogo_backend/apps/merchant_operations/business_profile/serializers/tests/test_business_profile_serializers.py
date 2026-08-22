import os
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image

from apps.merchant_operations.business_profile.serializers.business_profile_serializers import (
    BusinessCoverPhotoSerializer,
)


class BusinessCoverPhotoSerializerTests(SimpleTestCase):

    def _create_image(self, width, height):
        image = Image.frombytes(
            "RGB",
            (width, height),
            os.urandom(width * height * 3),
        )

        buffer = BytesIO()

        image.save(
            buffer,
            format="JPEG",
            quality=100,
        )

        return SimpleUploadedFile(
            "cover.jpg",
            buffer.getvalue(),
            content_type="image/jpeg",
        )

    def test_accepts_cover_photo_under_10_mb(self):
        image = self._create_image(
            width=1000,
            height=1000,
        )

        self.assertLess(
            image.size,
            10 * 1024 * 1024,
        )

        serializer = BusinessCoverPhotoSerializer(
            data={"cover_photo": image},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_cover_photo_over_10_mb(self):
        image = self._create_image(
            width=4000,
            height=4000,
        )

        self.assertGreater(
            image.size,
            10 * 1024 * 1024,
        )

        serializer = BusinessCoverPhotoSerializer(
            data={"cover_photo": image},
        )

        self.assertFalse(serializer.is_valid())

        self.assertEqual(
            serializer.errors["cover_photo"][0],
            "Cover photo must be 10 MB or smaller.",
        )