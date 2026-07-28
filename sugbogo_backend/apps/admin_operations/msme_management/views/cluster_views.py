from core.responses import success_response
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view

from apps.msme.models import Cluster
from apps.msme.serializers.cluster_serializers import (
    ClusterCreateSerializer,
    ClusterSerializer,
    ClusterUpdateSerializer,
)
from apps.msme.services.cluster_service import ClusterService


@api_view(["GET"])
def list_clusters(request):
    """Retrieve a list of all clusters."""
    clusters = ClusterService.list_clusters()

    serializer = ClusterSerializer(
        clusters,
        many=True,
    )

    return success_response(
        data=serializer.data,
    )


@api_view(["GET"])
def retrieve_cluster(request, cluster_id):
    """Retrieve a specific cluster by ID."""
    cluster = get_object_or_404(
        Cluster,
        CLUS_ID=cluster_id,
    )

    serializer = ClusterSerializer(cluster)

    return success_response(
        data=serializer.data,
    )


@api_view(["POST"])
def create_cluster(request):
    """Create a new cluster."""
    serializer = ClusterCreateSerializer(
        data=request.data,
    )

    serializer.is_valid(raise_exception=True)

    cluster = ClusterService.create_cluster(
        serializer.validated_data,
    )

    return success_response(
        message="Cluster created successfully.",
        data=ClusterSerializer(cluster).data,
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["PUT", "PATCH"])
def update_cluster(request, cluster_id):
    """Update an existing cluster."""
    cluster = get_object_or_404(
        Cluster,
        CLUS_ID=cluster_id,
    )

    serializer = ClusterUpdateSerializer(
        cluster,
        data=request.data,
    )

    serializer.is_valid(raise_exception=True)

    cluster = ClusterService.update_cluster(
        cluster,
        serializer.validated_data,
    )

    return success_response(
        message="Cluster updated successfully.",
        data=ClusterSerializer(cluster).data,
    )


@api_view(["DELETE"])
def delete_cluster(request, cluster_id):
    """Delete a specific cluster by ID."""
    cluster = get_object_or_404(
        Cluster,
        CLUS_ID=cluster_id,
    )

    ClusterService.delete_cluster(cluster)

    return success_response(
        message="Cluster deleted successfully.",
    )