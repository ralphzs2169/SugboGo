"""Repeatable fictional data for exercising the existing direct-journey flow."""

from django.conf import settings
from django.contrib.gis.geos import LineString, Point
from django.db import connection, transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.business.models import Business, BusinessLandmark, Category, Cluster, Location
from apps.transit.models import (
    JeepneyRoute,
    JeepneyRouteVariant,
    RouteTransitPoint,
    TransitPoint,
    TransitTransfer,
)
from apps.users.models import User


DATABASE_NAME = "sugbogo_transit_dev"
SEED_MARKER = "SugboGo synthetic direct-transit baseline v1."
PREFIX = "DEV Transit Baseline"
POINTS = {
    "A": (123.8900, 10.3100),
    "B": (123.9000, 10.3100),
    "C": (123.9100, 10.3100),
    "D": (123.9100, 10.3300),
    "E": (123.9200, 10.3300),
}
ROUTES = {"DEV-DIR": ("A", "B", "C"), "DEV-GAP": ("D", "E")}
DESTINATIONS = {"Forward": "C", "Reverse": "A", "Disconnected": "E"}


class DevelopmentTransitSeedService:
    """Create reserved fixtures without updating or deleting existing data."""

    @staticmethod
    def validate_target(confirmation):
        """Require debug, local PostGIS and an explicitly confirmed dedicated database."""
        database = connection.settings_dict
        name = str(database.get("NAME", ""))
        if (
            not settings.DEBUG
            or database.get("ENGINE") != "django.contrib.gis.db.backends.postgis"
            or database.get("HOST", "") not in {"", "localhost", "127.0.0.1", "::1"}
            or not (name == DATABASE_NAME or name.startswith("test_"))
            or confirmation != name
        ):
            raise PermissionDenied(
                "Refusing seed: requires DEBUG=True, local PostGIS, database "
                "sugbogo_transit_dev (or a Django test_ database), and "
                "--confirm-database matching the actual database name."
            )
        return name

    @staticmethod
    def _record(model, lookup, fields):
        """Reuse an exact reserved record or fail rather than overwrite a collision."""
        matches = list(model.objects.filter(**lookup)[:2])
        if matches:
            record = matches[0]
            if len(matches) != 1 or any(
                getattr(record, key) != value
                for key, value in fields.items()
            ):
                raise ValidationError(
                    "Reserved baseline data conflicts with existing records; "
                    "nothing was changed. Use a fresh isolated database."
                )
            return record, False
        record = model(**lookup, **fields)
        record.full_clean()
        record.save()
        return record, True

    @staticmethod
    def _owner(label):
        """Create an unusable synthetic owner without changing reputation configuration."""
        email = f"transit-baseline-{label.lower()}@sugbogo.invalid"
        fields = {
            "USER_FNAME": "DEV Transit",
            "USER_LNAME": label,
            "USER_ROLE": User.UserRole.MERCHANT,
            "USER_STATUS": User.UserStatus.ACTIVE,
            "USER_REPUTATION": User._meta.get_field("USER_REPUTATION").get_default(),
            "EMAIL_VERIFIED": False,
            "is_staff": False,
            "is_superuser": False,
        }
        owner = User.objects.filter(USER_EMAIL=email).first()
        if owner is not None:
            if owner.has_usable_password() or any(
                getattr(owner, key) != value for key, value in fields.items()
            ):
                raise ValidationError("Reserved synthetic owner conflicts with an existing account.")
            return owner, False
        owner = User.objects.create_user(email=email, password=None, **fields)
        owner.full_clean()
        return owner, True

    @staticmethod
    def _scenarios(businesses=None):
        """Describe reproducible queries without pretending the sample coordinates are official."""
        businesses = businesses or {}
        cases = []
        for label, origin, expected in (
            ("Forward", "A", "DEV-DIR"),
            ("Reverse", "C", "no_direct_route_match"),
            ("Disconnected", "A", "no_direct_route_match"),
        ):
            longitude, latitude = POINTS[origin]
            cases.append({
                "destination": f"{PREFIX} {label}",
                "business_id": businesses[label].pk if label in businesses else None,
                "latitude": latitude,
                "longitude": longitude,
                "expected": expected,
            })
        return cases

    @staticmethod
    def seed(*, confirmation, apply=False):
        """Preview without writes or explicitly apply the complete fixture transaction."""
        name = DevelopmentTransitSeedService.validate_target(confirmation)
        if not apply:
            return {
                "database": name,
                "applied": False,
                "created": 0,
                "reused": 0,
                "scenarios": DevelopmentTransitSeedService._scenarios(),
            }
        return DevelopmentTransitSeedService._seed(name)

    @staticmethod
    @transaction.atomic
    def _seed(name):
        """Serialize seed runs and create the full baseline atomically or roll back."""
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [620261024])

        created = reused = 0

        def record(model, lookup, fields):
            """Count only records directly managed by the reserved fixture."""
            nonlocal created, reused
            item, is_new = DevelopmentTransitSeedService._record(model, lookup, fields)
            created += int(is_new)
            reused += int(not is_new)
            return item

        cluster = record(Cluster, {"CLUS_NAME": PREFIX}, {
            "CLUS_DESCRIPTION": SEED_MARKER,
            "CLUS_ICON": Cluster.ClusterIcon.BUS,
        })
        category = record(Category, {"CTGRY_NAME": PREFIX}, {
            "CLUS_ID": cluster,
            "CTGRY_DESCRIPTION": SEED_MARKER,
        })
        points = {
            key: record(TransitPoint, {"TRPT_NAME": f"{PREFIX} {key}"}, {
                "TRPT_POINT": Point(*coordinates, srid=4326),
            })
            for key, coordinates in POINTS.items()
        }
        variant_ids = []
        for code, keys in ROUTES.items():
            existing_route = JeepneyRoute.objects.filter(JRT_CODE=code).first()
            if existing_route is not None and existing_route.variants.count() != 1:
                raise ValidationError("Reserved route code is not a complete baseline variant.")
            route = record(JeepneyRoute, {"JRT_CODE": code}, {})
            variant = record(JeepneyRouteVariant, {"JRT_ID": route}, {
                "JRV_ORIGIN_ID": points[keys[0]],
                "JRV_DESTINATION_ID": points[keys[-1]],
                "JRV_GEOMETRY": LineString([POINTS[key] for key in keys], srid=4326),
            })
            variant_ids.append(variant.pk)
            for sequence, key in enumerate(keys, start=1):
                record(RouteTransitPoint, {"JRV_ID": variant, "RVTP_SEQUENCE": sequence}, {
                    "TRPT_ID": points[key],
                })
            if variant.route_transit_points.count() != len(keys):
                raise ValidationError("Reserved variant has unexpected route memberships.")

        if (
            RouteTransitPoint.objects.filter(TRPT_ID__in=points.values())
            .exclude(JRV_ID_id__in=variant_ids).exists()
            or TransitTransfer.objects.filter(TTFR_FROM_VARIANT_ID_id__in=variant_ids).exists()
            or TransitTransfer.objects.filter(TTFR_TO_VARIANT_ID_id__in=variant_ids).exists()
        ):
            raise ValidationError("Reserved baseline infrastructure is connected to other data.")

        businesses = {}
        for number, (label, point_key) in enumerate(DESTINATIONS.items(), start=1):
            owner, is_new = DevelopmentTransitSeedService._owner(label)
            created += int(is_new)
            reused += int(not is_new)
            business_name = f"{PREFIX} {label}"
            if Business.objects.filter(BUSN_NAME=business_name).exclude(USER_ID=owner).exists():
                raise ValidationError("Reserved destination name belongs to another owner.")
            existing = Business.objects.filter(USER_ID=owner).select_related("LOCT_ID").first()
            longitude, latitude = POINTS[point_key]
            location_fields = {
                "LOCT_POINT": Point(longitude, latitude + 0.0002, srid=4326),
                "LOCT_CITY": "Cebu City",
                "LOCT_PROVINCE": "Cebu",
            }
            address = f"{SEED_MARKER} {label} destination; not a real address."
            location = record(Location, {"LOCT_ADDRESS": address}, location_fields)
            if existing is not None and existing.LOCT_ID_id != location.pk:
                raise ValidationError("Synthetic owner already has a different location.")
            businesses[label] = record(Business, {"USER_ID": owner}, {
                "BUSN_NAME": business_name,
                "BUSN_DESCRIPTION": f"{SEED_MARKER} Fictional venue; not official transit guidance.",
                "BUSN_CONTACT_NUMBER": f"090000000{number:02d}",
                "BUSN_STATUS": Business.BusinessStatus.ACTIVE,
                "BUSN_IS_VERIFIED": False,
                "CTGRY_ID": category,
                "LOCT_ID": location,
            })

        record(BusinessLandmark, {
            "LOCT_ID": businesses["Forward"].LOCT_ID,
            "BLMK_NAME": f"{PREFIX} Entrance Marker",
        }, {
            "BLMK_ADDRESS": "Fictional baseline landmark; not an actual entrance.",
            "BLMK_POINT": Point(123.9100, 10.3101, srid=4326),
            "BLMK_SOURCE": BusinessLandmark.LandmarkSource.CUSTOM,
        })
        return {
            "database": name,
            "applied": True,
            "created": created,
            "reused": reused,
            "scenarios": DevelopmentTransitSeedService._scenarios(businesses),
        }
