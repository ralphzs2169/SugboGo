"""Export actual admin geometry for review instead of tracing the same route twice."""

import json

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import APIException

from apps.transit.services.transit_seed_export_service import TransitSeedExportService


class Command(BaseCommand):
    """Print a selected network subset as JSON without writing files or database rows."""

    help = "Export selected admin-drawn variants as a needs_review JSON draft on stdout."

    def add_arguments(self, parser):
        """Require explicit variant IDs and confirmation of the local source database."""
        parser.add_argument("--variant-id", action="append", required=True, type=int)
        parser.add_argument("--confirm-database", required=True)

    def handle(self, *args, **options):
        """Return JSON on stdout and the mandatory review reminder on stderr."""
        try:
            result = TransitSeedExportService.export(
                options["variant_id"], confirmation=options["confirm_database"],
            )
        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        self.stdout.write(json.dumps(result, indent=2, ensure_ascii=False))
        self.stderr.write("DRAFT ONLY: add sources and complete human review before applying.")
