"""PDF content, fidelity, pagination, resource limits and safe report composition."""

from io import BytesIO
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from pypdf import PdfReader
from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.business.services.tests.discovery_source_fixtures import DiscoverySourceCollection
from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.reviews.services.business_review_insights_service import BusinessReviewInsightsService

from ..merchant_report_service import MerchantReportService
from ..report_pdf_service import ReportPDFService as PDF, ReportExportUnavailable, _BoundedDocument, _RENDER_LOCK
from .peer_fixtures import PeerAnalyticsFixtures


class ReportPDFServiceTests(PeerAnalyticsFixtures, TestCase):
    def test_expanded_pdf_preserves_sources_timing_vouches_and_actionable_backlog(self):
        """Keep new report observations scoped and their semantic limitations visible."""
        self.event("PROFILE_VISIT", 1, self.period.start)
        self.documents[-1]["discovery_source"] = "MAP"
        self.event("PROFILE_VISIT", 2, self.period.start)
        self.support(self.business_a, self.tags[0])
        self.review(self.NOW - timedelta(days=8))
        payload = self.report()
        sections = payload["export_sections"]
        self.assertEqual(sections["discovery_sources"]["profile_visits"], 2)
        unknown = next(
            row for row in sections["discovery_sources"]["sources"]
            if row["source"] == "UNKNOWN"
        )
        self.assertEqual(unknown["count"], 1)
        self.assertEqual(sections["profile_timing"]["total_profile_visits"], 2)
        self.assertIsNone(sections["route_planning"]["total_requests"])
        self.assertEqual(sections["unanswered_reviews"]["days_7_plus"], 1)
        for name in ("discovery_sources", "route_planning", "profile_timing"):
            self.assertEqual(sections[name]["meta"]["period"]["start"], self.period.start.isoformat())
            self.assertEqual(sections[name]["meta"]["period"]["end_exclusive"], self.period.end.isoformat())
        text = self.text(PDF.render(payload))
        for expected in (
            "Where profile visits came from",
            "Route-planning activity",
            "Recorded profile-visit timing",
            "current age distribution",
            "Vouches added - still valid today",
            "+1 vs previous period",
            "Source not recorded",
            "not confirmed journeys or arrivals",
            "not establish busiest hours",
        ):
            self.assertIn(expected, text)
        self.assertNotIn("+1.00 %", text)

    def setUp(self):
        """Use read-only synthetic stores for the additional export report sources."""
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

    def report(self):
        return PDF.get_report(self.merchant_a, self.period)

    def text(self, content):
        return "\n".join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)

    def test_owned_report_is_calculated_once_and_pdf_retains_sections_versions_and_cutoff(self):
        self.event("PROFILE_VISIT", 1, self.period.start)
        with patch.object(MerchantReportService, "get_report", wraps=MerchantReportService.get_report) as calculate:
            content, filename = PDF.get_pdf(self.merchant_a, self.period, interval="weekly")
        calculate.assert_called_once_with(self.merchant_a, self.period, interval="weekly")
        self.assertTrue(content.startswith(b"%PDF-"))
        self.assertTrue(filename.endswith(f"-{self.period.start_date}-{self.period.end_date}.pdf"))
        text = self.text(content)
        for expected in (self.business_a.BUSN_NAME, self.NOW.isoformat(), "Report / policy version",
                         "Your business report", "Discovery activity", "Pocket activity", "Current specialty totals",
                         "Stored review summary", "Reviews and your responses", "Anonymous peer comparisons",
                         "How to read this report", "Source and availability notes", "Page 1"):
            self.assertIn(expected, text)

    def test_unavailable_observations_nulls_and_insufficient_peers_are_explicit(self):
        with patch.object(VisibilityEventService, "_get_collection", side_effect=VisibilityTrackingUnavailable()):
            report = self.report()
        content = PDF.render(report)
        text = self.text(content)
        self.assertIn("Not available", text)
        self.assertIn("Too few eligible businesses", text)
        self.assertIn("Tracking coverage is unverified", text)
        self.assertIn("unavailable", text)
        self.assertIsNone(report["results"]["standard"]["profile_visits"])

    def test_healthy_zero_is_distinct_from_unavailable_value(self):
        payload = self.report()
        self.assertEqual(payload["results"]["standard"]["profile_visits"], 0)
        text = self.text(PDF.render(payload))
        self.assertIn("Profile visits\n0", text)
        self.assertIn("No recorded entries", text)

    def test_first_page_explains_period_and_current_totals_without_schema_or_rule_codes(self):
        payload = self.report()
        first_page = PdfReader(BytesIO(PDF.render(payload))).pages[0].extract_text()
        for label in ("During your selected dates", "At the time this report was prepared",
                      "Pocket save events", "Published reviews waiting for a reply", "What needs your attention"):
            self.assertIn(label, first_page)
        for code in ("VISIBILITY_COVERAGE_UNVERIFIED", "INSUFFICIENT_SENTIMENT", "results /", "Field"):
            self.assertNotIn(code, first_page)

    def test_sparse_buckets_do_not_invent_zeros_or_growth_and_percentages_keep_precision(self):
        payload = self.report()
        metrics = payload["results"]["premium"]["visibility"]["metrics"]
        metrics["profile_visits"]["series"] = [{"date": "2026-10-01", "start": "2026-09-30T16:00:00+00:00",
                                                "end_exclusive": "2026-10-01T16:00:00+00:00", "value": 3}]
        metrics["distinct_profile_visitors"]["series"] = None
        payload["results"]["premium"]["review_performance"]["current"]["reply_rate"] = 12.34
        text = self.text(PDF.render(payload))
        self.assertIn("12.34%", text)
        self.assertIn("Missing rows do not prove zero activity", text)
        self.assertIn("Missing series have not been replaced with zeros", text)
        self.assertNotIn("coverage_unverified", text)
        self.assertNotIn("UNANSWERED_REVIEWS", text)

    def test_business_text_is_escaped_and_unsupported_unicode_is_visible(self):
        payload = self.report()
        payload["business"]["name"] = 'Peña <img src="https://example.invalid/private"> & 中 😀'
        text = self.text(PDF.render(payload))
        self.assertIn("Peña", text)
        self.assertIn('<img src="https://example.invalid/private">', text)
        self.assertIn("[U+4E2D]", text)
        self.assertIn("[U+1F600]", text)

    def test_insufficient_sentiment_suppresses_percentages_and_stored_content_gate_is_respected(self):
        payload = self.report()
        cohort = payload["results"]["premium"]["review_performance"]["current"]
        cohort["has_sufficient_sentiment_data"] = False
        cohort["sentiment"]["positive"] = {"count": 1, "percentage": 91.23}
        payload["results"]["premium"]["review_insights"]["stored_summary"] = {
            "state": "outdated", "state_message": "Summary awaits refresh.", "content_available": False,
            "narrative": "HIDDEN_NARRATIVE", "frequent_mentions": [{"label": "HIDDEN_MENTION", "count": 9}],
            "analyzed_review_count": 3, "eligible_review_count": 4, "is_sampled": True,
        }
        text = self.text(PDF.render(payload))
        self.assertNotIn("91.23%", text)
        self.assertNotIn("HIDDEN_NARRATIVE", text)
        self.assertNotIn("HIDDEN_MENTION", text)
        self.assertIn("Summary awaits refresh", text)

    def test_available_stored_narrative_retains_own_window_sampling_and_policy(self):
        payload = self.report()
        payload["results"]["premium"]["review_insights"]["stored_summary"] = {
            "state": "outdated", "state_message": "Stored summary is outdated; check its original dates.",
            "content_available": True, "narrative": "SYNTHETIC_NARRATIVE <safe>",
            "frequent_mentions": [{"label": "Friendly staff", "count": 3}],
            "analyzed_review_count": 5, "eligible_review_count": 8, "is_sampled": True,
            "coverage_start": "2026-08-01T00:00:00+00:00", "coverage_end": "2026-08-31T00:00:00+00:00",
            "generated_at": "2026-09-01T00:00:00+00:00", "policy": {"generated_version": 7},
        }
        text = self.text(PDF.render(payload))
        for expected in ("SYNTHETIC_NARRATIVE <safe>", "Friendly staff", "01 Aug 2026", "31 Aug 2026",
                         "5 / 8", "Generation policy version\n7", "Stored summary is outdated"):
            self.assertIn(expected, text)

    def test_no_peer_explorer_identity_or_provider_generation_is_added(self):
        peers = self.five_peers()
        with patch.object(BusinessReviewInsightsService, "refresh", side_effect=AssertionError("AI refresh attempted")):
            content, _ = PDF.get_pdf(self.merchant_a, self.period)
        text = self.text(content)
        for peer in peers:
            self.assertNotIn(peer.BUSN_NAME, text)
        for key in ("explorer_id", "installation_id", "peer_ids", "supporting_review_references"):
            self.assertNotIn(key, text)

    def test_long_evidence_cells_and_sections_paginate_without_dropping_end_text(self):
        payload = self.report()
        payload["results"]["premium"]["review_insights"]["measurement_note"] = "Long evidence text. " * 1200 + "FINAL_EVIDENCE_SENTINEL"
        content = PDF.render(payload)
        reader = PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() for page in reader.pages)
        self.assertGreater(len(reader.pages), 2)
        self.assertIn("FINAL_EVIDENCE_SENTINEL", text)
        self.assertTrue(all(page.extract_text().strip() for page in reader.pages))

    def test_row_size_page_and_byte_limits_fail_without_truncated_success(self):
        payload = self.report()
        for owner, name, limit in ((PDF, "MAX_ROWS", 1), (PDF, "MAX_TEXT_CHARACTERS", 50),
                                   (PDF, "MAX_BYTES", 1), (_BoundedDocument, "MAX_PAGES", 1)):
            with self.subTest(limit=name), patch.object(owner, name, limit), self.assertRaises(ValidationError):
                PDF.render(payload)

    def test_busy_renderer_returns_controlled_failure_and_does_not_release_another_requests_lock(self):
        payload = self.report()
        _RENDER_LOCK.acquire()
        try:
            with self.assertRaises(ReportExportUnavailable):
                PDF.render(payload)
            self.assertTrue(_RENDER_LOCK.locked())
        finally:
            _RENDER_LOCK.release()
        self.assertTrue(PDF.render(payload).startswith(b"%PDF-"))
