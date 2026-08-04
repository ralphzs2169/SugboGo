from django.contrib.gis.geos import Point
from django.db import transaction

from apps.registration.models import (
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
)
from apps.registration.services.application_service import ApplicationService


class LocationService:
    STEP = 2

    @staticmethod
    @transaction.atomic
    def save_location(application, validated_data):
        """
        Saves the complete Step 2 registration data.

        Step 2 consists of the business location and its landmarks.
        Progress is determined by the backend.
        """

        ApplicationService.validate_step_access(
            application,
            LocationService.STEP,
        )

        landmarks_data = validated_data.pop("landmarks", [])

        latitude = validated_data.pop("latitude")
        longitude = validated_data.pop("longitude")

        point = Point(
            x=longitude,
            y=latitude,
            srid=4326,
        )

        location = getattr(application, "location", None)


        if location is None:
            # First save for this application: create the Location record.
            location = MerchantApplicationLocation.objects.create(
                MAPP_ID=application,
                MLOC_POINT=point,
                **validated_data,
            )
        else:
            # Subsequent save: update the existing Identity record in place.
            update_fields = []

            for field, value in validated_data.items():
                setattr(location, field, value)
                update_fields.append(field)

            location.MLOC_POINT = point
            update_fields.append("MLOC_POINT")

            location.save(update_fields=update_fields)


        # Replace the complete landmark collection for this Step 2 save.
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

        ApplicationService.mark_step_completed(
            application,
            LocationService.STEP,
        )

        return location