from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.business.services.pocket_collection_service import PocketCollectionService
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response

from ..serializers.explore_business_serializer import ExploreBusinessSerializer
from ..serializers.pocket_collection_serializers import (
    PocketCollectionSerializer,
    PocketCollectionWriteSerializer,
)
from ..services.pocket_collection_query_service import PocketCollectionQueryService


class PocketCollectionListView(APIView):
    """Lists and creates private Pockets for eligible authenticated explorers."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def get(self, request):
        """Paginates owned collections with Favorites first and available counts."""
        queryset = PocketCollectionService.list_collections(request.user)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(
            PocketCollectionSerializer(page, many=True).data,
        )

    def post(self, request):
        """Creates one empty custom collection with a normalized unique name."""
        serializer = PocketCollectionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        collection = PocketCollectionService.create_collection(
            user=request.user,
            **serializer.validated_data,
        )
        return success_response(
            data=PocketCollectionSerializer(collection).data,
            message="Pocket created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class PocketCollectionDetailView(APIView):
    """Retrieves, renames, and deletes owned collection metadata."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def get(self, request, collection_id):
        """Returns metadata for an owned collection including available contents count."""
        collection = PocketCollectionService.get_collection(request.user, collection_id)
        return success_response(
            data=PocketCollectionSerializer(collection).data,
            message="Pocket retrieved successfully.",
        )

    def patch(self, request, collection_id):
        """Renames a custom Pocket while keeping Favorites protected."""
        serializer = PocketCollectionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        collection = PocketCollectionService.rename_collection(
            user=request.user,
            collection_id=collection_id,
            **serializer.validated_data,
        )
        return success_response(
            data=PocketCollectionSerializer(collection).data,
            message="Pocket renamed successfully.",
        )

    def delete(self, request, collection_id):
        """Deletes an owned custom Pocket without removing saves retained elsewhere."""
        PocketCollectionService.delete_collection(request.user, collection_id)
        return success_response(
            data={"id": collection_id},
            message="Pocket deleted successfully.",
        )


class PocketCollectionBusinessesView(APIView):
    """Lists available business cards saved in one owned Pocket."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
    )

    def get(self, request, collection_id):
        """Paginates optimized business cards in stable membership chronology."""
        queryset = PocketCollectionQueryService.list_businesses(request.user, collection_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(
            ExploreBusinessSerializer(page, many=True).data,
        )
