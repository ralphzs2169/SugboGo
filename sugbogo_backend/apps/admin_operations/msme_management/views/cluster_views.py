from core.pagination import StandardPagination
from core.responses import error_response, success_response
from rest_framework import status
from rest_framework.decorators import api_view

from apps.msme.serializers.cluster_serializers import (
    ClusterCreateSerializer,
    ClusterSerializer,
    ClusterUpdateSerializer,
)
from apps.msme.services.cluster_service import ClusterService


@api_view(["GET"])
def list_clusters(request):
    """Retrieve a paginated list of clusters."""

    search = request.query_params.get("search")
    ordering = request.query_params.get("ordering")
    
    queryset = ClusterService.list_clusters(
        search=search,
        ordering=ordering,
    )

    paginator = StandardPagination()

    page = paginator.paginate_queryset(
        queryset,
        request,
    )

    serializer = ClusterSerializer(
        page,
        many=True,
    )

    return paginator.get_paginated_response(
        serializer.data,
    )


@api_view(["GET"])
def retrieve_cluster(request, cluster_id):
    cluster = ClusterService.get_cluster(cluster_id)

    return success_response(
        data=ClusterSerializer(cluster).data,
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
    cluster = ClusterService.get_cluster(cluster_id)

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
    cluster = ClusterService.get_cluster(cluster_id)

    if cluster.categories.exists():
        return error_response(
            message="Cannot delete cluster with existing categories.",
            code="CLUSTER_HAS_CATEGORIES",
        )

    ClusterService.delete_cluster(cluster)

    return success_response(
        message="Cluster deleted successfully.",
    )