"""Expose explicit local-development analytics fixture planning, application and cleanup."""


# $env:SUGBOGO_ANALYTICS_DEMO_ALLOW = "local-development"

# python -B manage.py seed_merchant_analytics_demo --business-id 9 --allow-remote-development-mongodb --apply --confirm-postgres-database sugbogo_db --confirm-mongodb-database sugbogo --confirm-background-workers-stopped

import json

from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError
from pymongo.errors import PyMongoError
from rest_framework.exceptions import APIException

from ...services.merchant_analytics_demo_seed_service import MerchantAnalyticsDemoSeedService


class Command(BaseCommand):
    """Require a concrete business and keep every invocation read-only unless --apply is supplied."""

    help = "Plan local Merchant Analytics demo data by default; explicitly apply or clean signed seed-owned records."

    def add_arguments(
        self,
        parser,
    ):
        """Keep database and cleanup confirmations separate from the selected business identifier."""
        parser.add_argument("--business-id", type=int, required=True)
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument(
            "--dry-run",
            action="store_true",
            help="Explicit alias for the read-only default.",
        )
        parser.add_argument("--cleanup", action="store_true")
        parser.add_argument("--confirm-cleanup", type=int)
        parser.add_argument("--confirm-postgres-database")
        parser.add_argument("--confirm-mongodb-database")
        parser.add_argument(
            "--allow-remote-development-mongodb",
            action="store_true",
            help="Attest the configured hosted MongoDB is development-only; also confirm its database name.",
        )
        parser.add_argument("--confirm-background-workers-stopped", action="store_true")
        parser.add_argument("--manifest-directory")

    def handle(
        self,
        *args,
        **options,
    ):
        """Print sanitized progress and retain journals after failures instead of claiming cross-store rollback."""
        try:
            result = MerchantAnalyticsDemoSeedService.run(
                business_id=options["business_id"],
                apply=options["apply"],
                cleanup=options["cleanup"],
                confirm_cleanup=options["confirm_cleanup"],
                confirm_postgres_database=options["confirm_postgres_database"],
                confirm_mongodb_database=options["confirm_mongodb_database"],
                workers_stopped=options["confirm_background_workers_stopped"],
                manifest_directory=options["manifest_directory"],
                allow_remote_development_mongodb=options["allow_remote_development_mongodb"],
            )
        except APIException as exc:
            raise CommandError(str(exc.detail)) from None
        except (DatabaseError, PyMongoError, OSError, ModelValidationError) as exc:
            error_type = type(exc).__name__
            raise CommandError(
                f"Analytics demo stopped ({error_type}). No foreign records were intentionally replaced. "
                "A signed journal may remain; inspect the dry run and resume the same operation. "
                "PostgreSQL and MongoDB do not share an atomic transaction."
            ) from None
        self.stdout.write(json.dumps(result, indent=2, sort_keys=True))
