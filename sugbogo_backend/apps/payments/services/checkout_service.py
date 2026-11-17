"""Reserve and resume Merchant Plus checkout without confirming payment."""

from datetime import timedelta
from urllib.parse import urlencode, urlunsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied

from apps.business.models import Business
from apps.shared.services.maya_checkout_service import (
    MayaCheckoutService,
    MayaConfigurationError,
    MayaCreationRejected,
    MayaCreationUnknown,
)
from apps.users.models import User
from config.payments import parse_maya_return_url

from ..constants import MERCHANT_PLUS_PRODUCT
from ..models import Payment, PaymentCheckoutSession, PaymentMode, PaymentProvider
from .payment_service import PaymentService


class CheckoutConflict(APIException):
    """Block a purchase that needs support or already grants paid access."""

    status_code = 409
    default_detail = "This purchase needs review before checkout can continue."
    default_code = "checkout_requires_review"


class CheckoutUnavailable(APIException):
    """Expose a controlled service failure without provider details."""

    status_code = 503
    default_detail = "Secure checkout is temporarily unavailable. Please try again later."
    default_code = "checkout_unavailable"


class CheckoutRejected(APIException):
    """Report a definite provider rejection while keeping the payment pending."""

    status_code = 502
    default_detail = "Checkout could not be created. Please try again later."
    default_code = "checkout_creation_rejected"


class CheckoutService:
    """Coordinate local locks and a single external creation attempt per operation."""

    CREATION_LEASE_SECONDS = 60
    MAYA_CHECKOUT_LIFETIME = timedelta(hours=1)
    TERMINAL_MAYA_OUTCOMES = {
        "PAYMENT_CANCELLED": "cancelled",
        "PAYMENT_FAILED": "failed",
        "PAYMENT_EXPIRED": "expired",
    }

    @staticmethod
    def is_enabled():
        """Report whether this environment can create a Maya Sandbox checkout."""
        return (
            settings.PAYMENT_PROVIDER == PaymentProvider.MAYA
            and settings.PAYMENT_MODE == PaymentMode.TEST
            and settings.MAYA_CHECKOUT_ENABLED
            and settings.MERCHANT_PLUS_ENFORCED
            and not settings.MERCHANT_PLUS_MOCK_ENABLED
        )

    @staticmethod
    def _assert_payable(payment):
        """Fail closed if an unresolved record is paid or has an unexpected offer."""
        product = MERCHANT_PLUS_PRODUCT
        if (
            payment.PYMT_STATUS != Payment.Status.PENDING
            or payment.PYMT_PROVIDER != PaymentProvider.MAYA
            or payment.PYMT_MODE != PaymentMode.TEST
            or payment.PYMT_FULFILMENT_STATUS != Payment.FulfilmentStatus.NOT_STARTED
            or payment.PYMT_PRODUCT != product.code
            or payment.PYMT_PRODUCT_VERSION != product.version
            or payment.PYMT_AMOUNT_CENTAVOS != product.amount_centavos
            or payment.PYMT_CURRENCY != product.currency
            or payment.PYMT_ACCESS_DURATION_DAYS != product.access_duration_days
        ):
            raise CheckoutConflict()

    @classmethod
    @transaction.atomic
    def _reserve(
        cls,
        user,
        *,
        retry_checkout_reference=None,
    ):
        """Serialize purchases by business and commit one open operation before HTTP."""
        owned = PaymentService.get_owned_business(user)
        try:
            business = Business.objects.select_for_update().get(
                pk=owned.pk,
                USER_ID=user,
            )
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.") from None
        previous_owner_purchase = Payment.objects.filter(
            BUSN_ID=business,
            PYMT_PRODUCT=MERCHANT_PLUS_PRODUCT.code,
            PYMT_MODE=PaymentService.current_mode(),
        ).filter(
            Q(PYMT_STATUS=Payment.Status.PENDING)
            | ~Q(PYMT_FULFILMENT_STATUS=Payment.FulfilmentStatus.FULFILLED)
            | Q(paid_plus_entitlement__isnull=True),
        ).exclude(USER_ID=user)
        if previous_owner_purchase.exists():
            raise CheckoutConflict()
        eligibility = PaymentService.get_purchase_eligibility(user, business=business)
        active = eligibility["active_entitlement"]
        if active is not None:
            if retry_checkout_reference is not None:
                return active.PYMT_ID, None, False
            raise CheckoutConflict(
                "Merchant Plus paid access is already active.",
                code="paid_access_active",
            )
        if retry_checkout_reference is not None:
            payment = eligibility["unresolved_payment"]
            if payment is None:
                raise CheckoutConflict()
        else:
            payment, _ = PaymentService.create_or_get_payment(
                user,
                business_id=business.pk,
            )
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if (
            retry_checkout_reference is not None
            and payment.PYMT_STATUS == Payment.Status.PAID
        ):
            return payment, None, False
        cls._assert_payable(payment)
        operations = payment.checkout_sessions.select_for_update()
        operation = (
            operations.filter(PCHK_STATE__in=[
                PaymentCheckoutSession.State.CREATING,
                PaymentCheckoutSession.State.CREATION_UNKNOWN,
                PaymentCheckoutSession.State.READY,
            ])
            .order_by("-PCHK_ID")
            .first()
        )
        if operation is None:
            operation = operations.order_by("-PCHK_ID").first()
        if retry_checkout_reference is not None:
            if (
                operation is None
                or operation.PCHK_OPERATION_REFERENCE != retry_checkout_reference
                or not cls.can_retry(payment, operation)
            ):
                return payment, operation, False

            # Retain Maya evidence while freeing the single open operation slot.
            if operation.PCHK_STATE == PaymentCheckoutSession.State.READY:
                operation.PCHK_STATE = PaymentCheckoutSession.State.SUPERSEDED
                operation.save(update_fields=[
                    "PCHK_STATE",
                    "PCHK_UPDATED_AT",
                ])
        elif operation is not None:
            if (
                operation.PCHK_PROVIDER != payment.PYMT_PROVIDER
                or operation.PCHK_MODE != payment.PYMT_MODE
            ):
                raise CheckoutConflict()
            if operation.PCHK_LAST_ERROR in {
                "provider_identity_conflict", "ownership_requires_review",
            }:
                raise CheckoutConflict()
            if operation.PCHK_STATE == PaymentCheckoutSession.State.READY:
                if (
                    not MayaCheckoutService.is_checkout_id(operation.PCHK_PROVIDER_SESSION_ID)
                    or not MayaCheckoutService.is_safe_checkout_url(operation.PCHK_CHECKOUT_URL)
                ):
                    raise CheckoutConflict()
                return payment, operation, False
            if operation.PCHK_STATE in {
                PaymentCheckoutSession.State.CREATING,
                PaymentCheckoutSession.State.CREATION_UNKNOWN,
            }:
                if (
                    operation.PCHK_STATE == PaymentCheckoutSession.State.CREATING
                    and operation.PCHK_LEASE_UNTIL is not None
                    and operation.PCHK_LEASE_UNTIL <= timezone.now()
                ):
                    operation.PCHK_STATE = PaymentCheckoutSession.State.CREATION_UNKNOWN
                    operation.PCHK_LAST_ERROR = "creation_lease_elapsed"
                    operation.save(update_fields=[
                        "PCHK_STATE", "PCHK_LAST_ERROR", "PCHK_UPDATED_AT",
                    ])
                return payment, operation, False
            if (
                operation.PCHK_STATE != PaymentCheckoutSession.State.CREATION_FAILED
                or operation.PCHK_LAST_ERROR not in {
                    "provider_validation_rejected",
                    "provider_authentication_rejected",
                    "configuration_unavailable",
                }
            ):
                raise CheckoutConflict()
        operation = PaymentCheckoutSession.objects.create(
            PYMT_ID=payment,
            PCHK_PROVIDER=payment.PYMT_PROVIDER,
            PCHK_MODE=payment.PYMT_MODE,
            PCHK_LEASE_UNTIL=(
                timezone.now() + timedelta(seconds=cls.CREATION_LEASE_SECONDS)
            ),
        )
        return payment, operation, True

    @staticmethod
    def _return_url(
        payment,
        operation,
        outcome,
    ):
        """Build non-authoritative return hints using only server configuration/references."""
        try:
            parsed = parse_maya_return_url(settings.MAYA_RETURN_BASE_URL)
        except ImproperlyConfigured:
            raise MayaConfigurationError("Payment return configuration is unavailable.") from None
        query = urlencode({
            "payment_reference": str(payment.PYMT_REFERENCE),
            "operation_reference": str(operation.PCHK_OPERATION_REFERENCE),
            "outcome": outcome,
        })
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))

    @staticmethod
    @transaction.atomic
    def _record_outcome(
        payment,
        operation,
        *,
        state,
        error="",
        checkout=None,
    ):
        """Retain provider evidence under short locks even if ownership changed in flight."""
        business = Business.objects.select_for_update().get(pk=payment.BUSN_ID_id)
        locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
        locked = PaymentCheckoutSession.objects.select_for_update().get(pk=operation.pk)
        valid_relationships = (
            business.USER_ID_id == payment.USER_ID_id
            and locked_payment.USER_ID_id == payment.USER_ID_id
            and locked_payment.BUSN_ID_id == business.pk
            and locked_payment.PYMT_PROVIDER == payment.PYMT_PROVIDER
            and locked_payment.PYMT_MODE == payment.PYMT_MODE
            and locked.PYMT_ID_id == locked_payment.pk
            and locked.PCHK_PROVIDER == locked_payment.PYMT_PROVIDER
            and locked.PCHK_MODE == locked_payment.PYMT_MODE
            and business.USER_ID.is_active
            and business.USER_ID.USER_ROLE == User.UserRole.MERCHANT
        )
        if not valid_relationships:
            state = PaymentCheckoutSession.State.CREATION_UNKNOWN
            error = "ownership_requires_review"
        if locked.PCHK_STATE not in {
            PaymentCheckoutSession.State.CREATING,
            PaymentCheckoutSession.State.CREATION_UNKNOWN,
        }:
            raise CheckoutConflict()
        if checkout is not None:
            locked.PCHK_PROVIDER_SESSION_ID = checkout.checkout_id
            locked.PCHK_CHECKOUT_URL = checkout.checkout_url
            locked.PCHK_PROVIDER_STATUS = checkout.status
        locked.PCHK_STATE = state
        locked.PCHK_LAST_ERROR = error
        locked.PCHK_CHECKED_AT = timezone.now()
        locked.PCHK_LEASE_UNTIL = None
        locked.save(update_fields=[
            "PCHK_PROVIDER_SESSION_ID", "PCHK_CHECKOUT_URL", "PCHK_PROVIDER_STATUS",
            "PCHK_STATE", "PCHK_LAST_ERROR",
            "PCHK_CHECKED_AT", "PCHK_LEASE_UNTIL", "PCHK_UPDATED_AT",
        ])
        return locked, valid_relationships

    @classmethod
    def create_checkout(
        cls,
        user,
        *,
        retry_checkout_reference=None,
    ):
        """Create once or resume checkout while leaving payment and fulfilment untouched."""
        PaymentService.require_merchant(user)
        if not cls.is_enabled():
            raise PermissionDenied("Merchant Plus checkout is not enabled.")
        payment, operation, reserved = cls._reserve(
            user,
            retry_checkout_reference=retry_checkout_reference,
        )
        if not reserved:
            return cls._response(payment, operation, created=False)
        try:
            checkout = MayaCheckoutService.create_checkout(
                mode=payment.PYMT_MODE,
                operation_reference=operation.PCHK_OPERATION_REFERENCE,
                product_name=MERCHANT_PLUS_PRODUCT.name,
                amount_centavos=payment.PYMT_AMOUNT_CENTAVOS,
                currency=payment.PYMT_CURRENCY,
                success_url=cls._return_url(payment, operation, "success"),
                failure_url=cls._return_url(payment, operation, "failure"),
                cancel_url=cls._return_url(payment, operation, "cancel"),
            )
        except MayaConfigurationError:
            cls._record_outcome(
                payment,
                operation,
                state=PaymentCheckoutSession.State.CREATION_FAILED,
                error="configuration_unavailable",
            )
            raise CheckoutUnavailable() from None
        except MayaCreationRejected as error:
            cls._record_outcome(
                payment,
                operation,
                state=PaymentCheckoutSession.State.CREATION_FAILED,
                error=str(error),
            )
            raise CheckoutRejected() from None
        except MayaCreationUnknown as error:
            operation, valid = cls._record_outcome(
                payment,
                operation,
                state=PaymentCheckoutSession.State.CREATION_UNKNOWN,
                error=str(error),
            )
        else:
            try:
                operation, valid = cls._record_outcome(
                    payment,
                    operation,
                    state=PaymentCheckoutSession.State.READY,
                    checkout=checkout,
                )
            except IntegrityError:
                operation, valid = cls._record_outcome(
                    payment,
                    operation,
                    state=PaymentCheckoutSession.State.CREATION_UNKNOWN,
                    error="provider_identity_conflict",
                )
        if (
            not valid
            or operation.PCHK_LAST_ERROR == "provider_identity_conflict"
        ):
            raise CheckoutConflict()
        if retry_checkout_reference is not None:
            payment.refresh_from_db()
        return cls._response(payment, operation, created=True)

    @classmethod
    def can_resume(
        cls,
        payment,
        operation,
    ):
        """Apply the shared payment, checkout identity, and URL-release rules."""
        if operation is None:
            return False
        try:
            cls._assert_payable(payment)
        except CheckoutConflict:
            return False
        return (
            operation.PYMT_ID_id == payment.pk
            and operation.PCHK_PROVIDER == payment.PYMT_PROVIDER
            and operation.PCHK_MODE == payment.PYMT_MODE
            and operation.PCHK_STATE == PaymentCheckoutSession.State.READY
            and operation.PCHK_LAST_ERROR not in {
                "provider_identity_conflict",
                "ownership_requires_review",
            }
            and timezone.now() < operation.PCHK_CREATED_AT + cls.MAYA_CHECKOUT_LIFETIME
            and operation.PCHK_PROVIDER_STATUS in {
                "",
                "PENDING_TOKEN",
                "PENDING_PAYMENT",
            }
            and MayaCheckoutService.is_checkout_id(operation.PCHK_PROVIDER_SESSION_ID)
            and MayaCheckoutService.is_safe_checkout_url(operation.PCHK_CHECKOUT_URL)
        )

    @classmethod
    def can_retry(
        cls,
        payment,
        operation,
    ):
        """Require stored terminal Maya evidence on a matching, unpaid checkout."""
        try:
            cls._assert_payable(payment)
        except CheckoutConflict:
            return False
        return (
            operation.PYMT_ID_id == payment.pk
            and operation.PCHK_PROVIDER == payment.PYMT_PROVIDER
            and operation.PCHK_MODE == payment.PYMT_MODE
            and operation.PCHK_STATE in {
                PaymentCheckoutSession.State.READY,
                PaymentCheckoutSession.State.EXPIRED,
            }
            and operation.PCHK_LAST_ERROR not in {
                "provider_identity_conflict",
                "ownership_requires_review",
            }
            and operation.PCHK_PROVIDER_STATUS in cls.TERMINAL_MAYA_OUTCOMES
            and MayaCheckoutService.is_checkout_id(operation.PCHK_PROVIDER_SESSION_ID)
            and not payment.PYMT_PROVIDER_PAYMENT_ID
            and payment.PYMT_PAID_AT is None
            and payment.PYMT_VERIFIED_AT is None
        )

    @classmethod
    def _response(
        cls,
        payment,
        operation,
        *,
        created,
    ):
        """Present only the owner's resumable checkout or safe waiting instructions."""
        checkout_state = operation.PCHK_STATE if operation is not None else None
        status_code = 202
        session_id = None
        checkout_url = None
        next_action = "wait"
        check_after_seconds = 5
        if checkout_state == PaymentCheckoutSession.State.READY:
            check_after_seconds = None
            if cls.can_resume(payment, operation):
                session_id = operation.PCHK_PROVIDER_SESSION_ID
                checkout_url = operation.PCHK_CHECKOUT_URL
                next_action = "open_checkout"
                status_code = 201 if created else 200
        return {
            "payment_id": payment.pk,
            "payment_reference": payment.PYMT_REFERENCE,
            "product": {
                "code": payment.PYMT_PRODUCT,
                "name": MERCHANT_PLUS_PRODUCT.name,
            },
            "amount_centavos": payment.PYMT_AMOUNT_CENTAVOS,
            "currency": payment.PYMT_CURRENCY,
            "provider": payment.PYMT_PROVIDER,
            "mode": payment.PYMT_MODE,
            "payment_status": payment.PYMT_STATUS,
            "fulfilment_status": payment.PYMT_FULFILMENT_STATUS,
            "checkout_status": checkout_state,
            "checkout_session_id": session_id,
            "checkout_url": checkout_url,
            "next_action": next_action,
            "status_check_after_seconds": check_after_seconds,
        }, status_code
