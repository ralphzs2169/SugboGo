from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from apps.business.models import Category


class CategoryService:
    @staticmethod
    def list_categories(
        search=None,
        ordering=None,
        cluster_id=None,
    ):
        """Retrieve filtered categories with distinct business and application references."""

        queryset = Category.objects.select_related("CLUS_ID").annotate(
            business_count=Count(
                "businesses",
                distinct=True,
            ),
            application_count=Count(
                "merchant_application_identities",
                distinct=True,
            ),
        )

        if cluster_id:
            queryset = queryset.filter(
                CLUS_ID=cluster_id,
            )

        if search:
            queryset = queryset.filter(
                Q(CTGRY_NAME__icontains=search)
                | Q(CTGRY_DESCRIPTION__icontains=search)
            )

        ordering_map = {
            "name": "CTGRY_NAME",
            "-name": "-CTGRY_NAME",
            "business_count": "business_count",
            "-business_count": "-business_count",
            "msme_count": "business_count",
            "-msme_count": "-business_count",
            "application_count": "application_count",
            "-application_count": "-application_count",
            "cluster_name": "CLUS_ID__CLUS_NAME",
            "-cluster_name": "-CLUS_ID__CLUS_NAME",
            "created_at": "CTGRY_CREATED_AT",
            "-created_at": "-CTGRY_CREATED_AT",
            "updated_at": "CTGRY_UPDATED_AT",
            "-updated_at": "-CTGRY_UPDATED_AT",
        }

        return queryset.order_by(
            ordering_map.get(ordering, "CTGRY_NAME"),
        )
   
    @staticmethod
    def get_category(category_id: int):
        """Retrieve a specific category by ID."""
        return get_object_or_404(
            Category.objects.select_related("CLUS_ID"),
            CTGRY_ID=category_id,
        )

    @staticmethod
    @transaction.atomic
    def create_category(validated_data):
        """Create a new category."""
        validated_data["CTGRY_NAME"] = validated_data["CTGRY_NAME"].strip()

        return Category.objects.create(**validated_data)


    @staticmethod
    @transaction.atomic
    def update_category(category, validated_data):
        """Update an existing category with the provided validated data."""
        for field, value in validated_data.items():
            if field == "CTGRY_NAME":
                value = value.strip()

            setattr(category, field, value)

        category.save()

        return category

    @staticmethod
    @transaction.atomic
    def delete_category(category):
        """Delete a category."""
        category.delete()
