from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.merchant_operations.business_profile.constants import (
    BUSINESS_CLASSIFICATION_CHANGE_COOLDOWN,
    BUSINESS_LOCATION_CHANGE_COOLDOWN,
    BUSINESS_NAME_CHANGE_COOLDOWN,
)
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)


class BusinessChangeRequestEligibilityService:
    """Computes and enforces approval cooldowns for merchant profile changes."""

    @staticmethod
    def _get_eligibility(
        *,
        business,
        model,
        status_field,
        resolved_at_field,
        id_field,
        cooldown,
        now=None,
    ):
        """Return pending-first eligibility for one business request model."""
        reference_time = now or timezone.now()
        pending_request = (
            model.objects
            .filter(
                BUSN_ID=business,
                **{status_field: model.Status.PENDING},
            )
            .only(id_field)
            .first()
        )
        latest_approved_request = (
            model.objects
            .filter(
                BUSN_ID=business,
                **{
                    status_field: model.Status.APPROVED,
                    f"{resolved_at_field}__isnull": False,
                },
            )
            .only(id_field, resolved_at_field)
            .order_by(
                f"-{resolved_at_field}",
                f"-{id_field}",
            )
            .first()
        )

        cooldown_until = None
        last_approved_request_id = None
        if latest_approved_request is not None:
            last_approved_request_id = getattr(
                latest_approved_request,
                id_field,
            )
            cooldown_until = (
                getattr(latest_approved_request, resolved_at_field)
                + cooldown
            )

        reason = None
        if pending_request is not None:
            reason = "pending"
        elif cooldown_until is not None and reference_time < cooldown_until:
            reason = "cooldown"

        return {
            "can_submit": reason is None,
            "reason": reason,
            "cooldown_duration_hours": int(
                cooldown.total_seconds() // 3600
            ),
            "cooldown_until": cooldown_until,
            "last_approved_request_id": last_approved_request_id,
            "pending_request_id": (
                getattr(pending_request, id_field)
                if pending_request is not None
                else None
            ),
        }

    @staticmethod
    def for_business_name(business, now=None):
        """Return business-name request eligibility for one business."""
        return BusinessChangeRequestEligibilityService._get_eligibility(
            business=business,
            model=BusinessNameChangeRequest,
            status_field="BNCR_STATUS",
            resolved_at_field="BNCR_RESOLVED_AT",
            id_field="BNCR_ID",
            cooldown=BUSINESS_NAME_CHANGE_COOLDOWN,
            now=now,
        )

    @staticmethod
    def for_classification(business, now=None):
        """Return classification request eligibility for one business."""
        return BusinessChangeRequestEligibilityService._get_eligibility(
            business=business,
            model=BusinessClassificationChangeRequest,
            status_field="BCCR_STATUS",
            resolved_at_field="BCCR_RESOLVED_AT",
            id_field="BCCR_ID",
            cooldown=BUSINESS_CLASSIFICATION_CHANGE_COOLDOWN,
            now=now,
        )

    @staticmethod
    def for_location(business, now=None):
        """Return location request eligibility for one business."""
        return BusinessChangeRequestEligibilityService._get_eligibility(
            business=business,
            model=BusinessLocationChangeRequest,
            status_field="BLCR_STATUS",
            resolved_at_field="BLCR_RESOLVED_AT",
            id_field="BLCR_ID",
            cooldown=BUSINESS_LOCATION_CHANGE_COOLDOWN,
            now=now,
        )

    @staticmethod
    def enforce(eligibility, request_label, pending_message):
        """Reject pending or cooldown-blocked submissions with metadata."""
        if eligibility["reason"] == "pending":
            raise ValidationError(pending_message)

        if eligibility["reason"] != "cooldown":
            return

        cooldown_until = eligibility["cooldown_until"]
        raise ValidationError({
            "detail": [
                f"Another {request_label} request can be submitted after "
                "the current approval cooldown ends."
            ],
            "reason": ["cooldown"],
            "cooldown_until": [cooldown_until.isoformat()],
            "cooldown_duration_hours": [
                str(eligibility["cooldown_duration_hours"])
            ],
            "last_approved_request_id": [
                str(eligibility["last_approved_request_id"])
            ],
        })
