"""Evaluate synthetic recommendation contracts without application data or database writes."""

import json

from django.core.management.base import BaseCommand, CommandError

from ...evaluation.recommendation_evaluator import evaluate


class Command(BaseCommand):
    help = "Evaluate synthetic restricted merchant recommendations; live Gemini is opt-in and consumes quota."
    requires_system_checks = []

    def add_arguments(self, parser):
        """Require an explicit option before sending synthetic fixtures to Gemini."""
        parser.add_argument("--include-live-gemini", action="store_true")

    def handle(self, *args, **options):
        """Print a controlled JSON report and fail when a contract scenario fails."""
        result = evaluate(include_live_gemini=options["include_live_gemini"])
        self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
        if result["passed_contract_cases"] != result["case_count"]:
            raise CommandError("Some recommendation contract scenarios failed; inspect controlled results.")
