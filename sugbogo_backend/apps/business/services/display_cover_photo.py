from apps.business.models import BusinessPhoto
from django.db.models import CharField, F, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, NullIf


def display_cover_photo_expression(business_path=None):
    """Resolve the dedicated cover or first usable live storefront in one query."""
    prefix = f"{business_path}__" if business_path else ""
    business_key = business_path or "pk"
    first_storefront_url = (
        BusinessPhoto.objects
        .filter(
            BUSN_ID=OuterRef(business_key),
            BPHO_CATEGORY=BusinessPhoto.PhotoCategory.STOREFRONT,
        )
        .exclude(BPHO_PHOTO_URL__isnull=True)
        .exclude(BPHO_PHOTO_URL="")
        .order_by("BPHO_ID")
        .values("BPHO_PHOTO_URL")[:1]
    )

    return Coalesce(
        NullIf(F(f"{prefix}BUSN_COVER_PHOTO_URL"), Value("")),
        Subquery(first_storefront_url),
        output_field=CharField(),
    )
