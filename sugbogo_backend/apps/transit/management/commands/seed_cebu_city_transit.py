"""Expose an explicit local-only preview/apply workflow for reviewed route data."""

import json
from pathlib import Path

from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError
from rest_framework.exceptions import APIException

from apps.transit.services.transit_seed_service import TransitSeedService


DEFAULT_DATASET = Path(__file__).resolve().parents[2] / "data" / "cebu_city_reviewed_seed.json"
MAX_DATASET_BYTES = 8 * 1024 * 1024


def unique_object(pairs):
    """Refuse duplicate JSON keys so a review cannot hide overwritten fields."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON object key.")
        result[key] = value
    return result


def reject_nonfinite_constant(value):
    """Reject nonstandard JSON NaN and Infinity rather than coercing review information."""
    raise ValueError("Non-finite JSON constants are not permitted.")


class Command(BaseCommand):
    """Preview a file and refuse writes until all supplied directions are reviewed."""

    help = "Preview reviewed Cebu City routes; --apply writes only to the confirmed isolated database."

    def add_arguments(self, parser):
        """Expose the reviewed file, exact database confirmation and explicit write flag."""
        parser.add_argument("--dataset", default=str(DEFAULT_DATASET))
        parser.add_argument("--confirm-database", required=True)
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        """Read bounded UTF-8 JSON and print a reproducible plan or applied record IDs."""
        try:
            TransitSeedService.validate_database(options["confirm_database"])
            with Path(options["dataset"]).open("rb") as source:
                raw = source.read(MAX_DATASET_BYTES + 1)
            if len(raw) > MAX_DATASET_BYTES:
                raise ValueError("Dataset exceeds the 8 MiB limit.")
            payload = json.loads(
                raw.decode("utf-8-sig"), object_pairs_hook=unique_object,
                parse_constant=reject_nonfinite_constant,
            )
            result = TransitSeedService.seed(
                payload, confirmation=options["confirm_database"], apply=options["apply"],
            )
        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        except (OSError, ValueError, ModelValidationError, IntegrityError) as exc:
            raise CommandError(
                "Cannot read/validate/apply this dataset; no import transaction was committed. "
                f"{type(exc).__name__}"
            ) from exc
        self.stdout.write(json.dumps(result, indent=2))
        self.stderr.write(
            "Reviewed local development data only. "
            + ("Apply completed; existing rows were not overwritten."
               if result["applied"] else "Preview only: no records were written.")
        )
