"""Atomic administrative business transitions with append-only audit identity."""

from django.db import transaction
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.authentication.permissions import user_has_role
from apps.business.models import Business
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService
from apps.notifications.services.notification_service import NotificationService
from apps.users.models import User


class BusinessStatusConflict(APIException):
    """Require refresh when a dialog predates another business transition."""

    status_code = 409
    default_detail = "Business status changed. Refresh the business and try again."
    default_code = "BUSINESS_STATUS_CONFLICT"


class BusinessLifecycleService:
    """Keep business visibility independent of account status and historical engagement."""

    ACTIONS = (
        AdminActivity.Action.BUSINESS_SUSPENDED,
        AdminActivity.Action.BUSINESS_REACTIVATED,
    )
    MAX_REASON_LENGTH = 1000

    @staticmethod
    def require_admin(actor):
        """Revalidate administrative authority from the current persisted account."""
        try:
            current = User.objects.get(pk=actor.pk)
        except (User.DoesNotExist, AttributeError):
            raise PermissionDenied("You cannot manage business status.") from None
        if not current.is_active or not user_has_role(
            current,
            User.UserRole.ADMIN,
            User.UserRole.SUPER_ADMIN,
        ):
            raise PermissionDenied("You cannot manage business status.")
        return current

    @classmethod
    def history(
        cls,
        business_id,
    ):
        """Scope immutable transition events by stable business identity and explicit action."""
        return AdminActivity.objects.filter(
            AACT_ACTION__in=cls.ACTIONS,
            AACT_CONTEXT__business_id=business_id,
        ).select_related("ACTOR_ID").order_by("-AACT_ID")

    @staticmethod
    def get_business(business_id):
        """Retrieve business identity without acquiring related user or review locks."""
        try:
            return Business.objects.get(pk=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None

    @classmethod
    def snapshot(
        cls,
        business,
        owner,
        latest,
    ):
        """Expose current state and a cycle-safe transition token without internal notes."""
        reason = None
        if (
            business.BUSN_STATUS == Business.BusinessStatus.SUSPENDED
            and latest is not None
        ):
            reason = latest.AACT_CONTEXT.get("reason")
        transition_id = 0
        if latest is not None:
            transition_id = latest.pk
        return {
            "business_id": business.pk,
            "status": business.BUSN_STATUS,
            "updated_at": business.BUSN_UPDATED_AT,
            "transition_id": transition_id,
            "owner_account_status": owner.USER_STATUS,
            "suspension_reason": reason,
        }

    @classmethod
    @transaction.atomic
    def status(
        cls,
        *,
        actor,
        business_id,
    ):
        """Return an authorized coherent status/token snapshot for an Admin dialog."""
        cls.require_admin(actor)
        return cls._status(business_id)

    @classmethod
    def _status(
        cls,
        business_id,
        owner_id=None,
    ):
        """Pair the current status with its latest committed audit identity under lock."""
        try:
            business = Business.objects.select_for_update().get(pk=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None
        if owner_id is not None and business.USER_ID_id != owner_id:
            raise NotFound("Your business could not be found.")
        owner = User.objects.get(pk=business.USER_ID_id)
        return cls.snapshot(
            business,
            owner,
            cls.history(business.pk).first(),
        )

    @classmethod
    @transaction.atomic
    def merchant_status(
        cls,
        user,
    ):
        """Let an active merchant read only their own business's current explanation."""
        if not user.is_active or user.USER_ROLE != User.UserRole.MERCHANT:
            raise PermissionDenied("You cannot view this business status.")
        try:
            business_id = Business.objects.values_list("pk", flat=True).get(USER_ID=user)
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.") from None
        return cls._status(
            business_id,
            owner_id=user.pk,
        )

    @classmethod
    @transaction.atomic
    def transition(
        cls,
        *,
        actor,
        business_id,
        expected_transition_id,
        suspend,
        reason=None,
    ):
        """Commit status, audit, and inbox notice together without touching reviews or account status."""
        cls.require_admin(actor)
        if type(suspend) is not bool:
            raise ValidationError("Choose a valid business transition.")
        if (
            type(expected_transition_id) is not int
            or expected_transition_id < 0
        ):
            raise ValidationError({"expected_transition_id": "Use a nonnegative transition ID."})
        if suspend:
            if not isinstance(reason, str) or not reason.strip():
                raise ValidationError({"reason": "Please provide a reason for suspending this business."})
            reason = reason.strip()
            if len(reason) > cls.MAX_REASON_LENGTH:
                raise ValidationError({"reason": "Use at most 1000 characters."})

        identity = cls.get_business(business_id)
        # User-before-business matches Pocket writes. NO KEY UPDATE permits
        # concurrent review FK checks (KEY SHARE) without a reverse lock cycle.
        users = {
            user.pk: user
            for user in User.objects.select_for_update(no_key=True).filter(
                pk__in=(actor.pk, identity.USER_ID_id),
            ).order_by("pk")
        }
        actor = cls.require_admin(users.get(actor.pk))
        try:
            business = Business.objects.select_for_update().get(pk=business_id)
        except Business.DoesNotExist:
            raise NotFound("The business could not be found.") from None
        if business.USER_ID_id != identity.USER_ID_id:
            raise BusinessStatusConflict()
        owner = users[business.USER_ID_id]
        latest = cls.history(business_id).first()
        transition_id = 0
        if latest is not None:
            transition_id = latest.pk
        if expected_transition_id != transition_id:
            raise BusinessStatusConflict()

        if suspend:
            required = Business.BusinessStatus.ACTIVE
            resulting = Business.BusinessStatus.SUSPENDED
            action = AdminActivity.Action.BUSINESS_SUSPENDED
            invalid_message = "Only active businesses can be suspended."
        else:
            required = Business.BusinessStatus.SUSPENDED
            resulting = Business.BusinessStatus.ACTIVE
            action = AdminActivity.Action.BUSINESS_REACTIVATED
            invalid_message = "Only suspended businesses can be reactivated."
            reason = None
        if business.BUSN_STATUS != required:
            raise ValidationError(invalid_message)
        business.BUSN_STATUS = resulting
        business.save(
            update_fields=["BUSN_STATUS", "BUSN_UPDATED_AT"],
        )
        activity = AdminActivityService.record_user_action(
            actor=actor,
            target_user=owner,
            action=action,
            context={
                "business_id": business.pk,
                "business_name": business.BUSN_NAME,
                "owner_id": owner.pk,
                "previous_status": required,
                "status": resulting,
                "reason": reason,
                "previous_transition_id": transition_id,
            },
        )
        if suspend:
            title = "Business suspended"
            body = f"{business.BUSN_NAME}: your public listing is currently unavailable. Reason: {reason}"
        else:
            title = "Business reactivated"
            body = f"{business.BUSN_NAME}: your business listing has been restored to active status."
        # No target is supplied: existing inbox remains valid without new mobile routing.
        NotificationService.create(
            recipient=owner,
            event_type=action,
            title=title,
            body=body,
            dedup_key=f"business-status:{business.pk}:{activity.pk}",
        )
        if not suspend:
            DiscoveryScoreRefreshService.request_refresh(business.pk)
        return cls.snapshot(business, owner, activity)
