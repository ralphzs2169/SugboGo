from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError
from rest_framework.exceptions import APIException

from apps.business.services.development_business_seed_service import (
    DevelopmentBusinessSeedService,
)


class Command(BaseCommand):
    """Expose the explicitly invoked development listings seeder."""

    help = (
        "Create 15 fictional Cebu City businesses for local Explorer/vouch testing. "
        "Requires DEBUG=True, an active service boundary and complete reputation "
        "configuration. Never replaces existing records or creates engagement."
    )

    def handle(self, *args, **options):
        """Report the committed seed result or a controlled, credential-free error."""
        try:
            result = DevelopmentBusinessSeedService.seed()
        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        except (ModelValidationError, IntegrityError) as exc:
            raise CommandError(
                "Development seed validation or uniqueness check failed; no records were saved."
            ) from exc

        self.stdout.write(self.style.SUCCESS(
            f"Development listings: {result['created']} created, "
            f"{result['reused']} reused (15 total). No engagement was created."
        ))
