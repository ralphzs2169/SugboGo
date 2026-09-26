import json
from io import StringIO
from unittest.mock import patch

from django.core.management import CommandError, call_command
from django.test import SimpleTestCase, override_settings

from apps.reviews.evaluation.review_insights_evaluator import (
    evaluate_generated_insights,
    evaluate_sentiment,
    load_dataset,
    validate_insight_dataset,
    validate_sentiment_dataset,
)


class SentimentEvaluatorTests(SimpleTestCase):
    def test_reports_accuracy_routing_language_breakdown_and_failures(self):
        cases = [
            {
                "id": "one",
                "language": "english",
                "text": "one",
                "expected_label": "positive",
                "expected_route": "vader",
                "notes": "",
            },
            {
                "id": "two",
                "language": "cebuano",
                "text": "two",
                "expected_label": "negative",
                "expected_route": "local",
                "notes": "",
            },
            {
                "id": "three",
                "language": "mixed",
                "text": "three",
                "expected_label": "neutral",
                "expected_route": "local",
                "notes": "",
            },
        ]
        predictions = {
            "one": (0.8, "Positive", "vader"),
            "two": (-0.7, "Negative", "local-model"),
            "three": (0.4, "Positive", "vader"),
        }

        result = evaluate_sentiment(cases, classifier=predictions.__getitem__)

        self.assertEqual(result["accuracy"], 0.6667)
        self.assertEqual(result["routing_accuracy"], 0.6667)
        self.assertEqual(result["by_language"]["cebuano"]["accuracy"], 1.0)
        self.assertEqual(result["confusion_matrix"]["neutral"]["positive"], 1)
        self.assertEqual([failure["id"] for failure in result["failures"]], ["three"])

    def test_model_error_is_recorded_as_an_incorrect_case(self):
        cases = [{
            "id": "broken",
            "language": "english",
            "text": "broken",
            "expected_label": "negative",
            "expected_route": "vader",
            "notes": "",
        }]

        def classifier(_text):
            raise RuntimeError("model unavailable")

        result = evaluate_sentiment(cases, classifier=classifier)

        self.assertEqual(result["completed_count"], 0)
        self.assertEqual(result["accuracy"], 0.0)
        self.assertEqual(result["error_count"], 1)
        self.assertEqual(result["failures"][0]["predicted"], None)


class GeneratedInsightEvaluatorTests(SimpleTestCase):
    def test_scores_theme_quality_and_preserves_narrative_evidence_for_review(self):
        scenario = {
            "id": "scenario",
            "title": "Scenario",
            "reviews": [
                {"id": 1, "text": "Friendly staff."},
                {"id": 2, "text": "The staff were friendly."},
                {"id": 3, "text": "Service was slow."},
                {"id": 4, "text": "We waited a long time."},
                {"id": 5, "text": "The meal was okay."},
            ],
            "expected_themes": [
                {
                    "name": "friendly service",
                    "aliases": ["friendly staff", "friendly service"],
                    "supporting_review_ids": [1, 2],
                },
                {
                    "name": "long wait",
                    "aliases": ["long wait", "slow service"],
                    "supporting_review_ids": [3, 4],
                },
            ],
            "forbidden_themes": [
                {"name": "parking", "aliases": ["parking"]},
            ],
            "expected_facts": ["Staff are friendly."],
            "forbidden_claims": ["Parking is available."],
        }

        def generator(_reviews):
            return json.dumps({
                "narrative": "Visitors mention friendly staff and slow service.",
                "narrative_review_ids": [1, 3],
                "tags": [
                    {"text": "friendly staff", "count": 2, "review_ids": [1, 3]},
                    {"text": "parking", "count": 2, "review_ids": [4, 5]},
                ],
            })

        result = evaluate_generated_insights([scenario], generator=generator)
        evaluated = result["results"][0]

        self.assertEqual(result["keyword_precision"], 0.5)
        self.assertEqual(result["keyword_recall"], 0.5)
        self.assertEqual(result["keyword_f1"], 0.5)
        self.assertEqual(result["forbidden_theme_hit_count"], 1)
        self.assertEqual(result["evidence_issue_count"], 1)
        self.assertEqual(evaluated["missing_expected_themes"], ["long wait"])
        self.assertEqual(
            [item["review_id"] for item in evaluated["narrative_evidence"]],
            [1, 3],
        )

    def test_invalid_provider_result_is_reported_without_stopping_other_scenarios(self):
        scenarios = [
            {
                "id": "bad",
                "title": "Bad",
                "reviews": [{"id": index, "text": "review"} for index in range(1, 6)],
                "expected_themes": [],
                "forbidden_themes": [],
                "expected_facts": [],
                "forbidden_claims": [],
            },
        ]

        result = evaluate_generated_insights(scenarios, generator=lambda _: "bad")

        self.assertEqual(result["completed_count"], 0)
        self.assertEqual(result["error_count"], 1)
        self.assertEqual(result["errors"][0]["error_type"], "InvalidKeywordResponse")

    def test_repeated_runs_report_keyword_theme_stability(self):
        scenario = {
            "id": "stable",
            "title": "Stable",
            "reviews": [
                {"id": index, "text": "Friendly staff."}
                for index in range(1, 6)
            ],
            "expected_themes": [{
                "name": "friendly service",
                "aliases": ["friendly staff"],
                "supporting_review_ids": [1, 2, 3, 4, 5],
            }],
            "forbidden_themes": [],
            "expected_facts": ["Staff are friendly."],
            "forbidden_claims": [],
        }

        def generator(_reviews):
            return json.dumps({
                "narrative": "Visitors consistently mention friendly staff.",
                "narrative_review_ids": [1, 2],
                "tags": [{
                    "text": "friendly staff",
                    "count": 5,
                    "review_ids": [1, 2, 3, 4, 5],
                }],
            })

        result = evaluate_generated_insights(
            [scenario],
            generator=generator,
            repeat_count=3,
        )

        self.assertEqual(result["requested_run_count"], 3)
        self.assertEqual(result["completed_count"], 3)
        self.assertEqual(result["keyword_theme_stability"], 1.0)
        self.assertEqual(
            [item["run_number"] for item in result["results"]],
            [1, 2, 3],
        )


class EvaluationDatasetTests(SimpleTestCase):
    def test_bundled_sentiment_dataset_is_valid_and_balanced_by_language(self):
        cases = load_dataset("sentiment_cases.json")
        validate_sentiment_dataset(cases)

        languages = {case["language"] for case in cases}
        labels = {case["expected_label"] for case in cases}
        self.assertEqual(languages, {"english", "filipino", "cebuano", "mixed"})
        self.assertEqual(labels, {"positive", "neutral", "negative"})
        self.assertGreaterEqual(len(cases), 30)

    def test_bundled_insight_scenarios_have_valid_recurring_evidence(self):
        scenarios = load_dataset("insight_scenarios.json")
        validate_insight_dataset(scenarios)

        self.assertGreaterEqual(len(scenarios), 2)
        for scenario in scenarios:
            self.assertGreaterEqual(len(scenario["reviews"]), 5)


class EvaluateReviewInsightsCommandTests(SimpleTestCase):
    @patch(
        "apps.reviews.management.commands.evaluate_review_insights."
        "evaluate_sentiment"
    )
    def test_default_command_runs_sentiment_without_live_gemini(self, sentiment):
        sentiment.return_value = {
            "case_count": 32,
            "completed_count": 32,
            "error_count": 0,
            "accuracy": 0.75,
            "macro_f1": 0.72,
            "routing_accuracy": 0.9,
            "by_language": {
                "cebuano": {"total": 8, "correct": 5, "accuracy": 0.625},
            },
            "failures": [],
        }
        output = StringIO()

        call_command("evaluate_review_insights", stdout=output)

        self.assertIn("Accuracy: 75.00%", output.getvalue())
        self.assertNotIn("Live generated-insight evaluation", output.getvalue())

    @override_settings(GEMINI_API_KEY="")
    def test_live_evaluation_requires_configured_key(self):
        with self.assertRaisesMessage(CommandError, "GEMINI_API_KEY is required"):
            call_command(
                "evaluate_review_insights",
                skip_sentiment=True,
                include_live_gemini=True,
            )
