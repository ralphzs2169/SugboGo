from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.msme.models import Cluster


class ClusterService:
    @staticmethod
    def list_clusters():
        """Retrieve a list of all clusters."""
        return Cluster.objects.all()


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