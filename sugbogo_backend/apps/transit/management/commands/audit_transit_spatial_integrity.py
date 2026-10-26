import json

from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import ValidationError

from apps.admin_operations.transit_management.services.transit_spatial_audit_service import (
    TransitSpatialAuditService,
)


class Command(BaseCommand):
    """Report legacy route and point spatial issues without writing application data."""

    help = "Audit all transit paths/stops against the configured Cebu City boundary; never repair or delete."

    def add_arguments(self, parser):
        """Offer a nonzero exit code for automated integrity checks."""
        parser.add_argument("--fail-on-errors", action="store_true")

    def handle(self, *args, **options):
        """Print structured issues and fail clearly if boundary setup is unavailable."""
        try:
            result = TransitSpatialAuditService.audit()
        except ValidationError as exc:
            raise CommandError(str(exc.detail)) from exc
        self.stdout.write(json.dumps(result, indent=2))
        if options["fail_on_errors"] and not result["valid"]:
            raise CommandError("Transit spatial audit found issues; no data was changed.")
