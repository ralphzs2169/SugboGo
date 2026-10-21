"""Add admin-only visual context without changing duplicate matching evidence."""

from django.db.models import OuterRef, Subquery

from apps.business.models import Business, BusinessPhoto
from apps.merchant_application.models import MerchantApplication, MerchantApplicationPhotos


def add_duplicate_display_context(state):
    """Load covers and classification in batches for current candidate records."""
    business_ids = [
        candidate["record_id"]
        for candidate in state["candidates"]
        if candidate["record_type"] == "business"
    ]
    application_ids = [
        candidate["record_id"]
        for candidate in state["candidates"]
        if candidate["record_type"] == "application"
    ]
    covers = BusinessPhoto.objects.filter(
        BUSN_ID=OuterRef("pk"),
        BPHO_CATEGORY="storefront",
    ).order_by("BPHO_ID").values("BPHO_PHOTO_URL")[:1]
    businesses = Business.objects.filter(pk__in=business_ids).annotate(
        cover_photo_url=Subquery(covers),
    ).values(
        "pk",
        "cover_photo_url",
        "CTGRY_ID__CTGRY_NAME",
        "CTGRY_ID__CLUS_ID__CLUS_NAME",
        "CTGRY_ID__CLUS_ID__CLUS_ICON",
    )
    application_covers = MerchantApplicationPhotos.objects.filter(
        MAPP_ID=OuterRef("pk"),
        MPHT_CATEGORY="storefront",
    ).order_by("MPHT_ID").values("MPHT_PHOTO_URL")[:1]
    applications = MerchantApplication.objects.filter(pk__in=application_ids).annotate(
        cover_photo_url=Subquery(application_covers),
    ).values(
        "pk",
        "cover_photo_url",
        "identity__CTGRY_ID__CTGRY_NAME",
        "identity__CLUS_ID__CLUS_NAME",
        "identity__CLUS_ID__CLUS_ICON",
    )
    context = {}
    for record in businesses:
        context[("business", record["pk"])] = {
            "cover_photo_url": record["cover_photo_url"],
            "category_name": record["CTGRY_ID__CTGRY_NAME"],
            "cluster_name": record["CTGRY_ID__CLUS_ID__CLUS_NAME"],
            "cluster_icon": record["CTGRY_ID__CLUS_ID__CLUS_ICON"],
        }
    for record in applications:
        context[("application", record["pk"])] = {
            "cover_photo_url": record["cover_photo_url"],
            "category_name": record["identity__CTGRY_ID__CTGRY_NAME"],
            "cluster_name": record["identity__CLUS_ID__CLUS_NAME"],
            "cluster_icon": record["identity__CLUS_ID__CLUS_ICON"],
        }
    for candidate in state["candidates"]:
        candidate.update(context.get(
            (candidate["record_type"], candidate["record_id"]),
            {},
        ))
    return state
