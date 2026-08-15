from django.contrib.gis.geos import Point
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.business.models import ServiceableBoundary
from apps.merchant_application.models import (
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
)
from apps.merchant_application.services.application_service import ApplicationService


class LocationService:
    STEP = 2

    @staticmethod
    def _validate_within_service_area(latitude, longitude, field_label="location"):
        """
        Raises a ValidationError if the given coordinates do not fall
        within any active ServiceableBoundary (currently Cebu City only).
        """
        point = Point(x=longitude, y=latitude, srid=4326)

        is_within_service_area = ServiceableBoundary.objects.filter(
            SBND_IS_ACTIVE=True,
            SBND_BOUNDARY__contains=point,
        ).exists()

        if not is_within_service_area:
            raise ValidationError({
                field_label: (
                    "The selected location is outside our current service "
                    "area (Cebu City). Please choose a location within "
                    "city limits."
                )
            })

        return point

    @staticmethod
    @transaction.atomic
    def save_location(application, validated_data):
        """
        Saves Step 2 registration data.

        Only submitted location fields are updated.
        Landmarks are replaced only when landmarks are included
        in the request.
        """

        ApplicationService.validate_step_access(
            application,
            LocationService.STEP,
        )

        landmarks_data = validated_data.pop("landmarks", None)
        latitude = validated_data.pop("latitude", None)
        longitude = validated_data.pop("longitude", None)

        location = getattr(application, "location", None)

        if location is None:
            # First save requires a complete location point.
            if latitude is None or longitude is None:
                raise ValidationError({
                    "coordinates": "Latitude and longitude are required when creating a location."
                })

            point = LocationService._validate_within_service_area(
                latitude, longitude, field_label="coordinates"
            )

            location = MerchantApplicationLocation.objects.create(
                MAPP_ID=application,
                MLOC_POINT=point,
                **validated_data,
            )
        else:
            # Update only the location fields included in the request.
            update_fields = []

            for field, value in validated_data.items():
                setattr(location, field, value)
                update_fields.append(field)

            if latitude is not None and longitude is not None:
                point = LocationService._validate_within_service_area(
                    latitude, longitude, field_label="coordinates"
                )
                location.MLOC_POINT = point
                update_fields.append("MLOC_POINT")

            # Save only the fields included in the partial update.
            if update_fields:
                location.save(update_fields=update_fields)

        if landmarks_data is not None:
            # Validate every landmark's coordinates before touching the
            # database, so a bad landmark doesn't leave a partial delete
            # in place if it fails partway through.
            for landmark in landmarks_data:
                LocationService._validate_within_service_area(
                    landmark["latitude"],
                    landmark["longitude"],
                    field_label="landmarks",
                )

            # Replace landmarks only when the request explicitly updates them.
            MerchantApplicationLandmark.objects.filter(
                MLOC_ID=location
            ).delete()

            records = []

            for landmark in landmarks_data:
                landmark_latitude = landmark["latitude"]
                landmark_longitude = landmark["longitude"]

                landmark_fields = {
                    key: value
                    for key, value in landmark.items()
                    if key not in {"latitude", "longitude"}
                }

                records.append(
                    MerchantApplicationLandmark(
                        MLOC_ID=location,
                        MLMK_POINT=Point(
                            x=landmark_longitude,
                            y=landmark_latitude,
                            srid=4326,
                        ),
                        **landmark_fields,
                    )
                )

            if records:
                MerchantApplicationLandmark.objects.bulk_create(records)

        ApplicationService.mark_step_completed(application, LocationService.STEP)

        return location

    @staticmethod
    def _is_step_complete(location):
        """Return whether the persisted location satisfies Step 2 requirements."""

        if location.MLOC_POINT is None:
            return False

        required_fields = (
            location.MLOC_PROVINCE,
            location.MLOC_CITY,
            location.MLOC_BARANGAY,
            location.MLOC_STREET_ADDRESS,
        )

        return all(required_fields)