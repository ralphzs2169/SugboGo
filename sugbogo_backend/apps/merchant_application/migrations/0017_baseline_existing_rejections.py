"""Freeze v1 fingerprints for existing rejected applications at rollout."""

import hashlib
import json
from datetime import time

from django.db import migrations


def get_section_fingerprints(application_id, *, registry, using="default"):
    """Fingerprint saved content without row IDs, timestamps, or list order."""
    def records(model_name, filters, fields):
        """Read only reviewable fields using live or historical Django models."""
        model = registry.get_model("merchant_application", model_name)
        return list(model.objects.using(using).filter(**filters).values(*fields))

    def normalize(value):
        """Canonicalize optional text, coordinates, time values, and collections."""
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, time):
            return value.isoformat()
        if hasattr(value, "coords"):
            return [round(coordinate, 7) for coordinate in value.coords]
        if isinstance(value, dict):
            return {key: normalize(item) for key, item in value.items()}
        if isinstance(value, list):
            return sorted((normalize(item) for item in value), key=encode)
        return value

    def encode(value):
        """Encode content consistently before hashing or sorting."""
        return json.dumps(value, sort_keys=True, separators=(",", ":"))

    filters = {"MAPP_ID_id": application_id}
    identity = records("MerchantApplicationIdentity", filters, (
        "MIDN_BUSINESS_NAME", "MIDN_BUSINESS_DESCRIPTION", "MIDN_CONTACT_NUMBER",
        "MIDN_BUSINESS_EMAIL", "MIDN_WEBSITE", "MIDN_REPRESENTATIVE_NAME",
        "MIDN_REPRESENTATIVE_ROLE", "CLUS_ID_id", "CTGRY_ID_id",
    ))
    identity_model = registry.get_model("merchant_application", "MerchantApplicationIdentity")
    tags = list(identity_model.objects.using(using).filter(**filters).values_list(
        "specialty_tags__pk", flat=True,
    ))
    location = records("MerchantApplicationLocation", filters, (
        "MLOC_PROVINCE", "MLOC_CITY", "MLOC_BARANGAY", "MLOC_STREET_ADDRESS",
        "MLOC_UNIT", "MLOC_POINT",
    ))
    landmarks = records("MerchantApplicationLandmark", {
        "MLOC_ID__MAPP_ID_id": application_id,
    }, (
        "MLMK_NAME", "MLMK_ADDRESS", "MLMK_POINT", "MLMK_SOURCE", "MLMK_PLACE_ID",
    ))
    hours = records("MerchantApplicationOperatingHours", filters, (
        "MHRS_DAY", "MHRS_IS_OPEN", "MHRS_IS_24_HOURS", "MHRS_OPEN_TIME", "MHRS_CLOSE_TIME",
    ))
    for day in hours:
        if not day["MHRS_IS_OPEN"]:
            day["MHRS_IS_24_HOURS"] = False
        if not day["MHRS_IS_OPEN"] or day["MHRS_IS_24_HOURS"]:
            day["MHRS_OPEN_TIME"] = day["MHRS_CLOSE_TIME"] = None

    sections = {
        "identity": {"fields": identity, "tags": tags},
        "location": {"fields": location, "landmarks": landmarks},
        "operating_hours": hours,
        "photos": records("MerchantApplicationPhotos", filters, (
            "MPHT_CATEGORY", "MPHT_PHOTO_PUBLIC_ID", "MPHT_PHOTO_URL",
        )),
        "documents": records("MerchantApplicationDocument", filters, (
            "MDOC_DOCUMENT_TYPE", "MDOC_DOCUMENT_PUBLIC_ID", "MDOC_CLOUDINARY_VERSION",
        )),
    }
    return {
        section: hashlib.sha256(encode(normalize(content)).encode()).hexdigest()
        for section, content in sections.items()
    }


def baseline_existing_rejections(apps, schema_editor):
    """Use rollout content where the original rejected version was not retained."""
    review_model = apps.get_model("merchant_application", "MerchantApplicationReview")
    alias = schema_editor.connection.alias
    reviews = review_model.objects.using(alias).filter(
        MAPP_ID__MAPP_STATUS="rejected", MAREV_DECISION="rejected",
    ).order_by("MAPP_ID_id", "-MAREV_REVIEWED_AT", "-MAREV_ID")
    previous_application_id = None
    for review in reviews.iterator():
        if review.MAPP_ID_id == previous_application_id:
            continue
        previous_application_id = review.MAPP_ID_id
        if review.MAREV_SECTION_FINGERPRINTS:
            continue
        review.MAREV_SECTION_FINGERPRINTS = get_section_fingerprints(
            review.MAPP_ID_id, registry=apps, using=alias,
        )
        review.save(using=alias, update_fields=["MAREV_SECTION_FINGERPRINTS"])


class Migration(migrations.Migration):
    dependencies = [
        ("merchant_application", "0016_merchantapplicationreview_section_fingerprints"),
    ]

    operations = [
        migrations.RunPython(baseline_existing_rejections, migrations.RunPython.noop),
    ]
