from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image
from rest_framework.exceptions import ValidationError

from apps.shared.services.cloudinary_service import CloudinaryService
from apps.shared.tests.file_factories import make_jpeg_bytes, make_pdf_bytes, make_png_bytes
from core.upload_validation import MAX_UPLOAD_BYTES, ValidatedImageField, validate_upload


class UploadValidationTests(SimpleTestCase):
    def test_valid_formats_and_stream_position(self):
        for name, content, mime in (
            ("photo.png", make_png_bytes(), "image/png"),
            ("photo.jpg", make_jpeg_bytes(), "image/jpeg"),
            ("document.pdf", make_pdf_bytes(), "application/pdf"),
        ):
            with self.subTest(name=name):
                file = SimpleUploadedFile(name, content, content_type=mime)
                file.seek(3)
                self.assertIs(validate_upload(file), file)
                self.assertEqual(file.tell(), 3)

    def test_rejects_fake_extension_and_mismatched_claim(self):
        for name, content, mime in (
            ("photo.jpg", make_png_bytes(), "image/jpeg"),
            ("photo.exe", make_png_bytes(), "image/png"),
            ("photo.png", make_png_bytes(), "application/pdf"),
            ("document.pdf", b"pretend pdf", "application/pdf"),
            ("image.gif", b"GIF89a", "image/gif"),
            ("document.docx", b"PK\x03\x04", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ):
            with self.subTest(name=name, mime=mime), self.assertRaises(ValidationError):
                validate_upload(SimpleUploadedFile(name, content, content_type=mime))

    def test_rejects_oversized_file(self):
        file = SimpleUploadedFile("photo.jpg", make_jpeg_bytes(), content_type="image/jpeg")
        file.size = MAX_UPLOAD_BYTES + 1
        with self.assertRaises(ValidationError):
            validate_upload(file)

    def test_rejects_corrupt_image_with_valid_signature(self):
        data = bytearray(make_png_bytes())
        data[45] ^= 0xFF
        with self.assertRaises(ValidationError):
            validate_upload(SimpleUploadedFile("photo.png", bytes(data), content_type="image/png"))

    def test_rejects_appended_polyglot_payloads(self):
        for name, content, mime in (
            ("photo.png", make_png_bytes() + b"<script>alert(1)</script>", "image/png"),
            ("photo.jpg", make_jpeg_bytes() + make_pdf_bytes(), "image/jpeg"),
            ("photo.jpg", make_jpeg_bytes() + make_pdf_bytes() + b"\xff\xd9", "image/jpeg"),
            ("photo.png", make_png_bytes() + make_pdf_bytes() + make_png_bytes()[-12:], "image/png"),
            ("document.pdf", make_pdf_bytes() + b"PK\x03\x04zip-payload", "application/pdf"),
        ):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                validate_upload(SimpleUploadedFile(name, content, content_type=mime))

    def test_image_field_checks_claim_before_drf_replaces_it(self):
        file = SimpleUploadedFile("photo.png", make_png_bytes(), content_type="image/jpeg")
        with self.assertRaises(ValidationError):
            ValidatedImageField().run_validation(file)

    def test_business_photo_field_checks_the_original_claim(self):
        from apps.merchant_operations.business_profile.serializers.business_profile_serializers import BusinessPhotoUploadSerializer

        file = SimpleUploadedFile("photo.png", make_png_bytes(), content_type="image/jpeg")
        with self.assertRaises(ValidationError):
            BusinessPhotoUploadSerializer().run_validation(file)
        valid = SimpleUploadedFile("photo.png", make_png_bytes(), content_type="image/png")
        self.assertIs(BusinessPhotoUploadSerializer().run_validation(valid), valid)

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.upload")
    def test_cloudinary_receives_pixels_without_exif(self, upload):
        image = Image.new("RGB", (10, 10))
        exif = Image.Exif()
        exif[270] = "Private location metadata"
        buffer = BytesIO()
        image.save(buffer, format="JPEG", exif=exif)
        file = SimpleUploadedFile("photo.jpg", buffer.getvalue(), content_type="image/jpeg")
        CloudinaryService.upload_image(file, "public/images")
        submitted = upload.call_args.args[0]
        self.assertEqual(submitted.tell(), 0)
        with Image.open(submitted) as sanitized:
            self.assertEqual(dict(sanitized.getexif()), {})
            self.assertEqual(sanitized.size, (10, 10))

    @patch("apps.shared.services.cloudinary_service.cloudinary.uploader.upload")
    def test_invalid_upload_never_reaches_cloudinary(self, upload):
        with self.assertRaises(ValidationError):
            CloudinaryService.upload_image(SimpleUploadedFile("photo.jpg", b"fake", content_type="image/jpeg"), "images")
        upload.assert_not_called()
