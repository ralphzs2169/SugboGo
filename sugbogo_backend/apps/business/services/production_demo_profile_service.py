"""Complete marked demo profiles without replacing merchant edits or owning stock assets."""

from datetime import time

from apps.business.models import (
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
)
from apps.shared.serializers.operating_hours_serializers import (
    OperatingHoursWeekSerializer,
)


STOCK_PHOTOS = (
    (
        BusinessPhoto.PhotoCategory.STOREFRONT,
        "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=85&fit=crop",
    ),
    (
        BusinessPhoto.PhotoCategory.INTERIOR,
        "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1200&q=85&fit=crop",
    ),
    (
        BusinessPhoto.PhotoCategory.PRODUCTS,
        "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1200&q=85&fit=crop",
    ),
)


class ProductionDemoProfileService:
    """Fill only absent fields and known v1 placeholders on validated demo businesses."""

    @staticmethod
    def complete(
        business,
        row,
        marker,
        domain,
    ):
        """Supply a usable cover, categorized stock photos, contact details and weekly hours."""
        create = ProductionDemoProfileService._create
        original_description = (
            f"{marker} Fictional cafe for demonstration only. "
            "Not a real venue; reviews and vouches are synthetic."
        )
        defaults = {
            "BUSN_EMAIL": f"cafe-{row['number']:02d}@{domain}",
            "BUSN_WEBSITE": f"https://example.com/?sugbogo-demo={row['number']:02d}",
            "BUSN_ACCESS_DIRECTIONS": (
                f"DEMO ONLY: approximate map point near {row['area']}. "
                "This fictional venue has no real entrance. Do not travel here."
            ),
        }
        changes = []
        if (
            not business.BUSN_DESCRIPTION
            or business.BUSN_DESCRIPTION == original_description
        ):
            business.BUSN_DESCRIPTION = (
                f"{original_description} Sample menu: brewed coffee, iced drinks, "
                "pastries and Cebu-style merienda. Daily demo hours: 9 AM to 6 PM. "
                "Photos are illustrative stock images, not this location. "
                "Contact details are fictional; do not call or email."
            )
            changes.append("BUSN_DESCRIPTION")
        if business.BUSN_CONTACT_NUMBER in ("", "DEMO - no phone"):
            business.BUSN_CONTACT_NUMBER = f"090000000{row['number']:02d}"
            changes.append("BUSN_CONTACT_NUMBER")
        for field, value in defaults.items():
            if not getattr(business, field):
                setattr(business, field, value)
                changes.append(field)
        if (
            not business.BUSN_COVER_PHOTO_URL
            and not business.BUSN_COVER_PHOTO_PUBLIC_ID
        ):
            business.BUSN_COVER_PHOTO_URL = STOCK_PHOTOS[0][1]
            changes.append("BUSN_COVER_PHOTO_URL")
        if changes:
            business.full_clean()
            business.save(update_fields=[*changes, "BUSN_UPDATED_AT"])

        for category, url in STOCK_PHOTOS:
            if business.photos.filter(BPHO_CATEGORY=category).exists():
                continue
            photo = BusinessPhoto(
                BUSN_ID=business,
                BPHO_CATEGORY=category,
                BPHO_PHOTO_URL=url,
                BPHO_PHOTO_PUBLIC_ID="",
                BPHO_FILE_NAME=f"DEMO-illustrative-stock-{category}.jpg",
            )
            # Externally hosted stock has no Cloudinary asset to delete or claim.
            photo.full_clean(exclude=["BPHO_PHOTO_PUBLIC_ID"])
            photo.save()

        week = OperatingHoursWeekSerializer(data={
            "hours": [
                {
                    "day": day,
                    "is_open": True,
                    "open_time": time(9),
                    "close_time": time(18),
                }
                for day in BusinessOperatingHours.Day.values
            ],
        })
        week.is_valid(raise_exception=True)
        for day in week.validated_data["hours"]:
            if business.operating_hours.filter(BOHR_DAY=day["day"]).exists():
                continue
            create(
                BusinessOperatingHours,
                BUSN_ID=business,
                BOHR_DAY=day["day"],
                BOHR_IS_OPEN=day["is_open"],
                BOHR_IS_24_HOURS=day["is_24_hours"],
                BOHR_OPEN_TIME=day["open_time"],
                BOHR_CLOSE_TIME=day["close_time"],
            )

        location = business.LOCT_ID
        if not location.LOCT_POSTAL_CODE:
            location.LOCT_POSTAL_CODE = "6000"
            location.full_clean()
            location.save(update_fields=["LOCT_POSTAL_CODE", "LOCT_UPDATED_AT"])
        if not location.landmarks.exists():
            create(
                BusinessLandmark,
                LOCT_ID=location,
                BLMK_NAME="DEMO map arrival point - not a real venue",
                BLMK_ADDRESS=location.LOCT_ADDRESS,
                BLMK_POINT=location.LOCT_POINT,
                BLMK_SOURCE=BusinessLandmark.LandmarkSource.CUSTOM,
                BLMK_IS_ARRIVAL_POINT=True,
                BLMK_ACCESS_DIRECTIONS=business.BUSN_ACCESS_DIRECTIONS,
            )

    @staticmethod
    def _create(
        model,
        **fields,
    ):
        """Validate a new demo profile row before inserting it."""
        record = model(**fields)
        record.full_clean()
        record.save()
        return record

