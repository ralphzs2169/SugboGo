from datetime import time

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.admin_operations.system_configuration.services import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import (
    Business,
    BusinessOperatingHours,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    Location,
    ServiceableBoundary,
    SpecialtyTag,
)
from apps.business.services.serviceable_boundary_service import (
    ServiceableBoundaryService,
)
from apps.shared.serializers.operating_hours_serializers import (
    OperatingHoursWeekSerializer,
)
from apps.users.models import User


SEED_MARKER = "SugboGo development listings v1."

CLUSTERS = {
    "culinary": ("DEV Culinary", "utensils"),
    "creative": ("DEV Creative", "palette"),
    "leisure": ("DEV Leisure", "book_open"),
}

# Each category supplies three specialties that fit every listing in that category.
CATEGORIES = {
    "cafes": (
        "DEV Cafes", "culinary",
        "A fictional cafe offering coffee tasting, brewed coffee and light snacks.",
        (
            ("DEV Brewed Coffee", "coffee", "blue"),
            ("DEV Coffee Tasting", "cup_soda", "teal"),
            ("DEV Cafe Snacks", "sandwich", "yellow"),
        ),
    ),
    "bakeries": (
        "DEV Bakeries", "culinary",
        "A fictional bakery making fresh bread, small-batch pastries and cakes.",
        (
            ("DEV Fresh Bread", "croissant", "yellow"),
            ("DEV Small Batch Pastries", "cookie", "red"),
            ("DEV Celebration Cakes", "cake_slice", "purple"),
        ),
    ),
    "pottery": (
        "DEV Pottery Studios", "creative",
        "A fictional pottery studio offering handmade ceramics and clay workshops.",
        (
            ("DEV Handmade Ceramics", "palette", "purple"),
            ("DEV Clay Workshops", "paintbrush", "teal"),
            ("DEV Custom Glazes", "sparkles", "blue"),
        ),
    ),
    "textiles": (
        "DEV Textile Workshops", "creative",
        "A fictional textile workshop offering woven crafts and fabric design sessions.",
        (
            ("DEV Woven Crafts", "palette", "green"),
            ("DEV Fabric Design", "paintbrush", "purple"),
            ("DEV Textile Workshops", "sparkles", "yellow"),
        ),
    ),
    "games": (
        "DEV Board Game Lounges", "leisure",
        "A fictional lounge for board games, group play and logic puzzles.",
        (
            ("DEV Board Games", "star", "blue"),
            ("DEV Group Games", "heart", "green"),
            ("DEV Logic Puzzles", "sparkles", "purple"),
        ),
    ),
    "reading": (
        "DEV Reading Rooms", "leisure",
        "A fictional reading room with quiet reading, book discussions and reading nooks.",
        (
            ("DEV Quiet Reading", "heart", "teal"),
            ("DEV Book Discussions", "star", "yellow"),
            ("DEV Reading Nooks", "sparkles", "green"),
        ),
    ),
}

# Coordinates are inside the repository's Cebu City polygon; runtime validation
# still checks the database's active service-area boundaries before any inserts.
BUSINESS_LISTINGS = (
    ("DEV Amber Lantern Cafe", "cafes", 10.3100, 123.8900),
    ("DEV Moonbeam Mug Cafe", "cafes", 10.3125, 123.8925),
    ("DEV Paper Kite Cafe", "cafes", 10.3150, 123.8950),
    ("DEV Sunrise Crumb Bakery", "bakeries", 10.3180, 123.8970),
    ("DEV Little Comet Bakery", "bakeries", 10.3210, 123.8990),
    ("DEV Clay Cloud Studio", "pottery", 10.3240, 123.9010),
    ("DEV Pebble Wheel Pottery", "pottery", 10.3270, 123.9020),
    ("DEV Fern Cup Ceramics", "pottery", 10.3290, 123.9040),
    ("DEV Woven Sparrow Studio", "textiles", 10.3320, 123.9030),
    ("DEV Thread Lantern Workshop", "textiles", 10.3340, 123.9000),
    ("DEV Dice Meadow Lounge", "games", 10.3360, 123.8980),
    ("DEV Meeple Grove Lounge", "games", 10.3380, 123.8950),
    ("DEV Boardwalk Puzzle Room", "games", 10.3400, 123.8920),
    ("DEV Quiet Orbit Reading Room", "reading", 10.3420, 123.8900),
    ("DEV Willow Page Reading Room", "reading", 10.3440, 123.8880),
)


class DevelopmentBusinessSeedService:
    """Create isolated fictional listings without replacing application data."""

    @staticmethod
    def _create_validated(model, **fields):
        """Validate all fields and constraints before saving a new seed record."""
        record = model(**fields)
        record.full_clean()
        record.save()
        return record

    @staticmethod
    def _taxonomy_record(model, name_field, name, **fields):
        """Reuse only an unambiguous taxonomy row matching the seed definition."""
        matches = list(model.objects.filter(**{name_field: name})[:2])
        if matches:
            if len(matches) != 1 or any(
                getattr(matches[0], field) != value
                for field, value in fields.items()
            ):
                raise ValidationError(
                    "A reserved development taxonomy name conflicts with existing data."
                )
            return matches[0]
        return DevelopmentBusinessSeedService._create_validated(
            model,
            **{name_field: name},
            **fields,
        )

    @staticmethod
    def _owner(number, baseline):
        """Create an unusable-password owner or reuse its exact synthetic identity."""
        email = f"dev-listings-owner-{number:02d}@sugbogo.invalid"
        owner = User.objects.filter(USER_EMAIL=email).first()
        fields = {
            "USER_FNAME": "DEV Listings",
            "USER_LNAME": f"Owner {number:02d}",
            "USER_ROLE": User.UserRole.MERCHANT,
            "USER_STATUS": User.UserStatus.ACTIVE,
            "EMAIL_VERIFIED": False,
            "is_staff": False,
            "is_superuser": False,
        }
        if owner is not None:
            if owner.has_usable_password() or any(
                getattr(owner, field) != value
                for field, value in fields.items()
            ):
                raise ValidationError(
                    "A reserved development owner identity conflicts with an existing account."
                )
            return owner

        # Explicit reputation uses the existing configured baseline without
        # creating/updating configuration through the manager's fallback path.
        owner = User.objects.create_user(
            email=email,
            password=None,
            USER_REPUTATION=baseline,
            **fields,
        )
        owner.full_clean()
        return owner

    @staticmethod
    def seed():
        """Reject production settings before opening the seed transaction."""
        if not settings.DEBUG:
            raise PermissionDenied(
                "This development seeder requires DEBUG=True and refuses production settings."
            )
        return DevelopmentBusinessSeedService._seed()

    @staticmethod
    @transaction.atomic
    def _seed():
        """Atomically create the 15 listings or leave the database unchanged."""
        if not ServiceableBoundary.objects.filter(SBND_IS_ACTIVE=True).exists():
            raise ValidationError(
                "No active service-area boundary exists. Run load_cebu_boundary first."
            )
        points = [
            ServiceableBoundaryService.validate_serviceable(latitude, longitude)
            for _, _, latitude, longitude in BUSINESS_LISTINGS
        ]

        configuration = DiscoveryAlgorithmConfiguration.objects.filter(
            DAC_ID=DiscoveryAlgorithmConfigurationService.SINGLETON_ID,
        ).first()
        if configuration is None or not (
            DiscoveryAlgorithmConfigurationService.get_reputation_configuration_status(
                configuration,
            )["is_complete"]
        ):
            raise ValidationError(
                "Complete the existing reputation configuration before seeding listings."
            )

        clusters = {
            key: DevelopmentBusinessSeedService._taxonomy_record(
                Cluster, "CLUS_NAME", name,
                CLUS_ICON=icon,
                CLUS_DESCRIPTION=f"{SEED_MARKER} Fictional {key} taxonomy.",
            )
            for key, (name, icon) in CLUSTERS.items()
        }
        categories = {}
        tags = {}
        for key, (name, cluster_key, description, specialties) in CATEGORIES.items():
            categories[key] = DevelopmentBusinessSeedService._taxonomy_record(
                Category, "CTGRY_NAME", name,
                CLUS_ID=clusters[cluster_key],
                CTGRY_DESCRIPTION=f"{SEED_MARKER} {description}",
            )
            tags[key] = [
                DevelopmentBusinessSeedService._taxonomy_record(
                    SpecialtyTag, "TAG_NAME", tag_name,
                    TAG_ICON=icon,
                    TAG_COLOR=color,
                )
                for tag_name, icon, color in specialties
            ]

        schedule = OperatingHoursWeekSerializer(data={
            "hours": [
                {
                    "day": day,
                    "is_open": day != "sunday",
                    "open_time": time(9) if day != "sunday" else None,
                    "close_time": time(17) if day != "sunday" else None,
                }
                for day in BusinessOperatingHours.Day.values
            ],
        })
        schedule.is_valid(raise_exception=True)

        created = 0
        for number, ((name, key, _, _), point) in enumerate(
            zip(BUSINESS_LISTINGS, points), start=1,
        ):
            owner = DevelopmentBusinessSeedService._owner(
                number, configuration.DAC_REPUTATION_BASELINE,
            )
            existing = Business.objects.filter(USER_ID=owner).first()
            if Business.objects.filter(BUSN_NAME=name).exclude(USER_ID=owner).exists():
                raise ValidationError(
                    "A reserved development business name belongs to another owner."
                )
            if existing is not None:
                if existing.BUSN_NAME != name or not (
                    existing.BUSN_DESCRIPTION or ""
                ).startswith(SEED_MARKER):
                    raise ValidationError(
                        "A development owner already owns an unrelated business."
                    )
                # Preserve manually created engagement, edits and visibility;
                # rerunning is not a reset or repair operation.
                continue

            location = DevelopmentBusinessSeedService._create_validated(
                Location,
                LOCT_POINT=point,
                LOCT_ADDRESS=f"Fictional development address {number:02d}, Cebu City",
                LOCT_CITY="Cebu City",
                LOCT_PROVINCE="Cebu",
            )
            business = DevelopmentBusinessSeedService._create_validated(
                Business,
                BUSN_NAME=name,
                BUSN_DESCRIPTION=f"{SEED_MARKER} {CATEGORIES[key][2]} Not a real venue.",
                BUSN_CONTACT_NUMBER=f"090000000{number:02d}",
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
                USER_ID=owner,
                CTGRY_ID=categories[key],
                LOCT_ID=location,
            )
            for tag in tags[key]:
                DevelopmentBusinessSeedService._create_validated(
                    BusinessSpecialtyTag, BUSN_ID=business, TAG_ID=tag,
                )
            for day in schedule.validated_data["hours"]:
                DevelopmentBusinessSeedService._create_validated(
                    BusinessOperatingHours,
                    BUSN_ID=business,
                    BOHR_DAY=day["day"],
                    BOHR_IS_OPEN=day["is_open"],
                    BOHR_IS_24_HOURS=day["is_24_hours"],
                    BOHR_OPEN_TIME=day.get("open_time"),
                    BOHR_CLOSE_TIME=day.get("close_time"),
                )
            created += 1

        return {"created": created, "reused": len(BUSINESS_LISTINGS) - created}
