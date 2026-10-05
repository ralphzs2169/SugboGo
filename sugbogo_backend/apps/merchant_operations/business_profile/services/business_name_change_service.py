from django.db import IntegrityError, transaction
from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)

from apps.business.models import Business
from apps.merchant_operations.business_profile.models import (
    BusinessNameChangeRequest,
)
from apps.merchant_operations.business_profile.serializers.business_name_change_serializers import (
    BusinessNameChangeCreateSerializer,
)


class BusinessNameChangeService:
    """Manage merchant proposals and Admin decisions without changing evidence."""

    @staticmethod
    def _get_owned_business(user):
        """Resolve the authenticated merchant's own approved business."""
        try:
            return Business.objects.get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.")

    @staticmethod
    def _validate_proposed_name(proposed_business_name):
        """Apply the existing registration name field's validation rules."""
        serializer = BusinessNameChangeCreateSerializer(
            data={"proposed_business_name": proposed_business_name},
        )
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data["proposed_business_name"]

    @staticmethod
    def submit(user, proposed_business_name):
        """Create a pending request while preserving the live business name."""
        proposed_name = BusinessNameChangeService._validate_proposed_name(
            proposed_business_name,
        )

        try:
            with transaction.atomic():
                try:
                    business = (
                        Business.objects
                        .select_for_update()
                        .get(USER_ID=user)
                    )
                except Business.DoesNotExist:
                    raise NotFound("Your business could not be found.")

                if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
                    raise PermissionDenied(
                        "Business name changes cannot be requested while "
                        "your business is suspended."
                    )

                if proposed_name == business.BUSN_NAME.strip():
                    raise ValidationError({
                        "proposed_business_name": [
                            "Choose a different business name."
                        ],
                    })

                if BusinessNameChangeRequest.objects.filter(
                    BUSN_ID=business,
                    BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
                ).exists():
                    raise ValidationError(
                        "A business name change request is already pending."
                    )

                return BusinessNameChangeRequest.objects.create(
                    BUSN_ID=business,
                    USER_ID=user,
                    BNCR_PREVIOUS_BUSINESS_NAME=business.BUSN_NAME,
                    BNCR_PROPOSED_BUSINESS_NAME=proposed_name,
                    BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
                    BNCR_SUBMITTED_AT=timezone.now(),
                )
        except IntegrityError:
            if BusinessNameChangeRequest.objects.filter(
                BUSN_ID__USER_ID=user,
                BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
            ).exists():
                raise ValidationError(
                    "A business name change request is already pending."
                ) from None
            raise

    @staticmethod
    def list_for_merchant(user):
        """List only this merchant's requests, newest first."""
        business = BusinessNameChangeService._get_owned_business(user)
        return (
            BusinessNameChangeRequest.objects
            .filter(BUSN_ID=business, USER_ID=user)
            .order_by("-BNCR_SUBMITTED_AT", "-BNCR_ID")
        )

    @staticmethod
    def get_for_merchant(user, request_id):
        """Retrieve one owned request without revealing foreign requests."""
        business = BusinessNameChangeService._get_owned_business(user)
        try:
            return BusinessNameChangeRequest.objects.get(
                BNCR_ID=request_id,
                BUSN_ID=business,
                USER_ID=user,
            )
        except BusinessNameChangeRequest.DoesNotExist:
            raise NotFound("The business name change request could not be found.")

    @staticmethod
    @transaction.atomic
    def withdraw(user, request_id):
        """Withdraw one pending owned request without changing the business."""
        business = BusinessNameChangeService._get_owned_business(user)
        try:
            change_request = (
                BusinessNameChangeRequest.objects
                .select_for_update()
                .get(
                    BNCR_ID=request_id,
                    BUSN_ID=business,
                    USER_ID=user,
                )
            )
        except BusinessNameChangeRequest.DoesNotExist:
            raise NotFound("The business name change request could not be found.")

        if change_request.BNCR_STATUS != BusinessNameChangeRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be withdrawn.")

        change_request.BNCR_STATUS = BusinessNameChangeRequest.Status.WITHDRAWN
        change_request.BNCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=[
                "BNCR_STATUS",
                "BNCR_RESOLVED_AT",
                "BNCR_UPDATED_AT",
            ],
        )
        return change_request

    @staticmethod
    def list_for_admin(status=None):
        """Return a review queue with pending requests before recent history."""
        queryset = BusinessNameChangeRequest.objects.select_related(
            "BUSN_ID",
            "USER_ID",
            "REVIEWER_ID",
        )

        if status:
            if status not in BusinessNameChangeRequest.Status.values:
                raise ValidationError({"status": ["Choose a valid status."]})
            queryset = queryset.filter(BNCR_STATUS=status)

        return queryset.annotate(
            pending_order=Case(
                When(
                    BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
                    then=Value(0),
                ),
                default=Value(1),
                output_field=IntegerField(),
            ),
        ).order_by("pending_order", "-BNCR_SUBMITTED_AT", "-BNCR_ID")

    @staticmethod
    def get_for_admin(request_id):
        """Retrieve a request with its live business and decision context."""
        try:
            return (
                BusinessNameChangeRequest.objects
                .select_related("BUSN_ID", "USER_ID", "REVIEWER_ID")
                .get(BNCR_ID=request_id)
            )
        except BusinessNameChangeRequest.DoesNotExist:
            raise NotFound("The business name change request could not be found.")

    @staticmethod
    @transaction.atomic
    def approve(request_id, reviewer):
        """Atomically apply a pending proposal against its captured baseline."""
        try:
            change_request = (
                BusinessNameChangeRequest.objects
                .select_for_update()
                .get(BNCR_ID=request_id)
            )
        except BusinessNameChangeRequest.DoesNotExist:
            raise NotFound("The business name change request could not be found.")

        if change_request.BNCR_STATUS != BusinessNameChangeRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be approved.")

        try:
            business = (
                Business.objects
                .select_for_update()
                .get(BUSN_ID=change_request.BUSN_ID_id)
            )
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.")

        if business.USER_ID_id != change_request.USER_ID_id:
            raise ValidationError("The request no longer belongs to this business.")

        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise ValidationError("Only active businesses can receive a name change.")

        if business.BUSN_NAME != change_request.BNCR_PREVIOUS_BUSINESS_NAME:
            raise ValidationError(
                "This request is based on outdated business information."
            )

        proposed_name = BusinessNameChangeService._validate_proposed_name(
            change_request.BNCR_PROPOSED_BUSINESS_NAME,
        )
        if proposed_name == business.BUSN_NAME.strip():
            raise ValidationError("The proposed business name is unchanged.")

        business.BUSN_NAME = proposed_name
        business.save(update_fields=["BUSN_NAME", "BUSN_UPDATED_AT"])

        change_request.BNCR_STATUS = BusinessNameChangeRequest.Status.APPROVED
        change_request.REVIEWER_ID = reviewer
        change_request.BNCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=[
                "BNCR_STATUS",
                "REVIEWER_ID",
                "BNCR_RESOLVED_AT",
                "BNCR_UPDATED_AT",
            ],
        )
        NotificationEventService.merchant_request_resolved(
            recipient=change_request.USER_ID,
            request_id=change_request.pk,
            request_type="business_name_change",
            outcome=change_request.BNCR_STATUS,
        )
        return change_request

    @staticmethod
    @transaction.atomic
    def reject(request_id, reviewer, rejection_reason):
        """Record a rejection reason without changing the live business."""
        try:
            change_request = (
                BusinessNameChangeRequest.objects
                .select_for_update()
                .get(BNCR_ID=request_id)
            )
        except BusinessNameChangeRequest.DoesNotExist:
            raise NotFound("The business name change request could not be found.")

        if change_request.BNCR_STATUS != BusinessNameChangeRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be rejected.")

        if not rejection_reason or not rejection_reason.strip():
            raise ValidationError({
                "rejection_reason": ["A rejection reason is required."],
            })

        change_request.BNCR_STATUS = BusinessNameChangeRequest.Status.REJECTED
        change_request.REVIEWER_ID = reviewer
        change_request.BNCR_REJECTION_REASON = rejection_reason.strip()
        change_request.BNCR_RESOLVED_AT = timezone.now()
        change_request.save(
            update_fields=[
                "BNCR_STATUS",
                "REVIEWER_ID",
                "BNCR_REJECTION_REASON",
                "BNCR_RESOLVED_AT",
                "BNCR_UPDATED_AT",
            ],
        )
        NotificationEventService.merchant_request_resolved(
            recipient=change_request.USER_ID,
            request_id=change_request.pk,
            request_type="business_name_change",
            outcome=change_request.BNCR_STATUS,
        )
        return change_request
