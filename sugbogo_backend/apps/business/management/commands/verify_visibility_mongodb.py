"""Read-only MongoDB diagnostics with no credential or raw-document output."""

import json
import warnings

from django.core.management.base import BaseCommand, CommandError
from pymongo.errors import PyMongoError
from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_mongodb_verification_service import VisibilityMongoVerificationService
from apps.shared.analytics.date_ranges import resolve_period


class Command(BaseCommand):
    """Inspect recorded visibility and existing indexes without initializing the store."""

    help = "Read-only Atlas/visibility diagnostics; never creates events, collections or indexes."

    def add_arguments(self, parser):
        """Accept reporting dates, a bounded deadline and optional planner-only inspection."""
        parser.add_argument("--period", choices=("7", "30", "90", "custom"), default="30")
        parser.add_argument("--start-date")
        parser.add_argument("--end-date")
        parser.add_argument("--max-time-ms", type=int, default=15000)
        parser.add_argument("--explain", action="store_true")

    def handle(self, *args, **options):
        """Print only aggregate diagnostics and sanitized driver failure metadata."""
        try:
            period = resolve_period(preset=options["period"], start_date=options["start_date"], end_date=options["end_date"])
            with warnings.catch_warnings(record=True) as recorded:
                warnings.simplefilter("always")
                report = VisibilityMongoVerificationService.inspect(
                    period, explain=options["explain"], max_time_ms=options["max_time_ms"],
                )
            report["warning_categories"] = sorted({warning.category.__name__ for warning in recorded})
        except ValidationError:
            raise CommandError("Invalid reporting dates/deadline or missing MongoDB configuration.") from None
        except PyMongoError as exc:
            # Do not print driver exception text, hosts, credentials or connection strings.
            raise CommandError(f"MongoDB read failed: {type(exc).__name__}; code={getattr(exc, 'code', None)}.") from None
        self.stdout.write(json.dumps(report, indent=2))
