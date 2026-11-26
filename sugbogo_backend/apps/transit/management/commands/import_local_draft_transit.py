"""Import draft directions into an explicitly confirmed local development database."""

import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.contrib.gis.geos import Point
from rest_framework.exceptions import APIException

from apps.admin_operations.transit_management.services.jeepney_route_service import JeepneyRouteService
from apps.admin_operations.transit_management.services.route_variant_service import RouteVariantService
from apps.admin_operations.transit_management.services.transit_point_service import TransitPointService
from apps.transit.management.commands.seed_cebu_city_transit import (
    MAX_DATASET_BYTES,
    reject_nonfinite_constant,
    unique_object,
)
from apps.transit.models import JeepneyRoute, JeepneyRouteVariant, RouteTransitPoint, TransitPoint
from apps.transit.serializers.transit_seed_serializers import TransitSeedDatasetSerializer
from apps.transit.services.transit_seed_service import TransitSeedService
from apps.transit.services.transit_spatial_validation_service import TransitSpatialValidationService


class Command(BaseCommand):
    """Back up a local database and import drafts without recording operational approval."""

    help = "Preview or apply draft directions to an explicitly confirmed local DEBUG database."

    def add_arguments(
        self,
        parser,
    ):
        """Require a source, exact database name, and backup destination for writes."""
        parser.add_argument("--dataset", required=True)
        parser.add_argument("--confirm-database", required=True)
        parser.add_argument("--backup-directory")
        parser.add_argument("--pg-dump", default="pg_dump")
        parser.add_argument("--apply", action="store_true")

    @staticmethod
    def _confirm(name):
        """Require DEBUG, local PostGIS configuration, and a loopback server connection."""
        TransitSeedService.validate_database(name, seed_target=False)
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), host(inet_server_addr())")
            actual, address = cursor.fetchone()
        if actual != name or address not in {"127.0.0.1", "::1"}:
            raise CommandError("The actual database connection must be local loopback.")

    @staticmethod
    def _plan(data):
        """Validate all paths first and refuse ambiguous or unrelated direction conflicts."""
        coordinates = {
            point["key"]: Point(
                point["longitude"],
                point["latitude"],
                srid=4326,
            )
            for point in data["points"]
        }
        entries = []
        for route in data["routes"]:
            matches = list(JeepneyRoute.objects.filter(JRT_CODE__iexact=route["code"]))
            if len(matches) > 1 or (matches and matches[0].JRT_CODE != route["code"]):
                raise CommandError(f"Ambiguous existing route code {route['code']}.")
            for item in route["variants"]:
                geometry = TransitSeedService._validate_geometry(
                    item,
                    coordinates,
                )
                existing = list(
                    JeepneyRouteVariant.objects.filter(JRT_ID__JRT_CODE=route["code"]),
                )
                exact = [
                    variant
                    for variant in existing
                    if variant.JRV_GEOMETRY.equals_exact(geometry, 0)
                ]
                if len(exact) > 1:
                    raise CommandError(f"Duplicate existing geometry for {item['key']}.")
                if exact:
                    members = list(
                        exact[0].route_transit_points.order_by("RVTP_SEQUENCE")
                        .select_related("TRPT_ID"),
                    )
                    if (
                        [member.RVTP_SEQUENCE for member in members] != list(range(1, len(members) + 1))
                        or len(members) != len(item["point_keys"])
                        or any(
                            not member.TRPT_ID.TRPT_POINT.equals_exact(coordinates[key], 0)
                            for member, key in zip(members, item["point_keys"])
                        )
                        or exact[0].JRV_ORIGIN_ID_id != members[0].TRPT_ID_id
                        or exact[0].JRV_DESTINATION_ID_id != members[-1].TRPT_ID_id
                    ):
                        raise CommandError(f"Existing endpoints differ for {item['key']}.")
                entry = {
                    "code": route["code"],
                    "source": item,
                    "geometry": geometry,
                    "existing": exact[0] if exact else None,
                }
                entries.append(entry)
        return entries

    @staticmethod
    def _backup(
        directory,
        executable,
    ):
        """Create a full recoverable archive before changing any transit records."""
        config = connection.settings_dict
        environment = os.environ.copy()
        environment["PGPASSWORD"] = config["PASSWORD"]
        environment["PGHOST"] = config["HOST"]
        environment["PGPORT"] = str(config["PORT"])
        environment["PGUSER"] = config["USER"]
        archive = directory / "database.dump"
        subprocess.run(
            [executable, "--format=custom", "--file", str(archive), "--dbname", config["NAME"]],
            env=environment,
            check=True,
            capture_output=True,
        )
        if not archive.exists() or archive.stat().st_size == 0:
            raise CommandError("Database backup is empty.")
        for model in (JeepneyRoute, JeepneyRouteVariant, TransitPoint, RouteTransitPoint):
            with (directory / f"{model._meta.model_name}.json").open("w", encoding="utf-8") as output:
                serializers.serialize("json", model.objects.order_by("pk"), stream=output)

    @staticmethod
    def _register(
        entries,
        points,
    ):
        """Reuse exact paths and create validated directions through route-authoring services."""
        directions = []
        for entry in entries:
            code = entry["code"]
            item = entry["source"]
            existing = entry["existing"]
            if existing is None:
                for key in item["point_keys"]:
                    if key not in points:
                        raise CommandError("Source points were not prepared.")
                route = JeepneyRoute.objects.filter(JRT_CODE=code).first()
                if route is None:
                    route = JeepneyRouteService.create_route({"code": code})
                ordered = [points[key] for key in item["point_keys"]]
                existing = RouteVariantService.create_variant({
                    "JRT_ID": route,
                    "JRV_ORIGIN_ID": ordered[0],
                    "JRV_DESTINATION_ID": ordered[-1],
                    "ordered_transit_points": ordered,
                    "geometry": item["geometry"],
                })
            if existing.JRV_GEOMETRY.hexewkb.decode() != entry["geometry"].hexewkb.decode():
                raise CommandError("Stored ordered geometry differs from source.")
            directions.append({
                "route_code": code,
                "source_key": item["key"],
                "source_ids": item["source_ids"],
                "review": item["review"],
                "variant_id": existing.pk,
                "geometry_sha256": hashlib.sha256(bytes(existing.JRV_GEOMETRY.ewkb)).hexdigest(),
            })
        return directions

    def handle(
        self,
        *args,
        **options,
    ):
        """Verify the local target, preserve the source, and atomically register every direction."""
        try:
            self._confirm(options["confirm_database"])
            with Path(options["dataset"]).open("rb") as source:
                raw = source.read(MAX_DATASET_BYTES + 1)
            if len(raw) > MAX_DATASET_BYTES:
                raise CommandError("Dataset exceeds the 8 MiB limit.")
            payload = json.loads(
                raw.decode("utf-8-sig"),
                object_pairs_hook=unique_object,
                parse_constant=reject_nonfinite_constant,
            )
            serializer = TransitSeedDatasetSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            entries = self._plan(data)
            if not options["apply"]:
                self.stdout.write(json.dumps({
                    "database": options["confirm_database"],
                    "route_codes": len(data["routes"]),
                    "directions": len(entries),
                    "reuse": sum(entry["existing"] is not None for entry in entries),
                    "applied": False,
                }, indent=2))
                return
            if not options["backup_directory"]:
                raise CommandError("--backup-directory is required with --apply.")
            directory = Path(options["backup_directory"]) / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            directory.mkdir(parents=True, exist_ok=False)
            (directory / "source.json").write_bytes(raw)
            self._backup(directory, options["pg_dump"])
            with transaction.atomic():
                self._confirm(options["confirm_database"])
                TransitSpatialValidationService.lock_network()
                entries = self._plan(data)
                points = {}
                for point in data["points"]:
                    matches = list(TransitPoint.objects.filter(
                        TRPT_NAME=point["name"],
                        TRPT_POINT=Point(
                            point["longitude"], point["latitude"], srid=4326,
                        ),
                    ))
                    if len(matches) > 1:
                        raise CommandError(f"Ambiguous source point {point['key']}.")
                    if matches:
                        points[point["key"]] = matches[0]
                    else:
                        points[point["key"]] = TransitPointService.create_transit_point(point)
                directions = self._register(entries, points)
                receipt = {
                    "database": options["confirm_database"],
                    "dataset_id": data["dataset_id"],
                    "source_sha256": hashlib.sha256(raw).hexdigest(),
                    "directions": directions,
                    "applied": True,
                }
                (directory / "receipt.json").write_text(
                    json.dumps(receipt, indent=2, default=str),
                    encoding="utf-8",
                )
            self.stdout.write(json.dumps({
                "database": options["confirm_database"],
                "route_codes": len(data["routes"]),
                "directions": len(directions),
                "backup": str(directory),
                "applied": True,
            }, indent=2))
        except (OSError, ValueError, APIException, subprocess.CalledProcessError) as error:
            raise CommandError(f"Draft import failed: {type(error).__name__}: {error}") from error
