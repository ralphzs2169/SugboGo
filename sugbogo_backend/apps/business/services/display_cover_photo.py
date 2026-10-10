from apps.business.models import BusinessPhoto
from django.db.models import CharField, F, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, NullIf


def display_cover_photo_expression():
    """Resolve the dedicated cover or first usable live storefront in one query."""
    first_storefront_url = (
        BusinessPhoto.objects
        .filter(
            BUSN_ID=OuterRef("pk"),
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
        )
        .exclude(BPHO_PHOTO_URL__isnull=True)
        .exclude(BPHO_PHOTO_URL="")
        .order_by("BPHO_ID")
        .values("BPHO_PHOTO_URL")[:1]
    )

    return Coalesce(
        NullIf(F("BUSN_COVER_PHOTO_URL"), Value("")),
        Subquery(first_storefront_url),
        output_field=CharField(),
    )
