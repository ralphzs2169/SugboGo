import json

from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError
from rest_framework.exceptions import APIException

from apps.transit.services.development_transit_seed_service import DevelopmentTransitSeedService


class Command(BaseCommand):
    """Preview or explicitly apply synthetic direct-route fixtures in an isolated database."""

    help = (
        "Preview fictional direct-transit fixtures. Writes require --apply, "
        "DEBUG=True, local PostGIS, and a confirmed sugbogo_transit_dev/test_ database."
    )

    def add_arguments(self, parser):
        """Require an exact database confirmation and opt-in writes."""
        parser.add_argument("--confirm-database", required=True)
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        """Print scenarios and IDs without exposing credentials or changing routing logic."""
        try:
            result = DevelopmentTransitSeedService.seed(
                confirmation=options["confirm_database"],
                apply=options["apply"],
            )
        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        except (ModelValidationError, IntegrityError) as exc:
            raise CommandError(
                "Baseline validation or uniqueness check failed; the transaction was rolled back."
            ) from exc
        self.stdout.write(json.dumps(result, indent=2))
        self.stdout.write(
            "SYNTHETIC DEVELOPMENT DATA ONLY. "
            + ("Fixtures applied; existing records were not overwritten."
               if result["applied"] else "Preview only: no rows written; collisions are checked on apply.")
        )
