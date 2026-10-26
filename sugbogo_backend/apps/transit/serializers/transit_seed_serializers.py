"""Keep research catalogs and reviewed, importable route directions distinct."""

import math
from urllib.parse import urlsplit

from django.utils import timezone
from rest_framework import serializers


class StrictSeedSerializer(serializers.Serializer):
    """Reject misspelled fields rather than silently ignoring seed information."""

    def to_internal_value(self, data):
        """Accept only objects containing the declared seed fields."""
        if not isinstance(data, dict):
            raise serializers.ValidationError("A seed record must be an object.")
        unexpected = set(data) - set(self.fields)
        if unexpected:
            raise serializers.ValidationError({
                key: ["Unknown seed field."] for key in sorted(unexpected)
            })
        return super().to_internal_value(data)


class SeedCoordinateSerializer(StrictSeedSerializer):
    """Validate explicit latitude and longitude rather than ambiguous coordinate arrays."""

    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)

    def validate(self, attrs):
        """Refuse non-finite values before constructing GIS objects."""
        if not all(math.isfinite(value) for value in attrs.values()):
            raise serializers.ValidationError("Coordinates must be finite.")
        return attrs


class SeedPointSerializer(SeedCoordinateSerializer):
    """Describe one named boarding or alighting point referenced by stable file keys."""

    key = serializers.SlugField(max_length=64)
    name = serializers.CharField(max_length=150)

    def validate(self, attrs):
        """Validate only the coordinate fields as finite numbers."""
        if not all(math.isfinite(attrs[key]) for key in ("latitude", "longitude")):
            raise serializers.ValidationError("Coordinates must be finite.")
        return attrs


class SeedSourceSerializer(StrictSeedSerializer):
    """Retain provenance and reuse notes in the versioned dataset."""

    id = serializers.SlugField(max_length=64)
    title = serializers.CharField(max_length=200)
    url = serializers.URLField(max_length=1000)
    accessed_on = serializers.DateField()
    license_note = serializers.CharField(max_length=1000)

    def validate_url(self, value):
        """Keep public source references HTTP(S) and exclude embedded credentials."""
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
            raise serializers.ValidationError("Use an HTTP(S) source URL without credentials.")
        return value

    def validate_accessed_on(self, value):
        """Reject future source-access dates."""
        if value > timezone.localdate():
            raise serializers.ValidationError("Source access cannot be in the future.")
        return value


class SeedReviewSerializer(StrictSeedSerializer):
    """Record a human review without claiming official approval or automatic verification."""

    status = serializers.ChoiceField(choices=("needs_review", "reviewed", "excluded"))
    reviewer = serializers.CharField(max_length=150, allow_blank=True, default="")
    reviewed_on = serializers.DateField(allow_null=True, default=None)
    observed_on = serializers.DateField(allow_null=True, default=None)
    geometry_method = serializers.ChoiceField(
        choices=("admin_export", "manual_trace", "permitted_import"),
    )
    evidence = serializers.CharField(max_length=2000, allow_blank=True, default="")
    license_reviewed = serializers.BooleanField(default=False)

    def validate(self, attrs):
        """Require evidence, actual observation and reuse review for accepted directions."""
        today = timezone.localdate()
        reviewed = attrs["reviewed_on"]
        observed = attrs["observed_on"]
        if any(value and value > today for value in (reviewed, observed)):
            raise serializers.ValidationError("Review and observation dates cannot be in the future.")
        if reviewed and observed and observed > reviewed:
            raise serializers.ValidationError("Observation cannot be later than its review.")
        if attrs["status"] == "reviewed" and not all((
            attrs["reviewer"], reviewed, observed, attrs["evidence"], attrs["license_reviewed"],
        )):
            raise serializers.ValidationError(
                "Reviewed directions require reviewer, dates, evidence and license_reviewed=true."
            )
        return attrs


class SeedVariantSerializer(StrictSeedSerializer):
    """Describe one complete directional geometry and its ordered boarding points."""

    key = serializers.SlugField(max_length=64)
    point_keys = serializers.ListField(
        child=serializers.SlugField(max_length=64), min_length=2, max_length=500,
    )
    geometry = SeedCoordinateSerializer(many=True, min_length=2, max_length=20000)
    source_ids = serializers.ListField(
        child=serializers.SlugField(max_length=64), allow_empty=True, max_length=50,
    )
    review = SeedReviewSerializer()


class SeedRouteSerializer(StrictSeedSerializer):
    """Keep descriptive metadata alongside the existing code-only route model."""

    code = serializers.RegexField(r"^[A-Z0-9][A-Z0-9-]{0,9}$")
    name = serializers.CharField(max_length=150)
    vehicle_type = serializers.ChoiceField(choices=("traditional", "modern", "mixed", "unknown"))
    variants = SeedVariantSerializer(many=True, allow_empty=False, max_length=20)


class TransitSeedDatasetSerializer(StrictSeedSerializer):
    """Validate a reviewed-dataset envelope without accepting a candidate catalog as a seed."""

    format_version = serializers.ChoiceField(choices=(1,))
    kind = serializers.ChoiceField(choices=("cebu_city_transit_seed",))
    dataset_id = serializers.SlugField(max_length=64)
    scope = serializers.ChoiceField(choices=("cebu_city",))
    sources = SeedSourceSerializer(many=True, max_length=200)
    points = SeedPointSerializer(many=True, max_length=10000)
    routes = SeedRouteSerializer(many=True, max_length=200)

    def validate(self, attrs):
        """Require unique keys, valid references and complete directions before database planning."""
        for records, field, label in (
            (attrs["sources"], "id", "source IDs"),
            (attrs["points"], "key", "point keys"),
            (attrs["points"], "name", "point names"),
            (attrs["routes"], "code", "route codes"),
        ):
            values = [record[field] for record in records]
            if len(values) != len(set(values)):
                raise serializers.ValidationError(f"Duplicate {label} are not allowed.")
        point_keys = {point["key"] for point in attrs["points"]}
        source_ids = {source["id"] for source in attrs["sources"]}
        used_points = set()
        variant_keys = set()
        directions = set()
        coordinates = [(point["longitude"], point["latitude"]) for point in attrs["points"]]
        if len(coordinates) != len(set(coordinates)):
            raise serializers.ValidationError("Use one shared point for duplicate point coordinates.")
        for route in attrs["routes"]:
            for variant in route["variants"]:
                keys = variant["point_keys"]
                sources = variant["source_ids"]
                direction = (route["code"], keys[0], keys[-1])
                if variant["key"] in variant_keys or direction in directions:
                    raise serializers.ValidationError("Duplicate variant keys or route directions.")
                variant_keys.add(variant["key"])
                directions.add(direction)
                if len(keys) != len(set(keys)) or not set(keys) <= point_keys:
                    raise serializers.ValidationError("Direction points must be unique existing point keys.")
                if len(sources) != len(set(sources)) or not set(sources) <= source_ids:
                    raise serializers.ValidationError("Direction sources must be unique existing source IDs.")
                if variant["review"]["status"] == "reviewed" and not sources:
                    raise serializers.ValidationError("Reviewed directions require at least one source.")
                used_points.update(keys)
        if used_points != point_keys:
            raise serializers.ValidationError("Every point must belong to a dataset direction.")
        return attrs
