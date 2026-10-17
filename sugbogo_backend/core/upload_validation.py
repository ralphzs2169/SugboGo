from io import BytesIO
from pathlib import Path
import warnings

from PIL import Image, ImageOps
from rest_framework import serializers


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
IMAGE_TYPES = {"image/png", "image/jpeg"}
EXTENSIONS = {"image/png": {".png"}, "image/jpeg": {".jpg", ".jpeg"}, "application/pdf": {".pdf"}}


def _image_ends_at_eof(data, mime):
    """Reject payloads after the real end marker, even with a copied final marker."""
    offset = 8 if mime == "image/png" else 2
    if mime == "image/png":
        while offset + 12 <= len(data):
            length = int.from_bytes(data[offset:offset + 4], "big")
            kind = data[offset + 4:offset + 8]
            offset += length + 12
            if kind == b"IEND":
                return length == 0 and offset == len(data)
        return False

    scanning = False
    while offset < len(data):
        if scanning:
            offset = data.find(b"\xff", offset)
            if offset < 0:
                return False
        elif data[offset] != 0xFF:
            return False
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            return False
        marker = data[offset]
        offset += 1
        if scanning and (marker == 0 or 0xD0 <= marker <= 0xD7):
            continue
        if marker == 0xD9:
            return offset == len(data)
        if marker in (0, 0xD8) or offset + 2 > len(data):
            return False
        length = int.from_bytes(data[offset:offset + 2], "big")
        if length < 2 or offset + length > len(data):
            return False
        offset += length
        # DNL can occur inside entropy data; progressive JPEGs have multiple scans.
        scanning = marker == 0xDA or (scanning and marker == 0xDC)
    return False


def validate_upload(file, *, allow_pdf=True):
    """Check size, claimed type, extension, signature, and image integrity."""
    allowed = set(EXTENSIONS) if allow_pdf else IMAGE_TYPES
    claimed = getattr(file, "content_type", None)
    if claimed not in allowed:
        raise serializers.ValidationError("Only PDF, JPEG, and PNG files are allowed." if allow_pdf else "Only JPEG and PNG images are allowed.")
    if Path(file.name).suffix.lower() not in EXTENSIONS[claimed]:
        raise serializers.ValidationError("The file extension does not match its content type.")
    if file.size > MAX_UPLOAD_BYTES:
        raise serializers.ValidationError("Files must be 10 MB or smaller.")
    position = file.tell()
    try:
        file.seek(0)
        data = file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise serializers.ValidationError("Files must be 10 MB or smaller.")
        detected = None
        if data.startswith(b"%PDF-") and data.rstrip().endswith(b"%%EOF"):
            detected = "application/pdf"
        elif data.startswith(b"\x89PNG\r\n\x1a\n") and data.endswith(b"\x00\x00\x00\x00IEND\xaeB`\x82"):
            detected = "image/png"
        elif data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"):
            detected = "image/jpeg"
        if detected != claimed:
            raise serializers.ValidationError("The file contents do not match its content type, or the file is corrupt.")
        if detected in IMAGE_TYPES:
            if not _image_ends_at_eof(data, detected):
                raise serializers.ValidationError("Extra data after the image is not allowed.")
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    with Image.open(BytesIO(data)) as image:
                        image.verify()
                    with Image.open(BytesIO(data)) as image:
                        image.load()
            except (OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
                raise serializers.ValidationError("The image is corrupt or too large to decode safely.") from exc
    finally:
        file.seek(position)
    return file


class ValidatedImageField(serializers.ImageField):
    def __init__(self, *args, size_message="Files must be 10 MB or smaller.", **kwargs):
        self.size_message = size_message
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        file = serializers.FileField.to_internal_value(self, data)
        if file.size > MAX_UPLOAD_BYTES:
            raise serializers.ValidationError(self.size_message)
        # Check the original claim before ImageField replaces content_type.
        validate_upload(file, allow_pdf=False)
        return super().to_internal_value(file)


class ValidatedImageListField(serializers.ListField):
    def __init__(self, *args, size_message, **kwargs):
        self.size_message = size_message
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        if isinstance(data, (list, tuple)) and any(getattr(file, "size", 0) > MAX_UPLOAD_BYTES for file in data):
            raise serializers.ValidationError(self.size_message)
        return super().to_internal_value(data)


def strip_image_metadata(file):
    """Re-encode pixels before upload, retaining orientation and dropping EXIF/GPS."""
    validate_upload(file)
    if file.content_type not in IMAGE_TYPES:
        return file
    file.seek(0)
    with Image.open(file) as original:
        oriented = ImageOps.exif_transpose(original)
        mode = "RGBA" if file.content_type == "image/png" and ("A" in oriented.getbands() or "transparency" in oriented.info) else "RGB"
        converted = oriented.convert(mode)
        clean = Image.new(mode, converted.size)
        clean.paste(converted)
        output = BytesIO()
        clean.save(output, format="PNG" if file.content_type == "image/png" else "JPEG")
    data = output.getvalue()
    file.seek(0)
    file.truncate(0)
    file.write(data)
    file.size = len(data)
    file.seek(0)
    return file
