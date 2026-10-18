"""Private PDF download with the existing Premium permission and error contracts."""

from io import BytesIO

from django.http import FileResponse
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.views import APIView

from ..serializers.report_export_serializers import ReportExportQuerySerializer
from ..services.report_pdf_service import ReportPDFService
from .premium_analytics_views import PremiumAnalyticsView


class PDFDownloadRenderer(BaseRenderer):
    """Accept PDF requests while retaining JSON envelopes for permission and validation errors."""

    media_type = "application/pdf"
    format = "pdf"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        """Render API errors as JSON because successful downloads use Django FileResponse."""
        if renderer_context:
            renderer_context["response"]["Content-Type"] = "application/json"
        return JSONRenderer().render(data, renderer_context=renderer_context)


class MerchantReportExportView(APIView):
    """Export the authenticated merchant's report without persistent report storage."""

    permission_classes = PremiumAnalyticsView.permission_classes
    renderer_classes = (JSONRenderer, PDFDownloadRenderer)

    def get(self, request):
        """Validate the bounded selection and return a private PDF attachment."""
        query = ReportExportQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        content, filename = ReportPDFService.get_pdf(
            request.user, values["report_period"], interval=values["interval"],
        )
        response = FileResponse(BytesIO(content), as_attachment=True, filename=filename, content_type="application/pdf")
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
