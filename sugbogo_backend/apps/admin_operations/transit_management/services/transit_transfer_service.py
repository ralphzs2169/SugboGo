from django.contrib.gis.db.models.functions import Distance
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, ValidationError

from apps.transit.models import TransitTransfer


class TransitTransferService:
    """Manage directed transit transfer review records."""

    @staticmethod
    def _detail_queryset():
        """Build the optimized queryset for transfer responses."""

        return (
            TransitTransfer.objects
            .select_related(
                "TTFR_FROM_VARIANT_ID",
                "TTFR_FROM_VARIANT_ID__JRT_ID",
                "TTFR_FROM_VARIANT_ID__JRV_ORIGIN_ID",
                "TTFR_FROM_VARIANT_ID__JRV_DESTINATION_ID",
                "TTFR_TO_VARIANT_ID",
                "TTFR_TO_VARIANT_ID__JRT_ID",
                "TTFR_TO_VARIANT_ID__JRV_ORIGIN_ID",
                "TTFR_TO_VARIANT_ID__JRV_DESTINATION_ID",
                "TTFR_FROM_TRANSIT_POINT_ID",
                "TTFR_TO_TRANSIT_POINT_ID",
            )
            .annotate(
                connection_distance=Distance(
                    "TTFR_FROM_TRANSIT_POINT_ID__TRPT_POINT",
                    "TTFR_TO_TRANSIT_POINT_ID__TRPT_POINT",
                    spheroid=True,
                ),
                route_separation=Distance(
                    "TTFR_FROM_VARIANT_ID__JRV_GEOMETRY",
                    "TTFR_TO_VARIANT_ID__JRV_GEOMETRY",
                    spheroid=True,
                ),
            )
        )

    @staticmethod
    def validate_transfer_memberships(
        source_variant,
        destination_variant,
        alighting_point,
        boarding_point,
    ):
        """Validate transfer direction and route-point memberships."""

        if source_variant.JRV_ID == destination_variant.JRV_ID:
            raise ValidationError(
                {
                    "destination_variant_id": (
                        "The destination variant must differ from the source."
                    ),
                },
            )

        source_route_point_ids = {
            route_point.TRPT_ID_id
            for route_point in source_variant.route_transit_points.all()
        }

        if alighting_point.TRPT_ID not in source_route_point_ids:
            raise ValidationError(
                {
                    "alighting_transit_point_id": (
                        "The alighting point must belong to the source variant."
                    ),
                },
            )

        destination_route_point_ids = {
            route_point.TRPT_ID_id
            for route_point in destination_variant.route_transit_points.all()
        }

        if boarding_point.TRPT_ID not in destination_route_point_ids:
            raise ValidationError(
                {
                    "boarding_transit_point_id": (
                        "The boarding point must belong to the destination variant."
                    ),
                },
            )

    @staticmethod
    def list_transfers(
        transfer_status=None,
        variant_id=None,
        ordering=None,
    ):
        """List transfers with optional status and variant filters."""

        queryset = TransitTransferService._detail_queryset()

        if transfer_status:
            queryset = queryset.filter(
                TTFR_STATUS=transfer_status,
            )

        if variant_id:
            queryset = queryset.filter(
                Q(
                    TTFR_FROM_VARIANT_ID=variant_id,
                )
                | Q(
                    TTFR_TO_VARIANT_ID=variant_id,
                )
            )

        ordering_map = {
            "created_at": "TTFR_CREATED_AT",
            "-created_at": "-TTFR_CREATED_AT",
            "status": "TTFR_STATUS",
            "-status": "-TTFR_STATUS",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "-TTFR_CREATED_AT",
            ),
        )

    @staticmethod
    def get_transfer(
        transfer_id: int,
    ) -> TransitTransfer:
        """Retrieve a directed transfer by ID."""

        try:
            return (
                TransitTransferService
                ._detail_queryset()
                .get(
                    TTFR_ID=transfer_id,
                )
            )
        except TransitTransfer.DoesNotExist:
            raise NotFound(
                "The transit transfer could not be found.",
            )

    @staticmethod
    def _validate_transfer_connection(
        source_variant,
        destination_variant,
        alighting_point,
        boarding_point,
        transfer_id=None,
    ):
        """Validate a directed transfer and its route-point memberships."""

        TransitTransferService.validate_transfer_memberships(
            source_variant,
            destination_variant,
            alighting_point,
            boarding_point,
        )

        duplicate_queryset = TransitTransfer.objects.filter(
            TTFR_FROM_VARIANT_ID=source_variant,
            TTFR_TO_VARIANT_ID=destination_variant,
            TTFR_FROM_TRANSIT_POINT_ID=alighting_point,
            TTFR_TO_TRANSIT_POINT_ID=boarding_point,
        )

        if transfer_id is not None:
            duplicate_queryset = duplicate_queryset.exclude(
                TTFR_ID=transfer_id,
            )

        if duplicate_queryset.exists():
            raise ValidationError(
                "This directed transfer connection already exists.",
            )

    @staticmethod
    @transaction.atomic
    def create_transfer(
        validated_data,
    ) -> TransitTransfer:
        """Create a pending directed transfer connection."""

        TransitTransferService._validate_transfer_connection(
            validated_data["TTFR_FROM_VARIANT_ID"],
            validated_data["TTFR_TO_VARIANT_ID"],
            validated_data["TTFR_FROM_TRANSIT_POINT_ID"],
            validated_data["TTFR_TO_TRANSIT_POINT_ID"],
        )

        transfer = TransitTransfer.objects.create(
            **validated_data,
        )

        return TransitTransferService.get_transfer(
            transfer.TTFR_ID,
        )

    @staticmethod
    @transaction.atomic
    def update_transfer(
        transfer_id: int,
        validated_data,
    ) -> TransitTransfer:
        """Update a transfer's variants or connection points."""

        try:
            transfer = (
                TransitTransfer.objects
                .select_for_update()
                .get(
                    TTFR_ID=transfer_id,
                )
            )
        except TransitTransfer.DoesNotExist:
            raise NotFound(
                "The transit transfer could not be found.",
            )

        source_variant = validated_data.get(
            "TTFR_FROM_VARIANT_ID",
            transfer.TTFR_FROM_VARIANT_ID,
        )
        destination_variant = validated_data.get(
            "TTFR_TO_VARIANT_ID",
            transfer.TTFR_TO_VARIANT_ID,
        )
        alighting_point = validated_data.get(
            "TTFR_FROM_TRANSIT_POINT_ID",
            transfer.TTFR_FROM_TRANSIT_POINT_ID,
        )
        boarding_point = validated_data.get(
            "TTFR_TO_TRANSIT_POINT_ID",
            transfer.TTFR_TO_TRANSIT_POINT_ID,
        )

        TransitTransferService._validate_transfer_connection(
            source_variant,
            destination_variant,
            alighting_point,
            boarding_point,
            transfer_id=transfer.TTFR_ID,
        )

        update_fields = []

        for field_name, value in validated_data.items():
            setattr(
                transfer,
                field_name,
                value,
            )
            update_fields.append(field_name)

        if update_fields:
            update_fields.append("TTFR_UPDATED_AT")
            transfer.save(
                update_fields=update_fields,
            )

        return TransitTransferService.get_transfer(
            transfer.TTFR_ID,
        )

    @staticmethod
    @transaction.atomic
    def set_transfer_status(
        transfer_id: int,
        transfer_status: str,
    ) -> TransitTransfer:
        """Resolve a pending transfer as confirmed or ignored."""

        try:
            transfer = (
                TransitTransfer.objects
                .select_for_update()
                .get(
                    TTFR_ID=transfer_id,
                )
            )
        except TransitTransfer.DoesNotExist:
            raise NotFound(
                "The transit transfer could not be found.",
            )

        if transfer.TTFR_STATUS != TransitTransfer.TransferStatus.PENDING:
            raise ValidationError(
                "Only pending transit transfers can be reviewed.",
            )

        transfer.TTFR_STATUS = transfer_status
        transfer.save(
            update_fields=[
                "TTFR_STATUS",
                "TTFR_UPDATED_AT",
            ],
        )

        return TransitTransferService.get_transfer(
            transfer.TTFR_ID,
        )

