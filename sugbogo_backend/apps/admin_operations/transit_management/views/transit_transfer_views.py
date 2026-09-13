from rest_framework import status
from rest_framework.views import APIView

from apps.admin_operations.transit_management.serializers.transit_transfer_serializers import (
    TransitTransferSerializer,
    TransitTransferWriteSerializer,
)
from apps.admin_operations.transit_management.services.transit_transfer_service import (
    TransitTransferService,
)
from apps.admin_operations.transit_management.services.transfer_candidate_detection_service import (
    TransferCandidateDetectionService,
)
from apps.admin_operations.transit_management.views import ADMIN_PERMISSIONS
from apps.transit.models import TransitTransfer
from core.pagination import StandardPagination
from core.responses import success_response


class TransitTransferListView(APIView):
    """Handle administrator transfer listing and manual creation."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request):
        """Retrieve a paginated list of directed transfers."""

        transfers = TransitTransferService.list_transfers(
            transfer_status=request.query_params.get("status"),
            variant_id=request.query_params.get("variant_id"),
            ordering=request.query_params.get("ordering"),
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            transfers,
            request,
        )

        serializer = TransitTransferSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )

    def post(self, request):
        """Create a pending directed transfer manually."""

        serializer = TransitTransferWriteSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        transfer = TransitTransferService.create_transfer(
            serializer.validated_data,
        )

        return success_response(
            data=TransitTransferSerializer(transfer).data,
            message="Transit transfer created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class TransitTransferCandidateDetectionView(APIView):
    """Handle administrator-triggered transfer candidate detection."""

    permission_classes = ADMIN_PERMISSIONS

    def post(self, request):
        """Detect and persist missing pending directed transfer candidates."""

        summary = TransferCandidateDetectionService.detect_candidates()

        return success_response(
            data=summary,
            message="Transit transfer candidates detected successfully.",
        )


class TransitTransferDetailView(APIView):
    """Handle administrator transfer retrieval and connection updates."""

    permission_classes = ADMIN_PERMISSIONS

    def get(self, request, transfer_id):
        """Retrieve a directed transfer."""

        transfer = TransitTransferService.get_transfer(
            transfer_id,
        )

        return success_response(
            data=TransitTransferSerializer(transfer).data,
            message="Transit transfer retrieved successfully.",
        )

    def put(self, request, transfer_id):
        """Fully update a directed transfer connection."""

        return self._update(
            request,
            transfer_id,
            partial=False,
        )

    def patch(self, request, transfer_id):
        """Partially update a directed transfer connection."""

        return self._update(
            request,
            transfer_id,
            partial=True,
        )

    def _update(
        self,
        request,
        transfer_id,
        partial,
    ):
        """Validate and persist a transfer connection update."""

        transfer = TransitTransferService.get_transfer(
            transfer_id,
        )

        serializer = TransitTransferWriteSerializer(
            transfer,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        transfer = TransitTransferService.update_transfer(
            transfer_id,
            serializer.validated_data,
        )

        return success_response(
            data=TransitTransferSerializer(transfer).data,
            message="Transit transfer updated successfully.",
        )


class TransitTransferConfirmView(APIView):
    """Handle administrator confirmation of pending transfers."""

    permission_classes = ADMIN_PERMISSIONS

    def post(self, request, transfer_id):
        """Confirm a pending directed transfer."""

        transfer = TransitTransferService.set_transfer_status(
            transfer_id,
            TransitTransfer.TransferStatus.CONFIRMED,
        )

        return success_response(
            data=TransitTransferSerializer(transfer).data,
            message="Transit transfer confirmed successfully.",
        )


class TransitTransferIgnoreView(APIView):
    """Handle administrator rejection of pending transfers."""

    permission_classes = ADMIN_PERMISSIONS

    def post(self, request, transfer_id):
        """Ignore a pending directed transfer."""

        transfer = TransitTransferService.set_transfer_status(
            transfer_id,
            TransitTransfer.TransferStatus.IGNORED,
        )

        return success_response(
            data=TransitTransferSerializer(transfer).data,
            message="Transit transfer ignored successfully.",
        )

