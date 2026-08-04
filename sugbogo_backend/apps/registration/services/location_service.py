from django.contrib.gis.geos import Point
from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.registration.models import (
    MerchantApplicationLandmark,
    MerchantApplicationLocation,
)


class LocationService:
    @staticmethod
    @transaction.atomic
    def save_location(application, validated_data):
        """
        Step 2. Creates or updates the Location record tied to this
        application. Point(x=longitude, y=latitude) — GeoDjango stores
        coordinates in (x, y) order, easy to swap by mistake.
        """
        current_step = validated_data.pop("MAPP_CURRENT_STEP")
        highest_completed_step = validated_data.pop("MAPP_HIGHEST_COMPLETED_STEP")
        latitude = validated_data.pop("latitude")
        longitude = validated_data.pop("longitude")
        point = Point(x=longitude, y=latitude, srid=4326)

        application.MAPP_CURRENT_STEP = current_step
        application.MAPP_HIGHEST_COMPLETED_STEP = highest_completed_step
        application.save(
            update_fields=[
                "MAPP_CURRENT_STEP",
                "MAPP_HIGHEST_COMPLETED_STEP",
                "MAPP_UPDATED_AT",
            ]
        )

        location = getattr(application, "location", None)

        if location is None:
            location = MerchantApplicationLocation.objects.create(
                MAPP_ID=application, MLOC_POINT=point, **validated_data
            )
        else:
            for field, value in validated_data.items():
                setattr(location, field, value)
            location.MLOC_POINT = point
            location.save()

        return location

    @staticmethod
    def add_landmark(location, validated_data):
        """Step 3. Adds one landmark to the given location."""
        latitude = validated_data.pop("latitude")
        longitude = validated_data.pop("longitude")
        point = Point(x=longitude, y=latitude, srid=4326)

        return MerchantApplicationLandmark.objects.create(
            MLOC_ID=location, MLMK_POINT=point, **validated_data
        )

    @staticmethod
    def get_landmark_for_location(location, landmark_id):
        return get_object_or_404(
            MerchantApplicationLandmark,
            MLMK_ID=landmark_id,
            MLOC_ID=location,
        )

    @staticmethod
    def delete_landmark(landmark):
        landmark.delete()