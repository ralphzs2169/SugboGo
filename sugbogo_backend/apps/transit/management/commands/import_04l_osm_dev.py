"""Import the provisional 04L candidate into the confirmed local test database."""

import json
from pathlib import Path

from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, connection, transaction
from rest_framework.exceptions import APIException

from apps.transit.management.commands.seed_cebu_city_transit import (
    MAX_DATASET_BYTES,
    reject_nonfinite_constant,
    unique_object,
)
from apps.transit.services.development_04l_import_service import (
    Development04LImportService,
    Development04LSeedSerializer,
)
from apps.transit.services.transit_seed_service import TransitSeedService
from apps.transit.services.transit_spatial_validation_service import (
    TransitSpatialValidationService,
)


DATASET = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "04l_osm_candidate.json"
)


class Command(BaseCommand):
    """Preview or import only the bundled unreviewed OSM 04L development candidate."""

    help = "Import provisional OSM 04L into local sugbogo_db with --apply."

    def add_arguments(
        self,
        parser,
    ):
        """Require exact database confirmation and explicit application."""
        parser.add_argument(
            "--confirm-database",
            required=True,
        )
        parser.add_argument(
            "--apply",
            action="store_true",
        )

    def handle(
        self,
        *args,
        **options,
    ):
        """Validate the fixed candidate and reuse transactional seed persistence."""
        try:
            database = TransitSeedService.validate_database(
                options["confirm_database"],
                seed_target=False,
            )
            if database != "sugbogo_db":
                raise CommandError(
                    "This provisional 04L command requires local sugbogo_db.",
                )

            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database()")
                actual_database = cursor.fetchone()[0]
            if actual_database != database:
                raise CommandError(
                    "The connected database differs from the confirmed target.",
                )

            with DATASET.open("rb") as source:
                raw = source.read(MAX_DATASET_BYTES + 1)
            if len(raw) > MAX_DATASET_BYTES:
                raise CommandError("Dataset exceeds the 8 MiB limit.")
            payload = json.loads(
                raw.decode("utf-8-sig"),
                object_pairs_hook=unique_object,
                parse_constant=reject_nonfinite_constant,
            )
            serializer = Development04LSeedSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            if (
                len(data["routes"]) != 1
                or data["routes"][0]["code"] != "04L"
                or len(data["points"]) != 25
            ):
                raise CommandError(
                    "Expected only Route 04L and its 25 OSM Transit Points.",
                )

            variants = data["routes"][0]["variants"]
            variant_keys = {
                variant["key"]
                for variant in variants
            }
            if (
                variant_keys != {
                    "04l-osm-relation-14991302",
                    "04l-osm-relation-14991303",
                }
                or any(
                    variant["review"]["status"] != "needs_review"
                    for variant in variants
                )
            ):
                raise CommandError(
                    "Expected both provisional OSM 04L directions needing review.",
                )

            with transaction.atomic():
                TransitSpatialValidationService.lock_network()
                plan = Development04LImportService.plan(data)
                record_counts = {}
                for label, records in (
                    ("routes", list(plan["routes"].values())),
                    ("transit_points", list(plan["points"].values())),
                    (
                        "directions",
                        [
                            entry["existing"]
                            for entry in plan["variants"]
                        ],
                    ),
                ):
                    create_count = sum(
                        record is None
                        for record in records
                    )
                    record_counts[label] = {
                        "create": create_count,
                        "reuse": len(records) - create_count,
                    }

                preview = TransitSeedService._report(
                    data,
                    plan,
                    database,
                    False,
                )
                if options["apply"]:
                    Development04LImportService.apply(data, plan)
                result = TransitSeedService._report(
                    data,
                    plan,
                    database,
                    options["apply"],
                )
                result["planned_records"] = preview["planned_records"]
                result["renamed_transit_points"] = len(plan["renames"])
                result["record_counts"] = record_counts
                result["provisional"] = True

        except APIException as exc:
            raise CommandError(str(exc.detail)) from exc
        except (
            OSError,
            ValueError,
            ModelValidationError,
            IntegrityError,
        ) as exc:
            raise CommandError(
                f"Cannot import the 04L candidate. No transaction committed: {exc}",
            ) from exc

        self.stdout.write(json.dumps(result, indent=2))
        self.stderr.write(
            "Provisional OSM data requiring operational and licensing review. "
            "Review metadata remains in the candidate dataset.",
        )
