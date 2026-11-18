from django.http import HttpResponse
from django.utils.http import content_disposition_header
from requests.exceptions import RequestException

from apps.merchant_application.services.document_service import DocumentService


def serve_document_preview(document):
    """Deliver supported document content without exposing or caching its upstream URL."""
    try:
        content, content_type = DocumentService.get_document_content(
            document,
        )
    except RequestException:
        content = b""
        content_type = ""

    content_type = content_type.split(";", 1)[0].strip().lower()
    if content_type in ("application/pdf", "image/jpeg", "image/png"):
        response = HttpResponse(
            content,
            content_type=content_type,
        )
        response["Content-Disposition"] = (
            content_disposition_header(
                as_attachment=False,
                filename=document.MDOC_FILE_NAME,
            )
            or "inline"
        )
    else:
        response = HttpResponse(
            "Document is temporarily unavailable.",
            status=502,
            content_type="text/plain",
        )

    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    response["X-Content-Type-Options"] = "nosniff"
    return response
