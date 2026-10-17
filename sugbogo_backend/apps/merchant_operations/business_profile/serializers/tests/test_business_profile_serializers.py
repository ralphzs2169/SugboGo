from apps.shared.tests.file_factories import make_jpeg_bytes

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.merchant_operations.business_profile.serializers.business_profile_serializers import (
    BusinessCoverPhotoSerializer,
)


class BusinessCoverPhotoSerializerTests(SimpleTestCase):

    def _create_image(self, width, height):
        return SimpleUploadedFile('cover.jpg', make_jpeg_bytes(size=(width, height), random_pixels=True, quality=100), content_type='image/jpeg')

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