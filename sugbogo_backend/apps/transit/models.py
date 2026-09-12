from django.contrib.gis.db import models as gis_models
from django.db import models


class JeepneyRoute(models.Model):
    """A uniquely identified Cebu jeepney route code."""

    JRT_ID = models.AutoField(
        primary_key=True,
    )

    JRT_CODE = models.CharField(
        max_length=10,
        unique=True,
    )

    JRT_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    JRT_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "JEEPNEY_ROUTE"

    def __str__(self):
        return self.JRT_CODE


class TransitPoint(models.Model):
    """A SugboGo-managed point in the transit network."""

    TRPT_ID = models.AutoField(
        primary_key=True,
    )

    TRPT_NAME = models.CharField(
        max_length=150,
    )

    TRPT_POINT = gis_models.PointField(
        srid=4326,
    )

    TRPT_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    TRPT_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "TRANSIT_POINT"

    def __str__(self):
        return self.TRPT_NAME


class JeepneyRouteVariant(models.Model):
    """One directional geographic path belonging to a jeepney route."""

    JRV_ID = models.AutoField(
        primary_key=True,
    )

    JRT_ID = models.ForeignKey(
        JeepneyRoute,
        on_delete=models.CASCADE,
        db_column="JRT_ID",
        related_name="variants",
    )

    JRV_ORIGIN_ID = models.ForeignKey(
        TransitPoint,
        on_delete=models.PROTECT,
        db_column="JRV_ORIGIN_ID",
        related_name="originating_route_variants",
    )

    JRV_DESTINATION_ID = models.ForeignKey(
        TransitPoint,
        on_delete=models.PROTECT,
        db_column="JRV_DESTINATION_ID",
        related_name="terminating_route_variants",
    )

    JRV_GEOMETRY = gis_models.LineStringField(
        srid=4326,
    )

    JRV_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    JRV_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "JEEPNEY_ROUTE_VARIANT"
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=[
                    "JRT_ID",
                    "JRV_ORIGIN_ID",
                    "JRV_DESTINATION_ID",
                ],
                name="unique_jeepney_route_direction",
            ),
            models.CheckConstraint(
                condition=~models.Q(
                    JRV_ORIGIN_ID=models.F("JRV_DESTINATION_ID"),
                ),
                name="route_variant_distinct_endpoints",
            ),
        ]

    def __str__(self):
        return (
            f"{self.JRT_ID.JRT_CODE} - "
            f"{self.JRV_ORIGIN_ID.TRPT_NAME} to "
            f"{self.JRV_DESTINATION_ID.TRPT_NAME}"
        )


class RouteTransitPoint(models.Model):
    """An ordered transit point along a directional route variant."""

    RVTP_ID = models.AutoField(
        primary_key=True,
    )

    JRV_ID = models.ForeignKey(
        JeepneyRouteVariant,
        on_delete=models.CASCADE,
        db_column="JRV_ID",
        related_name="route_transit_points",
    )

    TRPT_ID = models.ForeignKey(
        TransitPoint,
        on_delete=models.PROTECT,
        db_column="TRPT_ID",
        related_name="route_memberships",
    )

    RVTP_SEQUENCE = models.PositiveIntegerField()

    RVTP_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    RVTP_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "ROUTE_TRANSIT_POINT"
        ordering = [
            "JRV_ID",
            "RVTP_SEQUENCE",
        ]
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=[
                    "JRV_ID",
                    "RVTP_SEQUENCE",
                ],
                name="unique_route_variant_sequence",
            ),
            models.UniqueConstraint(
                fields=[
                    "JRV_ID",
                    "TRPT_ID",
                ],
                name="unique_route_variant_transit_point",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    RVTP_SEQUENCE__gte=1,
                ),
                name="route_transit_point_sequence_positive",
            ),
        ]

    def __str__(self):
        return (
            f"{self.JRV_ID} - "
            f"{self.RVTP_SEQUENCE}: "
            f"{self.TRPT_ID.TRPT_NAME}"
        )


class TransitTransfer(models.Model):
    """A reviewable connection between two directional route variants."""

    class TransferStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        IGNORED = "ignored", "Ignored"

    TTFR_ID = models.AutoField(
        primary_key=True,
    )

    TTFR_FROM_VARIANT_ID = models.ForeignKey(
        JeepneyRouteVariant,
        on_delete=models.CASCADE,
        db_column="TTFR_FROM_VARIANT_ID",
        related_name="outgoing_transfers",
    )

    TTFR_TO_VARIANT_ID = models.ForeignKey(
        JeepneyRouteVariant,
        on_delete=models.CASCADE,
        db_column="TTFR_TO_VARIANT_ID",
        related_name="incoming_transfers",
    )

    TTFR_FROM_TRANSIT_POINT_ID = models.ForeignKey(
        TransitPoint,
        on_delete=models.PROTECT,
        db_column="TTFR_FROM_TRANSIT_POINT_ID",
        related_name="outgoing_transfers",
    )

    TTFR_TO_TRANSIT_POINT_ID = models.ForeignKey(
        TransitPoint,
        on_delete=models.PROTECT,
        db_column="TTFR_TO_TRANSIT_POINT_ID",
        related_name="incoming_transfers",
    )

    TTFR_STATUS = models.CharField(
        max_length=10,
        choices=TransferStatus.choices,
        default=TransferStatus.PENDING,
    )

    TTFR_CREATED_AT = models.DateTimeField(
        auto_now_add=True,
    )

    TTFR_UPDATED_AT = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "TRANSIT_TRANSFER"
        indexes = [
            models.Index(
                fields=["TTFR_STATUS"],
                name="transit_transfer_status_idx",
            ),
        ]
        constraints = [  # noqa: RUF012
            models.UniqueConstraint(
                fields=[
                    "TTFR_FROM_VARIANT_ID",
                    "TTFR_TO_VARIANT_ID",
                    "TTFR_FROM_TRANSIT_POINT_ID",
                    "TTFR_TO_TRANSIT_POINT_ID",
                ],
                name="unique_transit_transfer_connection",
            ),
            models.CheckConstraint(
                condition=~models.Q(
                    TTFR_FROM_VARIANT_ID=models.F(
                        "TTFR_TO_VARIANT_ID",
                    ),
                ),
                name="transit_transfer_distinct_variants",
            ),
        ]

    def __str__(self):
        return (
            f"{self.TTFR_FROM_VARIANT_ID} to "
            f"{self.TTFR_TO_VARIANT_ID} "
            f"({self.TTFR_STATUS})"
        )
