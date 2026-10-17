"""Render one sanitized merchant report as an ephemeral downloadable PDF."""

from io import BytesIO
import json
from pathlib import Path
from threading import Lock
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate
from reportlab.platypus.doctemplate import LayoutError
from rest_framework.exceptions import APIException, ValidationError

from ..serializers.peer_report_serializers import MerchantReportSerializer
from .merchant_report_service import MerchantReportService
from .report_pdf_layout import MerchantReportLayout


_RENDER_LOCK = Lock()


class ReportExportUnavailable(APIException):
    """Return a controlled retryable failure without exposing report contents."""

    status_code = 503
    default_detail = "Report export is temporarily unavailable. Please try again."
    default_code = "report_export_unavailable"


class _BoundedDocument(SimpleDocTemplate):
    """Stop oversized documents rather than return a silently incomplete report."""

    MAX_PAGES = 150

    def afterPage(self):
        """Enforce the synchronous export page limit during document construction."""
        if self.page > self.MAX_PAGES:
            raise ValidationError({"export": "This report is too large to export; select a shorter period."})


class ReportPDFService:
    """Reuse authoritative report calculations and render only their response allowlist."""

    MAX_ROWS = 6000
    MAX_TEXT_CHARACTERS = 1_500_000
    MAX_BYTES = 10 * 1024 * 1024
    BRAND = colors.HexColor("#F27F0D")
    TEXT = colors.HexColor("#111827")
    MUTED = colors.HexColor("#6B7280")
    BORDER = colors.HexColor("#E5E7EB")
    BACKGROUND = colors.HexColor("#F3F4F6")
    FONT = "SugboReportVera"
    BOLD = "SugboReportVeraBold"

    @staticmethod
    def label(key):
        """Make schema keys readable without changing their values or measurement definitions."""
        if key == "reply_rate":
            return "Reply rate (%)"
        return str(key).replace("_", " ").capitalize()

    @classmethod
    def fonts(cls):
        """Register bundled fonts under the rendering lock without fetching remote assets."""
        directory = Path(reportlab.__file__).parent / "fonts"
        if cls.FONT not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(cls.FONT, str(directory / "Vera.ttf")))
            pdfmetrics.registerFont(TTFont(cls.BOLD, str(directory / "VeraBd.ttf")))
        return set(pdfmetrics.getFont(cls.FONT).face.charToGlyph) & set(pdfmetrics.getFont(cls.BOLD).face.charToGlyph)

    @classmethod
    def text(cls, value, glyphs):
        """Escape report text and visibly encode unsupported glyphs instead of drawing missing boxes."""
        if value is None:
            value = "Not available / not applicable - see status and reason"
        elif isinstance(value, bool):
            value = "Yes" if value else "No"
        value = str(value).replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
        value = "".join(character if character == "\n" or ord(character) in glyphs and ord(character) >= 32
                        else f"[U+{ord(character):04X}]" for character in value)
        return escape(value).replace("\n", "<br/>")

    @classmethod
    def rows(cls, value, prefix="", metadata_refs=None):
        """Flatten sanitized evidence into labeled rows while retaining nulls and empty collections."""
        if isinstance(value, dict):
            if {"availability", "coverage_verified", "period"} <= value.keys():
                if metadata_refs is not None:
                    signature = json.dumps(value, sort_keys=True)
                    reference, _ = metadata_refs.setdefault(signature, (f"M{len(metadata_refs) + 1}", value))
                    yield prefix or "Metadata", (
                        f"Availability: {value['availability']}; coverage verified: {value['coverage_verified']}. "
                        f"See source metadata {reference} in the appendix."
                    )
                    return
                parts = []
                for key, item in value.items():
                    if isinstance(item, dict):
                        item = "; ".join(f"{cls.label(name)}: {entry}" for name, entry in item.items())
                    elif isinstance(item, list):
                        item = ", ".join(str(entry) for entry in item) or "None"
                    elif item is None:
                        item = "Not available"
                    parts.append(f"{cls.label(key)}: {item}")
                yield prefix or "Metadata", "\n".join(parts)
            elif value:
                for key, item in value.items():
                    yield from cls.rows(item, f"{prefix} / {cls.label(key)}" if prefix else cls.label(key), metadata_refs)
            else:
                yield prefix, "No entries"
        elif isinstance(value, list):
            if not value:
                yield prefix, "No entries"
            elif all(not isinstance(item, (dict, list)) for item in value):
                yield prefix, ", ".join(str(item) for item in value)
            else:
                for index, item in enumerate(value, 1):
                    if isinstance(item, dict) and "series" not in item:
                        details = "\n".join(f"{label}: {'Not available' if detail is None else detail}"
                                            for label, detail in cls.rows(item, metadata_refs=metadata_refs))
                        yield f"{prefix} / {item.get('date', index)}", details
                    else:
                        yield from cls.rows(item, f"{prefix} / {index}", metadata_refs)
        else:
            yield prefix, value

    @classmethod
    def get_pdf(cls, user, period, *, interval="daily"):
        """Calculate once and serialize once before rendering the selected owned-business report."""
        report = MerchantReportService.get_report(user, period, interval=interval)
        sanitized = MerchantReportSerializer(report).data
        content = cls.render(sanitized)
        filename = f"sugbogo-merchant-report-{sanitized['business']['id']}-{period.start_date}-{period.end_date}.pdf"
        return content, filename

    @classmethod
    def render(cls, report):
        """Build a bounded PDF from the sanitized report without storing files or fetching external content."""
        if not _RENDER_LOCK.acquire(blocking=False):
            raise ReportExportUnavailable()
        try:
            glyphs = cls.fonts()
            sections = [("Standard analytics", report["results"]["standard"])]
            sections.extend((f"Premium: {cls.label(key)}", value) for key, value in report["results"]["premium"].items())
            sections.extend((
                ("Anonymous peer comparisons", report["peers"]),
                ("Changes and comparison limitations", report["changes"]),
                ("Report metadata", report["meta"]),
            ))
            if len(json.dumps(report, ensure_ascii=False)) > cls.MAX_TEXT_CHARACTERS:
                raise ValidationError({"export": "This report is too large to export; select a shorter period."})
            metadata_refs = {}
            flattened = [(title, list(cls.rows(value, metadata_refs=metadata_refs))) for title, value in sections]
            flattened.append(("Source metadata appendix", [
                (reference, list(cls.rows(metadata))[0][1])
                for reference, metadata in metadata_refs.values()
            ]))
            row_count = sum(len(rows) for _, rows in flattened)
            character_count = sum(len(str(label)) + len(str(value)) for _, rows in flattened for label, value in rows)
            if row_count > cls.MAX_ROWS or character_count > cls.MAX_TEXT_CHARACTERS:
                raise ValidationError({"export": "This report is too large to export; select a shorter period."})
            story = MerchantReportLayout(cls, glyphs).build(report, metadata_refs)
            buffer = BytesIO()
            document = _BoundedDocument(
                buffer, pagesize=A4, leftMargin=44, rightMargin=44,
                topMargin=46, bottomMargin=46, title="SugboGo Merchant Analytics Report", author="SugboGo",
            )

            def footer(canvas, doc):
                """Add restrained brand identification and page numbering inside reserved margins."""
                canvas.saveState()
                canvas.setStrokeColor(cls.BRAND)
                canvas.line(44, 32, A4[0] - 44, 32)
                canvas.setFont(cls.FONT, 7)
                canvas.setFillColor(cls.MUTED)
                canvas.drawString(44, 21, "SugboGo | Merchant analytics | Personal report")
                canvas.drawRightString(A4[0] - 44, 21, f"Page {doc.page}")
                canvas.restoreState()

            document.build(story, onFirstPage=footer, onLaterPages=footer)
            content = buffer.getvalue()
            if len(content) > cls.MAX_BYTES:
                raise ValidationError({"export": "This report is too large to export; select a shorter period."})
            return content
        except (LayoutError, OSError) as exc:
            raise ReportExportUnavailable() from exc
        finally:
            _RENDER_LOCK.release()
