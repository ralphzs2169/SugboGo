from django.contrib.gis.geos import Point
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import (
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
)
from apps.merchant_application.services.application_service import ApplicationService


class LocationService:
    STEP = 2

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

            location = MerchantApplicationLocation.objects.create(
                MAPP_ID=application,
                MLOC_POINT=Point(
                    x=longitude,
                    y=latitude,
                    srid=4326,
                ),
                **validated_data,
            )
        else:
            # Update only the location fields included in the request.
            update_fields = []

            for field, value in validated_data.items():
                setattr(location, field, value)
                update_fields.append(field)

            if latitude is not None and longitude is not None:
                location.MLOC_POINT = Point(
                    x=longitude,
                    y=latitude,
                    srid=4326,
                )
                update_fields.append("MLOC_POINT")

            # Save only the fields included in the partial update.
            if update_fields:
                location.save(
                    update_fields=[
                        *update_fields,
                        "MLOC_UPDATED_AT",
                    ]
                )

        if landmarks_data is not None:
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

        ApplicationService.mark_section_updated(
            application,
            "MAPP_LOCATION_UPDATED_AT",
        )
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
