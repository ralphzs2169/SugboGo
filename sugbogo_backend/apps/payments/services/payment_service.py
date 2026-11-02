"""Server-controlled local purchases and environment-scoped entitlement reads."""

from dataclasses import asdict

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.business.models import Business
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.users.models import User

from ..constants import MERCHANT_PLUS_PRODUCT
from ..models import Payment, PaymentMode


class PaymentService:
    """Own local payment eligibility without contacting or trusting a payment client."""

    @staticmethod
    def get_product():
        """Return a detached presentation of the immutable server product."""
        return asdict(MERCHANT_PLUS_PRODUCT)

    @staticmethod
    def current_mode():
        """Resolve the configured environment without changing historical records."""
        mode = settings.PAYMONGO_MODE
        if mode not in PaymentMode.values:
            raise ValidationError("The payment environment is unavailable.")
        return mode

    @staticmethod
    def require_merchant(user):
        """Require an authenticated active Merchant before resolving any purchase data."""
        if (
            not user
            or not user.is_authenticated
            or not user.is_active
            or user.USER_ROLE != User.UserRole.MERCHANT
        ):
            raise PermissionDenied("An active Merchant account is required.")

    @classmethod
    def get_owned_business(
        cls,
        user,
        *,
        business_id=None,
    ):
        """Resolve ownership on the server and reject cross-business service calls."""
        cls.require_merchant(user)
        business = BusinessProfileService.get_business_for_merchant(user)
        if (
            business_id is not None
            and business.pk != business_id
        ):
            raise PermissionDenied("You can only purchase Merchant Plus for your own business.")
        return business

    @classmethod
    def get_active_paid_entitlement(
        cls,
        user,
        *,
        business=None,
        now=None,
    ):
        """Read only fulfilled, owned, unexpired access in the configured environment."""
        from apps.merchant_operations.merchant_analytics.models import PaidMerchantPlusEntitlement

        cls.require_merchant(user)
        if now is None:
            now = timezone.now()
        queryset = (
            PaidMerchantPlusEntitlement.objects
            .select_related("PYMT_ID")
            .filter(
                BUSN_ID__USER_ID=user,
                PYMT_ID__USER_ID=user,
                PYMT_ID__BUSN_ID=F("BUSN_ID"),
                PYMT_ID__PYMT_PRODUCT=MERCHANT_PLUS_PRODUCT.code,
                PYMT_ID__PYMT_MODE=cls.current_mode(),
                PYMT_ID__PYMT_STATUS=Payment.Status.PAID,
                PYMT_ID__PYMT_FULFILMENT_STATUS=Payment.FulfilmentStatus.FULFILLED,
                MPPE_STARTS_AT__lte=now,
                MPPE_EXPIRES_AT__gt=now,
            )
            .order_by("-MPPE_EXPIRES_AT", "-MPPE_ID")
        )
        if business is not None:
            queryset = queryset.filter(BUSN_ID=business)
        return queryset.first()

    @classmethod
    def get_unresolved_payment(
        cls,
        user,
        *,
        business=None,
    ):
        """Find the owner's unpaid or unfulfilled purchase in the current mode."""
        cls.require_merchant(user)
        queryset = Payment.objects.filter(
            USER_ID=user,
            BUSN_ID__USER_ID=user,
            PYMT_PRODUCT=MERCHANT_PLUS_PRODUCT.code,
            PYMT_MODE=cls.current_mode(),
        ).filter(
            Q(PYMT_STATUS=Payment.Status.PENDING)
            | ~Q(PYMT_FULFILMENT_STATUS=Payment.FulfilmentStatus.FULFILLED)
            | Q(paid_plus_entitlement__isnull=True),
        )
        if business is not None:
            queryset = queryset.filter(BUSN_ID=business)
        return queryset.first()

    @classmethod
    def get_purchase_eligibility(
        cls,
        user,
        *,
        business=None,
    ):
        """Describe domain eligibility separately from whether gateway checkout is enabled."""
        if business is None:
            business = cls.get_owned_business(user)
        else:
            cls.require_merchant(user)
            if business.USER_ID_id != user.pk:
                raise PermissionDenied("You can only purchase Merchant Plus for your own business.")
        active = cls.get_active_paid_entitlement(user, business=business)
        unresolved = cls.get_unresolved_payment(user, business=business)
        reason = None
        active_payment = None
        if active is not None:
            reason = "paid_access_active"
            active_payment = active.PYMT_ID
        elif unresolved is not None:
            reason = "payment_unresolved"
        return {
            "eligible": reason is None,
            "reason": reason,
            "active_entitlement": active,
            "active_payment": active_payment,
            "unresolved_payment": unresolved,
        }

    @classmethod
    @transaction.atomic
    def create_or_get_payment(
        cls,
        user,
        *,
        business_id=None,
    ):
        """Reserve one fixed-price local obligation without creating gateway checkout."""
        owned = cls.get_owned_business(user, business_id=business_id)
        try:
            business = Business.objects.select_for_update().get(
                pk=owned.pk,
                USER_ID=user,
            )
        except Business.DoesNotExist:
            raise NotFound("Your business could not be found.") from None
        eligibility = cls.get_purchase_eligibility(user, business=business)
        if eligibility["active_payment"] is not None:
            raise ValidationError("Merchant Plus paid access is already active.")
        if eligibility["unresolved_payment"] is not None:
            return eligibility["unresolved_payment"], False
        product = MERCHANT_PLUS_PRODUCT
        payment = Payment.objects.create(
            USER_ID=user,
            BUSN_ID=business,
            PYMT_PRODUCT=product.code,
            PYMT_PRODUCT_VERSION=product.version,
            PYMT_AMOUNT_CENTAVOS=product.amount_centavos,
            PYMT_CURRENCY=product.currency,
            PYMT_ACCESS_DURATION_DAYS=product.access_duration_days,
            PYMT_MODE=cls.current_mode(),
        )
        return payment, True

    @classmethod
    def get_owned_payment(
        cls,
        user,
        payment_id,
    ):
        """Retrieve owned historical purchases without applying the current mode to history."""
        cls.require_merchant(user)
        try:
            return Payment.objects.select_related("BUSN_ID").get(
                pk=payment_id,
                USER_ID=user,
                BUSN_ID__USER_ID=user,
            )
        except Payment.DoesNotExist:
            raise NotFound("Payment could not be found.") from None
