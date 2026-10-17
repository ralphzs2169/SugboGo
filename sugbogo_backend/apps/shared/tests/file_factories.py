from io import BytesIO
import os

from PIL import Image


def _image_bytes(format, *, size=(20, 20), color=(120, 70, 30), random_pixels=False, quality=75):
    output = BytesIO()
    image = Image.frombytes("RGB", size, os.urandom(size[0] * size[1] * 3)) if random_pixels else Image.new("RGB", size, color)
    image.save(output, format=format, quality=quality)
    return output.getvalue()


def make_png_bytes(**kwargs):
    return _image_bytes("PNG", **kwargs)


def make_jpeg_bytes(**kwargs):
    return _image_bytes("JPEG", **kwargs)


def make_pdf_bytes():
    """A minimal blank PDF with a valid header, object offsets, and EOF."""
    data = b"%PDF-1.4\n"
    offsets = [0]
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [] /Count 0 >>"]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(data)
    data += b"xref\n0 3\n0000000000 65535 f \n"
    data += b"".join(f"{offset:010} 00000 n \n".encode() for offset in offsets[1:])
    return data + f"trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
