import json
import os

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand

from apps.business.models import ServiceableBoundary


class Command(BaseCommand):
    help = (
        "One-time seed: loads the Cebu City boundary polygon into the "
        "ServiceableBoundary table, sourced from OCHA/PSA COD-AB data. "
        "Safe to re-run — skips if a row with this PSGC code already exists."
    )

    PSGC_CODE = "072217000"
    NAME = "Cebu City"
    DATA_FILE = os.path.join(
        settings.BASE_DIR, "apps", "business", "data", "cebu_city_boundary.json"
    )

    def handle(self, *args, **options):
        if ServiceableBoundary.objects.filter(SBND_PSGC_CODE=self.PSGC_CODE).exists():
            self.stdout.write(
                self.style.WARNING(
                    f"A boundary for PSGC code {self.PSGC_CODE} already exists. "
                    "Skipping to avoid a duplicate."
                )
            )
            return

        if not os.path.exists(self.DATA_FILE):
            self.stderr.write(
                self.style.ERROR(f"Data file not found: {self.DATA_FILE}")
            )
            return

        # Saved via PowerShell Out-File, which defaults to UTF-16.
        with open(self.DATA_FILE, encoding="utf-16") as f:
            feature = json.load(f)

        geometry = GEOSGeometry(json.dumps(feature["geometry"]), srid=4326)

        boundary = ServiceableBoundary.objects.create(
            SBND_NAME=self.NAME,
            SBND_PSGC_CODE=self.PSGC_CODE,
            SBND_BOUNDARY=geometry,
            SBND_IS_ACTIVE=True,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Loaded boundary for {boundary.SBND_NAME} "
                f"(id={boundary.SBND_ID}, valid={geometry.valid})"
            )
        )