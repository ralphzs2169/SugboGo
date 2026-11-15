from django.conf import settings
from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError
from rest_framework.exceptions import APIException

from apps.business.services.production_demo_seed_service import (
    ProductionDemoSeedService,
)
from apps.business.services.visibility_event_service import VisibilityTrackingUnavailable


class Command(BaseCommand):
    """Expose an opt-in deployed demo seed without enabling development settings."""

    help = (
        "Preview five labeled fictional Cebu businesses with synthetic engagement. "
        "Writes require --apply --confirm-database DB_NAME. Safe to rerun; "
        "Use --enrich-existing to fill missing demo profile details and "
        "--queue-sentiment to request real background rating analysis."
    )

    def add_arguments(
        self,
        parser,
    ):
        """Require explicit write intent and exact database identity for insertion."""
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--confirm-database")
        parser.add_argument(
            "--enrich-existing",
            action="store_true",
            help="Fill missing demo photos, hours and profile details; preserve manual edits.",
        )
        parser.add_argument(
            "--queue-sentiment",
            action="store_true",
            help="Queue real Gemini sentiment analysis for marked demo reviews (provider usage applies).",
        )

    def handle(
        self,
        *args,
        **options,
    ):
        """Print bounded seed results without exposing connection credentials."""
        try:
            result = ProductionDemoSeedService.run(
                apply=options["apply"],
                confirm_database=options["confirm_database"],
                enrich_existing=options["enrich_existing"],
                queue_sentiment=options["queue_sentiment"],
            )
        except VisibilityTrackingUnavailable as exc:
            raise CommandError(
                "Visibility storage is unavailable; all seed inserts were rolled back.",
            ) from exc
        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        except (ModelValidationError, IntegrityError) as exc:
            raise CommandError(
                "Demo validation or uniqueness check failed; no seed changes were saved.",
            ) from exc
        if not options["apply"]:
            self.stdout.write("DRY RUN: no database writes or external calls were made.")
            if options["enrich_existing"]:
                self.stdout.write("Plan: fill missing demo profile details, photos and weekly hours.")
            if options["queue_sentiment"]:
                self.stdout.write("Plan: request sentiment for up to 10 marked demo reviews per business.")
        self.stdout.write(
            f"Demo profiles processed: {result['profiles_completed']}. "
            f"Demo reviews submitted for sentiment: {result['sentiment_requested']}.",
        )
        if options["queue_sentiment"]:
            self.stdout.write(
                "Ratings require running Celery workers and at least five eligible analyzed reviews. "
                "Queueing is not proof of successful analysis; provider usage applies.",
            )
        if not settings.EXPERIMENTAL_BUSINESS_RATINGS_ENABLED:
            self.stdout.write(
                "Star ratings are hidden by EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=False. "
                "This command does not change that setting.",
            )
        self.stdout.write(
            f"Businesses: {result['created']} created, {result['reused']} reused. "
            f"New dataset plan: {result['explorers']} demo explorers, "
            f"{result['vouches_per_business']} synthetic vouches per business.",
        )
        for row in result["rows"]:
            business_id = row.get("business_id")
            if row["existing"] is not None:
                business_id = row["existing"].pk
            self.stdout.write(
                f"{row['name']} | {row['area']} | "
                f"lat={row['point'].y}, lng={row['point'].x} | "
                f"planned reviews={row['reviews']} | id={business_id}",
            )
        self.stdout.write(
            "Demo content is public on business profiles; reviews are excluded from "
            "the community feed. Hidden-gem qualification does not guarantee a top-10 slot.",
        )
