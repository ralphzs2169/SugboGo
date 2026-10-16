"""Keep offline evaluation independent of providers, credentials, and application databases."""

import json
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase

from ...evaluation.recommendation_evaluator import evaluate


class RecommendationEvaluationTests(SimpleTestCase):
    def test_offline_corpus_validates_all_contracts_without_provider_or_database(self):
        with patch("apps.merchant_operations.merchant_analytics.services.recommendation_provider_service.RecommendationProviderService.generate",
                   side_effect=AssertionError("Offline evaluation called provider")):
            report = evaluate()
        self.assertEqual(report["case_count"], 8)
        self.assertEqual(report["passed_contract_cases"], 8)
        self.assertTrue(all(not result["provider_called"] for result in report["results"]))
        self.assertTrue(all(result["human_review"]["factually_supported"] is None for result in report["results"]))

    def test_management_command_outputs_json_without_application_data(self):
        output = StringIO()
        call_command("evaluate_merchant_recommendations", stdout=output)
        self.assertEqual(json.loads(output.getvalue())["passed_contract_cases"], 8)

    def test_live_errors_are_reported_without_raw_provider_details(self):
        with patch("apps.merchant_operations.merchant_analytics.services.recommendation_provider_service.RecommendationProviderService.generate",
                   side_effect=RuntimeError("secret provider response")):
            report = evaluate(include_live_gemini=True)
        self.assertNotIn("secret provider response", str(report))
        self.assertLess(report["passed_contract_cases"], report["case_count"])
