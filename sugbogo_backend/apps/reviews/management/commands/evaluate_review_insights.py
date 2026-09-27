import json
from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.reviews.evaluation.review_insights_evaluator import (
    dataset_fingerprint,
    evaluate_generated_insights,
    evaluate_sentiment,
    load_dataset,
    validate_insight_dataset,
    validate_sentiment_dataset,
)
from apps.reviews.services.sentiment import (
    ENGLISH_CONFIDENCE_THRESHOLD,
    TAGALOG_MODEL_ID,
    TAGALOG_MODEL_REVISION,
)


class Command(BaseCommand):
    help = (
        "Evaluate multilingual sentiment locally and optionally run live Gemini "
        "narrative and keyword scenarios. No application data is written."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--include-live-gemini",
            action="store_true",
            help="Run the opt-in live Gemini scenarios using the configured key.",
        )
        parser.add_argument(
            "--skip-sentiment",
            action="store_true",
            help="Skip local language routing and sentiment-model evaluation.",
        )
        parser.add_argument(
            "--output",
            type=Path,
            help="Write the complete JSON report to this path.",
        )
        parser.add_argument(
            "--gemini-runs-per-scenario",
            type=int,
            default=1,
            help="Repeat each live scenario to measure keyword-theme stability.",
        )
        parser.add_argument(
            "--fail-under-sentiment-accuracy",
            type=float,
            help="Exit unsuccessfully when sentiment accuracy is below this ratio.",
        )
        parser.add_argument(
            "--fail-under-keyword-f1",
            type=float,
            help="Exit unsuccessfully when live keyword F1 is below this ratio.",
        )

    def handle(self, *args, **options):
        if options["skip_sentiment"] and not options["include_live_gemini"]:
            raise CommandError("Select sentiment evaluation or live Gemini evaluation.")
        if options["gemini_runs_per_scenario"] < 1:
            raise CommandError("Gemini runs per scenario must be at least one.")

        report = {
            "generated_at": datetime.now(UTC).isoformat(),
            "policy": {
                "english_confidence_threshold": ENGLISH_CONFIDENCE_THRESHOLD,
                "tagalog_model": TAGALOG_MODEL_ID,
                "tagalog_model_revision": TAGALOG_MODEL_REVISION,
                "gemini_model": settings.GEMINI_KEYWORD_MODEL,
            },
        }

        if not options["skip_sentiment"]:
            cases = load_dataset("sentiment_cases.json")
            validate_sentiment_dataset(cases)
            report["sentiment"] = evaluate_sentiment(cases)
            report["sentiment"]["dataset_fingerprint"] = dataset_fingerprint(cases)
            self._write_sentiment_summary(report["sentiment"])

        if options["include_live_gemini"]:
            if not settings.GEMINI_API_KEY.strip():
                raise CommandError(
                    "GEMINI_API_KEY is required for --include-live-gemini."
                )
            scenarios = load_dataset("insight_scenarios.json")
            validate_insight_dataset(scenarios)
            report["generated_insights"] = evaluate_generated_insights(
                scenarios,
                repeat_count=options["gemini_runs_per_scenario"],
            )
            report["generated_insights"]["dataset_fingerprint"] = (
                dataset_fingerprint(scenarios)
            )
            self._write_generated_summary(report["generated_insights"])

        if options["output"]:
            output = options["output"].expanduser().resolve()
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            self.stdout.write(f"Report written to {output}")

        self._enforce_thresholds(report, options)

    def _write_sentiment_summary(self, result):
        self.stdout.write(self.style.MIGRATE_HEADING("Sentiment evaluation"))
        self.stdout.write(
            f"Cases: {result['completed_count']}/{result['case_count']} completed"
        )
        self.stdout.write(f"Accuracy: {result['accuracy']:.2%}")
        self.stdout.write(f"Macro F1: {result['macro_f1']:.2%}")
        self.stdout.write(f"Routing accuracy: {result['routing_accuracy']:.2%}")
        for language, values in result["by_language"].items():
            self.stdout.write(
                f"  {language}: {values['correct']}/{values['total']} "
                f"({values['accuracy']:.2%})"
            )
        self.stdout.write(f"Cases needing review: {len(result['failures'])}")
        self.stdout.write(f"Model errors: {result['error_count']}")

    def _write_generated_summary(self, result):
        self.stdout.write(
            self.style.MIGRATE_HEADING("Live generated-insight evaluation")
        )
        self.stdout.write(
            f"Runs: {result['completed_count']}/"
            f"{result['requested_run_count']} completed"
        )
        self.stdout.write(f"Keyword precision: {result['keyword_precision']:.2%}")
        self.stdout.write(f"Keyword recall: {result['keyword_recall']:.2%}")
        self.stdout.write(f"Keyword F1: {result['keyword_f1']:.2%}")
        self.stdout.write(
            f"Keyword-theme stability: {result['keyword_theme_stability']:.2%}"
        )
        self.stdout.write(
            f"Forbidden theme hits: {result['forbidden_theme_hit_count']}"
        )
        self.stdout.write(f"Evidence issues: {result['evidence_issue_count']}")
        self.stdout.write(
            "Narrative faithfulness still requires the human rubric in the JSON report."
        )

    @staticmethod
    def _enforce_thresholds(report, options):
        if report.get("sentiment", {}).get("error_count"):
            raise CommandError("Sentiment evaluation encountered model errors.")
        if report.get("generated_insights", {}).get("error_count"):
            raise CommandError("Live generated-insight evaluation encountered errors.")
        sentiment_threshold = options["fail_under_sentiment_accuracy"]
        if sentiment_threshold is not None:
            if not 0 <= sentiment_threshold <= 1:
                raise CommandError("Sentiment threshold must be between 0 and 1.")
            if report.get("sentiment", {}).get("accuracy", 0) < sentiment_threshold:
                raise CommandError(
                    "Sentiment accuracy is below the requested threshold."
                )

        keyword_threshold = options["fail_under_keyword_f1"]
        if keyword_threshold is not None:
            if not options["include_live_gemini"]:
                raise CommandError(
                    "--fail-under-keyword-f1 requires --include-live-gemini."
                )
            if not 0 <= keyword_threshold <= 1:
                raise CommandError("Keyword threshold must be between 0 and 1.")
            if report["generated_insights"]["keyword_f1"] < keyword_threshold:
                raise CommandError("Keyword F1 is below the requested threshold.")
