from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.msme.models import Cluster


class ClusterService:
    @staticmethod
    def list_clusters(search=None, ordering=None):
        """Retrieve a list of all clusters, optionally filtered by search term and ordered by specified field."""
        queryset = Cluster.objects.all()

        if search:
            queryset = queryset.filter(
                Q(CLUS_NAME__icontains=search)
                | Q(CLUS_DESCRIPTION__icontains=search)
            )

        ordering_map = {
            "name": "CLUS_NAME",
            "-name": "-CLUS_NAME",
            "created_at": "CLUS_CREATED_AT",
            "-created_at": "-CLUS_CREATED_AT",
            "updated_at": "CLUS_UPDATED_AT",
            "-updated_at": "-CLUS_UPDATED_AT",
        }

        queryset = queryset.order_by(
            ordering_map.get(ordering, "CLUS_NAME")
        )

        return queryset


    @staticmethod
    def get_cluster(cluster_id: int):
        """Retrieve a specific cluster by ID."""
        return get_object_or_404(
            Cluster,
            CLUS_ID=cluster_id,
        )

    @staticmethod
    @transaction.atomic
    def create_cluster(validated_data):
        """Create a new cluster."""
        validated_data["CLUS_NAME"] = validated_data["CLUS_NAME"].strip()

        return Cluster.objects.create(**validated_data)


    @staticmethod
    @transaction.atomic
    def update_cluster(cluster, validated_data):
        """Update an existing cluster with the provided validated data."""
        for field, value in validated_data.items():
            if field == "CLUS_NAME":
                value = value.strip()

            setattr(cluster, field, value)

        cluster.save()

        return cluster


    @staticmethod
    @transaction.atomic
    def delete_cluster(cluster):
        """Delete a cluster."""
        cluster.delete()