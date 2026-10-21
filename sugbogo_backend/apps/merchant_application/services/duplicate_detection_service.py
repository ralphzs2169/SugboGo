"""Find exact-name business conflicts without changing registration state."""

import hashlib
import json
import unicodedata

from django.conf import settings
from django.contrib.gis.db.models import PointField
from django.contrib.gis.db.models.functions import Distance
from django.db.models.functions import Cast

from apps.business.models import Business
from apps.merchant_application.models import MerchantApplication


def normalize_duplicate_text(value):
    """Normalize case and whitespace while preserving punctuation and branch labels."""
    return " ".join(unicodedata.normalize("NFKC", value or "").casefold().split())


class DuplicateDetectionService:
    """Compare saved applications with submitted applications and permanent businesses."""

    RULE_VERSION = "exact-name-location-v1"

    @staticmethod
    def application_snapshot(application):
        """Read only the identity and location evidence relevant to duplicate matching."""
        identity = getattr(application, "identity", None)
        location = getattr(application, "location", None)
        if identity is None or location is None:
            return None

        required = (
            identity.MIDN_BUSINESS_NAME,
            location.MLOC_PROVINCE,
            location.MLOC_CITY,
            location.MLOC_BARANGAY,
            location.MLOC_STREET_ADDRESS,
            location.MLOC_POINT,
        )
        if not all(required):
            return None

        address = ", ".join(
            part.strip()
            for part in (
                location.MLOC_STREET_ADDRESS,
                location.MLOC_UNIT,
                location.MLOC_BARANGAY,
            )
            if part and part.strip()
        )
        return DuplicateDetectionService._snapshot(
            identity.MIDN_BUSINESS_NAME,
            address,
            location.MLOC_CITY,
            location.MLOC_PROVINCE,
            location.MLOC_POINT,
        )

    @staticmethod
    def _snapshot(
        name,
        address,
        city,
        province,
        point,
    ):
        """Produce comparable evidence for both application and Business locations."""
        return {
            "name": normalize_duplicate_text(name),
            "address": normalize_duplicate_text(address),
            "city": normalize_duplicate_text(city),
            "province": normalize_duplicate_text(province),
            "coordinates": list(point.coords),
        }

    @staticmethod
    def find_candidates(application):
        """Return material matches using geodesic geography distances measured in metres."""
        # Reload relations so stale caller instances and prefetch caches cannot grant clearance.
        application = (
            MerchantApplication.objects
            .select_related("identity", "location")
            .get(pk=application.pk)
        )
        subject = DuplicateDetectionService.application_snapshot(application)
        if subject is None:
            return []

        radius = settings.MERCHANT_DUPLICATE_RADIUS_METRES
        point = application.location.MLOC_POINT
        candidates = []
        applications = (
            MerchantApplication.objects
            .filter(MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED)
            .exclude(pk=application.pk)
            .select_related("identity", "location")
        )
        businesses = (
            Business.objects
            .filter(BUSN_STATUS__in=(
                Business.BusinessStatus.ACTIVE,
                Business.BusinessStatus.SUSPENDED,
            ))
            .select_related("LOCT_ID", "merchant_application")
        )
        if application.BUSN_ID_id:
            businesses = businesses.exclude(pk=application.BUSN_ID_id)

        # Unicode casefolding cannot be delegated to database lower(). Only exact
        # normalized-name matches proceed to the metric distance calculation.
        for candidate in applications.iterator():
            target = DuplicateDetectionService.application_snapshot(candidate)
            if target is None or target["name"] != subject["name"]:
                continue
            distance = DuplicateDetectionService._distance(
                MerchantApplication.objects.filter(pk=candidate.pk),
                "location__MLOC_POINT",
                point,
            )
            result = DuplicateDetectionService._candidate(
                subject,
                target,
                f"application:{candidate.pk}",
                "application",
                candidate.pk,
                candidate.identity.MIDN_BUSINESS_NAME,
                candidate.MAPP_STATUS,
                distance,
                radius,
                display_address=", ".join(
                    part.strip()
                    for part in (
                        candidate.location.MLOC_STREET_ADDRESS,
                        candidate.location.MLOC_UNIT,
                        candidate.location.MLOC_BARANGAY,
                        candidate.location.MLOC_CITY,
                        candidate.location.MLOC_PROVINCE,
                    )
                    if part and part.strip()
                ),
            )
            if result:
                candidates.append(result)

        for business in businesses.iterator():
            if normalize_duplicate_text(business.BUSN_NAME) != subject["name"]:
                continue
            location = business.LOCT_ID
            target = DuplicateDetectionService._snapshot(
                business.BUSN_NAME,
                location.LOCT_ADDRESS,
                location.LOCT_CITY,
                location.LOCT_PROVINCE,
                location.LOCT_POINT,
            )
            origin = getattr(business, "merchant_application", None)
            if origin is not None:
                key = f"application:{origin.pk}"
            else:
                key = f"business:{business.pk}"
            distance = DuplicateDetectionService._distance(
                Business.objects.filter(pk=business.pk),
                "LOCT_ID__LOCT_POINT",
                point,
            )
            result = DuplicateDetectionService._candidate(
                subject,
                target,
                key,
                "business",
                business.pk,
                business.BUSN_NAME,
                business.BUSN_STATUS,
                distance,
                radius,
                display_address=", ".join((
                    location.LOCT_ADDRESS,
                    location.LOCT_CITY,
                    location.LOCT_PROVINCE,
                )),
            )
            if result:
                candidates.append(result)

        # A linked application and Business are one stable candidate lineage.
        return list({candidate["key"]: candidate for candidate in candidates}.values())

    @staticmethod
    def _distance(
        queryset,
        field,
        point,
    ):
        """Cast WGS84 geometry to geography so PostGIS computes spheroidal metres."""
        result = queryset.annotate(
            duplicate_distance=Distance(
                Cast(
                    field,
                    output_field=PointField(srid=4326, geography=True),
                ),
                point,
            ),
        ).values_list("duplicate_distance", flat=True).get()
        return result.m

    @staticmethod
    def _candidate(
        subject,
        target,
        key,
        record_type,
        record_id,
        name,
        status,
        distance,
        radius,
        *,
        display_address,
    ):
        """Build explainable evidence without treating location alone as a conflict."""
        reasons = []
        address_fields = ("address", "city", "province")
        if all(
            subject[field] == target[field]
            for field in address_fields
        ):
            reasons.append("exact_name_and_address")
        if distance <= radius:
            reasons.append("exact_name_and_nearby_location")
        if not reasons:
            return None

        evidence = {
            "subject": subject,
            "candidate": target,
            "rule_version": DuplicateDetectionService.RULE_VERSION,
            "radius_metres": radius,
            "reasons": reasons,
        }
        fingerprint = hashlib.sha256(
            json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode(),
        ).hexdigest()
        return {
            "key": key,
            "record_type": record_type,
            "record_id": record_id,
            "business_name": name,
            "address": display_address,
            "status": status,
            "distance_metres": round(distance, 1),
            "reasons": reasons,
            "evidence": evidence,
            "fingerprint": fingerprint,
        }
