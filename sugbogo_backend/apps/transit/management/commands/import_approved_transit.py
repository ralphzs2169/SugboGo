"""Explicitly preview or apply release-approved transit data without replacing rows."""

import hashlib
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError as ModelValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, connection, transaction
from rest_framework.exceptions import APIException

from apps.transit.management.commands.seed_cebu_city_transit import (
    MAX_DATASET_BYTES,
    reject_nonfinite_constant,
    unique_object,
)
from apps.transit.serializers.transit_seed_serializers import TransitSeedDatasetSerializer
from apps.transit.services.transit_seed_service import TransitSeedService
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService


def file_digest(path):
    """Hash a backup in bounded chunks rather than loading it into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Command(BaseCommand):
    """Require explicit target, approval, preview and backup confirmation for release writes."""

    help = "Preview release-approved transit data; writes require explicit --apply authorization."

    def add_arguments(
        self,
        parser,
    ):
        """Expose explicit inputs without deployment hooks or environment-based activation."""
        for name in (
            "dataset",
            "dataset-sha256",
            "confirm-database",
            "confirm-host",
            "confirm-port",
        ):
            parser.add_argument(f"--{name}", required=True)
        parser.add_argument("--expected-variants", type=int, default=71)
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--approval-reference")
        parser.add_argument("--confirm-plan-sha256")
        parser.add_argument("--backup-file")
        parser.add_argument("--backup-manifest")
        parser.add_argument("--pg-restore", default="pg_restore")
        parser.add_argument("--receipt")

    @staticmethod
    def target(
        options,
    ):
        """Confirm configured PostGIS identity before opening any database connection."""
        config = connection.settings_dict
        target = {
            "database": options["confirm_database"],
            "host": options["confirm_host"],
            "port": str(options["confirm_port"]),
        }
        if (
            settings.DEBUG
            or config.get("ENGINE") != "django.contrib.gis.db.backends.postgis"
            or target["database"] != str(config.get("NAME", ""))
            or target["host"] != str(config.get("HOST", ""))
            or target["port"] != str(config.get("PORT") or "5432")
            or not all(target.values())
        ):
            raise CommandError("Requires DEBUG=False, PostGIS and exact database/host/port confirmation.")
        return target

    @staticmethod
    def read_dataset(
        options,
    ):
        """Pin approval to exact source bytes while preserving every review field."""
        with Path(options["dataset"]).open("rb") as source:
            raw = source.read(MAX_DATASET_BYTES + 1)
        if len(raw) > MAX_DATASET_BYTES:
            raise CommandError("Dataset exceeds the 8 MiB limit.")
        digest = hashlib.sha256(raw).hexdigest()
        if digest != options["dataset_sha256"].lower():
            raise CommandError("Dataset SHA-256 mismatch.")
        payload = json.loads(
            raw.decode("utf-8-sig"),
            object_pairs_hook=unique_object,
            parse_constant=reject_nonfinite_constant,
        )
        serializer = TransitSeedDatasetSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        variants = [
            variant
            for route in data["routes"]
            for variant in route["variants"]
        ]
        if not variants or len(variants) != options["expected_variants"]:
            raise CommandError("Direction count differs from the approved expectation.")
        if any(variant["review"]["status"] == "excluded" for variant in variants):
            raise CommandError("Excluded directions cannot be released.")
        return raw, data

    @staticmethod
    def verify_backup(
        options,
        target,
    ):
        """Check target binding, restore-test attestation, freshness, hash and full archive readability."""
        path = Path(options["backup_file"])
        manifest = json.loads(
            Path(options["backup_manifest"]).read_text(encoding="utf-8-sig"),
        )
        verified = datetime.fromisoformat(manifest["restore_verified_at"])
        created = datetime.fromisoformat(manifest["created_at"])
        now = datetime.now(timezone.utc)
        if (
            any(str(manifest.get(key, "")) != value for key, value in target.items())
            or manifest.get("restore_verified") is not True
            or not manifest.get("verified_by", "").strip()
            or created.tzinfo is None
            or verified.tzinfo is None
            or not now - timedelta(hours=24) <= created <= verified <= now
            or not path.is_file()
            or path.stat().st_size == 0
            or file_digest(path) != manifest.get("sha256")
        ):
            raise CommandError("Backup must match the target, hash and a restore test within 24 hours.")
        subprocess.run(
            [options["pg_restore"], "--file=-", str(path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=True,
            timeout=600,
        )
        return manifest

    @staticmethod
    def preview(
        data,
        target,
    ):
        """Use a repeatable, server-enforced read-only transaction to build the conflict-checked plan."""
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
                )
                cursor.execute("SET LOCAL statement_timeout = '30s'")
                cursor.execute("SELECT current_database()")
                if cursor.fetchone()[0] != target["database"]:
                    raise CommandError("Actual connected database differs from confirmation.")
            plan = TransitSeedService._plan(data)
            report = TransitSeedService._report(
                data,
                plan,
                target["database"],
                False,
            )
            report["plan_sha256"] = Command.plan_digest(plan, report)
            return report

    @staticmethod
    def plan_digest(
        plan,
        report,
    ):
        """Bind approval to source metadata, reuse IDs and the proposed create/reuse counts."""
        identity = {
            "report": report,
            "points": {
                key: row.pk if row else None
                for key, row in plan["points"].items()
            },
            "routes": {
                key: row.pk if row else None
                for key, row in plan["routes"].items()
            },
        }
        return hashlib.sha256(json.dumps(
            identity,
            sort_keys=True,
            default=str,
        ).encode()).hexdigest()

    def handle(
        self,
        *args,
        **options,
    ):
        """Preview by default or insert atomically after all independent release gates pass."""
        committed = False
        try:
            target = self.target(options)
            raw, data = self.read_dataset(options)
            if not options["apply"]:
                report = self.preview(data, target)
            else:
                required = (
                    "approval_reference",
                    "confirm_plan_sha256",
                    "backup_file",
                    "backup_manifest",
                    "receipt",
                )
                if any(not str(options.get(key) or "").strip() for key in required):
                    raise CommandError("Apply requires approval reference, preview hash, verified backup and receipt path.")
                backup = self.verify_backup(options, target)
                receipt = Path(options["receipt"])
                # Exclusive source creation refuses reused audit paths before database writes.
                with receipt.with_suffix(receipt.suffix + ".source.json").open("xb") as source:
                    source.write(raw)
                with receipt.open("x", encoding="utf-8") as output:
                    json.dump({"status": "pending", "target": target}, output)
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.execute("SET LOCAL lock_timeout = '10s'")
                        cursor.execute("SET LOCAL statement_timeout = '30s'")
                        cursor.execute("SELECT current_database()")
                        if cursor.fetchone()[0] != target["database"]:
                            raise CommandError("Actual connected database differs from confirmation.")
                    TransitSpatialValidationService.lock_network()
                    with connection.cursor() as cursor:
                        # Also exclude writers that do not participate in the advisory lock.
                        cursor.execute(
                            'LOCK TABLE "TRANSIT_POINT", "JEEPNEY_ROUTE", '
                            '"JEEPNEY_ROUTE_VARIANT", "ROUTE_TRANSIT_POINT" '
                            'IN SHARE ROW EXCLUSIVE MODE',
                        )
                    # A fresh read-only plan cannot be nested in a write transaction.
                    plan = TransitSeedService._plan(data)
                    report = TransitSeedService._report(
                        data,
                        plan,
                        target["database"],
                        False,
                    )
                    digest = self.plan_digest(plan, report)
                    if digest != options["confirm_plan_sha256"]:
                        raise CommandError("The plan changed; run preview again before authorizing apply.")
                    report = TransitSeedService._apply(data, target["database"])
                committed = True
                report.update({
                    "status": "committed",
                    "target": target,
                    "approval_reference": options["approval_reference"],
                    "source_sha256": options["dataset_sha256"],
                    "backup": backup,
                    "source_metadata": data,
                })
                receipt.write_text(
                    json.dumps(report, indent=2, default=str),
                    encoding="utf-8",
                )
            report["source_sha256"] = options["dataset_sha256"]
            self.stdout.write(json.dumps(report, indent=2, default=str))
        except (
            OSError,
            ValueError,
            KeyError,
            APIException,
            ModelValidationError,
            DatabaseError,
            subprocess.SubprocessError,
        ) as error:
            if committed:
                message = "Import committed; receipt/output failed. Reconcile with a read-only preview."
            else:
                message = "Import refused or rolled back; no import transaction committed."
            if isinstance(error, APIException):
                message = f"{message} Validation: {error.detail}"
            elif isinstance(error, ModelValidationError):
                message = f"{message} Validation: {error}"
            raise CommandError(message) from error
