"""Read experimental rating snapshots without triggering calculation."""

from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

from apps.reviews.services.business_rating_service import BusinessRatingService


class BusinessRatingSerializer(serializers.Serializer):
    """Keep rating, sample size, experimental status and freshness together."""

    def to_representation(
        self,
        business,
    ):
        """Expose missing and incompatible snapshots without inventing a zero rating."""
        aggregate = getattr(business, "business_rating", None)
        data = {
            "value": None,
            "contributing_review_count": None,
            "state": "pending",
            "experimental": True,
            "provenance": None,
            "scoring_version": None,
            "calculation_version": BusinessRatingService.CALCULATION_VERSION,
            "computed_at": None,
            "automatic_updates_enabled": False,
        }
        if aggregate is None:
            return data
        data.update({
            "contributing_review_count": aggregate.BRAT_REVIEW_COUNT,
            "state": aggregate.BRAT_STATE,
            "provenance": (
                "legacy_unverified"
                if aggregate.BRAT_SCORING_VERSION == BusinessRatingService.LEGACY_VERSION
                else "versioned"
            ),
            "scoring_version": aggregate.BRAT_SCORING_VERSION,
            "calculation_version": aggregate.BRAT_CALCULATION_VERSION,
            "computed_at": serializers.DateTimeField().to_representation(
                aggregate.BRAT_COMPUTED_AT,
            ),
        })
        if aggregate.BRAT_CALCULATION_VERSION != BusinessRatingService.CALCULATION_VERSION:
            data["state"] = "unavailable"
        elif aggregate.BRAT_REQUESTED_REVISION > aggregate.BRAT_COMPLETED_REVISION:
            data["state"] = "pending"
        elif aggregate.BRAT_VALUE is not None:
            data["value"] = float(aggregate.BRAT_VALUE.quantize(
                Decimal("0.1"),
                rounding=ROUND_HALF_UP,
            ))
        return data

