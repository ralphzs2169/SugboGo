"""Check exact evidence support rather than accepting schema-shaped invented advice."""

import json
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.shared.services.gemini_structured_service import GeminiStructuredService, PermanentGenerationError

from ..recommendation_evidence_service import ACTION_OPTIONS
from ..recommendation_provider_service import InvalidRecommendation, RecommendationProviderService


class RecommendationProviderTests(SimpleTestCase):
    def setUp(self):
        self.snapshot = {"candidates": [{
            "action_code": "UNANSWERED_REVIEWS", "evidence_codes": ["UNANSWERED_REVIEWS"],
            "explanations": ACTION_OPTIONS["UNANSWERED_REVIEWS"],
        }]}
        self.item = {
            "action_code": "UNANSWERED_REVIEWS", "evidence_codes": ["UNANSWERED_REVIEWS"],
            "explanation_code": "review_backlog",
        }

    def test_valid_selection_renders_only_server_text(self):
        output = RecommendationProviderService.validate(json.dumps({"recommendations": [self.item]}), self.snapshot)
        self.assertEqual(output[0]["message"], ACTION_OPTIONS["UNANSWERED_REVIEWS"]["review_backlog"])

    def test_rejects_unknown_actions_evidence_and_unrelated_explanations(self):
        for key, value in (
            ("action_code", "GROW_REVENUE"), ("evidence_codes", ["VISIBILITY_COVERAGE_UNVERIFIED"]),
            ("explanation_code", "wait_for_evidence"), ("evidence_codes", []),
            ("evidence_codes", ["UNANSWERED_REVIEWS", "UNANSWERED_REVIEWS"]),
            ("action_code", True), ("action_code", []), ("explanation_code", {}),
        ):
            item = {**self.item, key: value}
            with self.subTest(key=key, value=value), self.assertRaises(InvalidRecommendation):
                RecommendationProviderService.validate({"recommendations": [item]}, self.snapshot)

    def test_rejects_prose_extra_keys_duplicates_empty_and_oversized_outputs(self):
        for payload in (
            {"recommendations": [{**self.item, "message": "Guaranteed 20 percent sales growth"}]},
            {"recommendations": [self.item], "diagnosis": "Bad service"},
            {"recommendations": [self.item, self.item]}, {"recommendations": []},
            {"recommendations": [self.item] * 4}, {"recommendations": None},
            {"recommendations": [None]}, {"recommendations": [{"action_code": "UNANSWERED_REVIEWS"}]},
            "not json", None, [],
        ):
            with self.subTest(payload=payload), self.assertRaises(InvalidRecommendation):
                RecommendationProviderService.validate(payload, self.snapshot)

    def test_disclosure_alone_cannot_authorize_performance_advice(self):
        snapshot = {"candidates": [], "finding_codes": ["VISIBILITY_COVERAGE_UNVERIFIED"]}
        with self.assertRaises(InvalidRecommendation):
            RecommendationProviderService.validate({"recommendations": [self.item]}, snapshot)

    def test_provider_receives_only_the_explicit_snapshot_and_structured_contract(self):
        with patch("apps.shared.services.gemini_structured_service.GeminiStructuredService.generate",
                   return_value=(json.dumps({"recommendations": [self.item]}), {"total_tokens": 25})) as provider:
            output, usage = RecommendationProviderService.generate(deepcopy(self.snapshot))
        self.assertEqual(provider.call_args.kwargs["evidence"], self.snapshot)
        self.assertEqual(output[0]["action_code"], "UNANSWERED_REVIEWS")
        self.assertEqual(usage["total_tokens"], 25)

    def test_candidate_selection_preserves_provider_order_without_inventing_priorities(self):
        snapshot = {"candidates": [
            {"action_code": code, "evidence_codes": [code], "explanations": options}
            for code, options in ACTION_OPTIONS.items()
        ]}
        items = [{"action_code": item["action_code"], "evidence_codes": item["evidence_codes"],
                  "explanation_code": next(iter(item["explanations"]))} for item in reversed(snapshot["candidates"])]
        result = RecommendationProviderService.validate({"recommendations": items}, snapshot)
        self.assertEqual([item["action_code"] for item in result], [item["action_code"] for item in items])


class GeminiStructuredTransportTests(SimpleTestCase):
    @override_settings(GEMINI_API_KEY="")
    def test_missing_configuration_fails_without_initializing_client(self):
        with patch("google.genai.Client") as client:
            with self.assertRaisesMessage(PermanentGenerationError, "provider_not_configured"):
                GeminiStructuredService.generate(model="fixture", instruction="fixture", evidence={}, schema={})
        client.assert_not_called()

    @override_settings(GEMINI_API_KEY="synthetic-credential", GEMINI_TIMEOUT_SECONDS=20)
    def test_transport_passes_structured_options_and_records_usage_without_echoing_credentials(self):
        response = SimpleNamespace(
            text='{"recommendations": []}',
            usage_metadata=SimpleNamespace(prompt_token_count=10, candidates_token_count=5, total_token_count=15),
        )
        with patch("google.genai.Client") as client:
            client.return_value.__enter__.return_value.models.generate_content.return_value = response
            raw, usage = GeminiStructuredService.generate(
                model="fixture", instruction="fixture", evidence={"aggregate": 2}, schema={"type": "object"},
            )
        self.assertEqual(json.loads(raw), {"recommendations": []})
        self.assertEqual(usage["total_tokens"], 15)
        self.assertNotIn("synthetic-credential", str(usage))
        options = client.call_args.kwargs["http_options"]
        self.assertEqual(options.timeout, 20000)
        self.assertEqual(options.retry_options.attempts, 1)
