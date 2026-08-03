from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.msme.models import SpecialtyTag


class SpecialtyTagService:
    @staticmethod
    def list_specialty_tags(search=None, ordering=None):
        """
        Retrieve specialty tags with optional search filtering
        and ordering.
        """

        queryset = SpecialtyTag.objects.all()

        if search:
            queryset = queryset.filter(
                Q(TAG_NAME__icontains=search)
            )

        ordering_map = {
            "name": "TAG_NAME",
            "-name": "-TAG_NAME",
            "created_at": "TAG_CREATED_AT",
            "-created_at": "-TAG_CREATED_AT",
            "updated_at": "TAG_UPDATED_AT",
            "-updated_at": "-TAG_UPDATED_AT",
        }

        return queryset.order_by(
            ordering_map.get(ordering, "TAG_NAME")
        )

    @staticmethod
    def get_specialty_tag(tag_id: int):
        """Retrieve a specific specialty tag by ID."""
        return get_object_or_404(
            SpecialtyTag,
            TAG_ID=tag_id,
        )

    @staticmethod
    @transaction.atomic
    def create_specialty_tag(validated_data):
        """Create a new specialty tag."""
        validated_data["TAG_NAME"] = validated_data["TAG_NAME"].strip()

        return SpecialtyTag.objects.create(**validated_data)

    @staticmethod
    @transaction.atomic
    def update_specialty_tag(specialty_tag, validated_data):
        """Update an existing specialty tag with the provided validated data."""
        for field, value in validated_data.items():
            if field == "TAG_NAME":
                value = value.strip()

            setattr(specialty_tag, field, value)

        specialty_tag.save()

        return specialty_tag

    @staticmethod
    @transaction.atomic
    def delete_specialty_tag(specialty_tag):
        """Delete a specialty tag."""
        specialty_tag.delete()