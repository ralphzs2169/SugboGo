"""Private binary downloads with existing merchant, entitlement and validation boundaries."""

from io import BytesIO
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from pypdf import PdfReader
from rest_framework.test import APITestCase

from apps.business.services.visibility_event_service import VisibilityEventService
from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.business.services.tests.discovery_source_fixtures import DiscoverySourceCollection
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from ...services.report_pdf_service import ReportPDFService, ReportExportUnavailable
from ...services.tests.peer_fixtures import PeerAnalyticsFixtures


class ReportExportViewTests(PeerAnalyticsFixtures, APIResponseAssertionsMixin, APITestCase):
    def setUp(self):
        super().setUp()
        collection = DiscoverySourceCollection()
        collection.documents = self.documents
        source = patch.object(
            VisibilityEventService,
            "_get_collection",
            return_value=collection,
        )
        source.start()
        self.addCleanup(source.stop)
        routes = patch.object(
            RoutePlanningEventService,
            "get_totals",
            return_value=(None, None, "route_tracking_not_initialized"),
        )
        routes.start()
        self.addCleanup(routes.stop)
        self.url = reverse("merchant-analytics-premium-report-export")
        self.client.force_authenticate(user=self.merchant_a)
        clock = patch("apps.shared.analytics.date_ranges.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_download_is_private_pdf_attachment_with_owned_content(self):
        response = self.client.get(self.url, {"period": "7"}, HTTP_ACCEPT="application/pdf")
        self.assertEqual(self.url, "/api/merchant/analytics/premium/report/export/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        content = b"".join(response.streaming_content)
        self.assertIn(self.business_a.BUSN_NAME, "\n".join(page.extract_text() for page in PdfReader(BytesIO(content)).pages))
        self.assertNotIn(self.business_b.BUSN_NAME, content.decode("latin-1"))

    @override_settings(MERCHANT_PLUS_ENFORCED=True, MERCHANT_PLUS_MOCK_ENABLED=False)
    def test_plus_denial_is_json_even_when_pdf_is_requested_and_precedes_calculation(self):
        with patch.object(ReportPDFService, "get_pdf") as export:
            response = self.client.get(self.url, HTTP_ACCEPT="application/pdf")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.json()["code"], "PLUS_REQUIRED")
        export.assert_not_called()

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_web_client_can_read_attachment_filename_from_allowed_origin(self):
        with patch.object(ReportPDFService, "get_pdf", return_value=(b"%PDF-test", "safe-report.pdf")):
            response = self.client.get(self.url, HTTP_ORIGIN="http://localhost:5173")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Content-Disposition", response["Access-Control-Expose-Headers"])
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-test")

    @override_settings(MERCHANT_PLUS_ENFORCED=True)
    def test_server_grant_allows_export_with_server_derived_owner(self):
        with patch("apps.merchant_operations.merchant_analytics.entitlements.merchant_has_plus_access", return_value=True), \
             patch.object(ReportPDFService, "get_pdf", return_value=(b"%PDF-test", "test.pdf")) as export:
            response = self.client.get(self.url, {"interval": "weekly"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(export.call_args.args[0], self.merchant_a)
        self.assertEqual(export.call_args.kwargs["interval"], "weekly")
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-test")

    def test_roles_inactive_accounts_and_anonymous_are_denied_before_report_reads(self):
        with patch.object(ReportPDFService, "get_pdf") as export:
            for role, status in (
                (User.UserRole.EXPLORER, User.UserStatus.ACTIVE),
                (User.UserRole.ADMIN, User.UserStatus.ACTIVE),
                (User.UserRole.SUPER_ADMIN, User.UserStatus.ACTIVE),
                (User.UserRole.MERCHANT, User.UserStatus.SUSPENDED),
                (User.UserRole.MERCHANT, User.UserStatus.DISABLED),
            ):
                self.client.force_authenticate(user=User(USER_ID=999, USER_ROLE=role, USER_STATUS=status))
                self.assertEqual(self.client.get(self.url).status_code, 403)
            self.client.force_authenticate(user=None)
            self.assertEqual(self.client.get(self.url).status_code, 401)
            export.assert_not_called()

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_dates_and_overrides_are_strictly_validated_before_export(self):
        with patch.object(ReportPDFService, "get_pdf") as export:
            for query, field in (
                ({"period": "14"}, "period"), ({"period": "custom"}, "start_date"),
                ({"interval": "hourly"}, "interval"), ({"business_id": self.business_b.pk}, "business_id"),
                ({"user_id": self.merchant_b.pk}, "user_id"), ({"plus": "true"}, "plus"),
                ({"period": "custom", "start_date": "2020-01-01", "end_date": "2026-10-01"}, "period"),
                ({"period": "custom", "start_date": "2026-10-10", "end_date": "2026-10-01"}, "period"),
            ):
                with self.subTest(query=query):
                    response = self.client.get(self.url, query, HTTP_ACCEPT="application/pdf")
                    self.assertValidationError(response, field)
                    self.assertEqual(response["Content-Type"], "application/json")
            self.assertValidationError(self.client.get(self.url + "?period=7&period=30"), "period")
            export.assert_not_called()

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_current_custom_dates_preserve_one_clock_and_missing_business_is_not_found(self):
        with patch.object(ReportPDFService, "get_pdf", return_value=(b"%PDF-test", "test.pdf")) as export:
            response = self.client.get(self.url, {"period": "custom", "start_date": "2026-10-01", "end_date": "2026-10-12"})
        self.assertEqual(response.status_code, 200)
        period = export.call_args.args[1]
        self.assertEqual(period.generated_at, self.NOW)
        self.assertEqual(period.start.isoformat(), "2026-09-30T16:00:00+00:00")
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-test")
        self.client.force_authenticate(user=self.user("export-no-business", User.UserRole.MERCHANT))
        self.assertEqual(self.client.get(self.url).status_code, 404)

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_generation_failure_is_json_and_does_not_queue_visibility_or_ai_work(self):
        with patch.object(ReportPDFService, "get_pdf", side_effect=ReportExportUnavailable()), \
             patch.object(VisibilityEventService, "ensure_indexes", side_effect=AssertionError("Index creation")):
            response = self.client.get(self.url, HTTP_ACCEPT="application/pdf")
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["success"])
        self.assertEqual(response["Content-Type"], "application/json")

    @override_settings(MERCHANT_PLUS_ENFORCED=False)
    def test_non_get_methods_are_unsupported(self):
        for method in (self.client.post, self.client.put, self.client.patch, self.client.delete):
            self.assertEqual(method(self.url, {}, format="json").status_code, 405)
