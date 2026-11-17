"""Server-side payment directory queries without financial side effects."""

from datetime import datetime, time, timedelta

from django.db.models import (
    BooleanField,
    Case,
    CharField,
    Count,
    Exists,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Cast, Concat
from rest_framework.exceptions import NotFound

from apps.business.services.display_cover_photo import display_cover_photo_expression
from apps.payments.constants import MERCHANT_PLUS_PRODUCT
from apps.payments.models import Payment, PaymentCheckoutSession, PaymentProviderEvent
from apps.shared.analytics.date_ranges import MANILA


class PaymentInspectionService:
    """Load all environments and providers without invoking payment domain operations."""

    @staticmethod
    def queryset():
        """Annotate the latest outcome and stored review evidence using bounded SQL queries."""
        checkouts = PaymentCheckoutSession.objects.filter(PYMT_ID=OuterRef("pk"))
        latest = checkouts.order_by("-PCHK_ID")
        # Verification failures can remain unlinked in the inbox; correlate them
        # only through an already stored checkout identity in the same provider/mode.
        checkout_ids = PaymentCheckoutSession.objects.filter(
            PYMT_ID=OuterRef(OuterRef("pk")),
            PCHK_PROVIDER_SESSION_ID__isnull=False,
        ).values("PCHK_PROVIDER_SESSION_ID")
        events = PaymentProviderEvent.objects.filter(
            Q(PYMT_ID=OuterRef("pk"))
            | Q(PCHK_ID__PYMT_ID=OuterRef("pk"))
            | Q(
                PWEV_PROVIDER=OuterRef("PYMT_PROVIDER"),
                PWEV_MODE=OuterRef("PYMT_MODE"),
                PWEV_PROVIDER_CHECKOUT_ID__in=Subquery(checkout_ids),
            ),
        )
        return (
            Payment.objects
            .filter(PYMT_PRODUCT=MERCHANT_PLUS_PRODUCT.code)
            .select_related("USER_ID", "BUSN_ID")
            .annotate(
                checkout_state=Subquery(latest.values("PCHK_STATE")[:1]),
                checkout_provider=Subquery(latest.values("PCHK_PROVIDER")[:1]),
                checkout_provider_status=Subquery(latest.values("PCHK_PROVIDER_STATUS")[:1]),
                uncertain_checkout=Exists(
                    checkouts.filter(PCHK_STATE="creation_unknown"),
                ),
                event_attention=Exists(events.filter(PWEV_STATE="needs_attention")),
            )
            .annotate(
                needs_review=Case(
                    When(
                        Q(PYMT_FULFILMENT_STATUS="needs_attention")
                        | Q(uncertain_checkout=True)
                        | Q(event_attention=True),
                        then=Value(True),
                    ),
                    default=Value(False),
                    output_field=BooleanField(),
                ),
                checkout_outcome=Case(
                    When(PYMT_STATUS="paid", then=Value(None)),
                    When(
                        checkout_provider="maya",
                        checkout_provider_status="PAYMENT_CANCELLED",
                        then=Value("cancelled"),
                    ),
                    When(
                        checkout_provider="maya",
                        checkout_provider_status="PAYMENT_FAILED",
                        then=Value("failed"),
                    ),
                    When(
                        checkout_provider="maya",
                        checkout_provider_status="PAYMENT_EXPIRED",
                        then=Value("expired"),
                    ),
                    When(checkout_state="expired", then=Value("expired")),
                    When(
                        checkout_state__in=("creating", "ready"),
                        checkout_provider_status__in=("", "PENDING_TOKEN", "PENDING_PAYMENT"),
                        then=Value("pending"),
                    ),
                    default=Value("unknown"),
                    output_field=CharField(),
                ),
            )
        )

    @staticmethod
    def list_payments(filters):
        """Apply validated criteria and deterministic ordering before pagination."""
        queryset = PaymentInspectionService.queryset().annotate(
            display_cover_photo_url=display_cover_photo_expression("BUSN_ID"),
        )
        search = filters.get("search")
        if search:
            queryset = queryset.annotate(
                public_reference=Cast("PYMT_REFERENCE", output_field=CharField()),
                purchaser_name=Concat(
                    "USER_ID__USER_FNAME",
                    Value(" "),
                    "USER_ID__USER_LNAME",
                ),
            ).filter(
                Q(public_reference__icontains=search)
                | Q(purchaser_name__icontains=search)
                | Q(USER_ID__USER_EMAIL__icontains=search)
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
                | Q(PYMT_PROVIDER_PAYMENT_ID__icontains=search),
            )
        fields = {
            "financial_status": "PYMT_STATUS",
            "fulfilment_status": "PYMT_FULFILMENT_STATUS",
            "provider": "PYMT_PROVIDER",
            "mode": "PYMT_MODE",
            "checkout_outcome": "checkout_outcome",
            "needs_review": "needs_review",
        }
        for key, field in fields.items():
            if key in filters:
                queryset = queryset.filter(**{field: filters[key]})
        if filters.get("start_date"):
            queryset = queryset.filter(
                PYMT_CREATED_AT__gte=datetime.combine(
                    filters["start_date"],
                    time.min,
                    tzinfo=MANILA,
                ),
            )
        if filters.get("end_date"):
            queryset = queryset.filter(
                PYMT_CREATED_AT__lt=datetime.combine(
                    filters["end_date"] + timedelta(days=1),
                    time.min,
                    tzinfo=MANILA,
                ),
            )
        ordering = {
            "newest": ("-PYMT_CREATED_AT", "-PYMT_ID"),
            "oldest": ("PYMT_CREATED_AT", "PYMT_ID"),
            "amount_highest": ("-PYMT_AMOUNT_CENTAVOS", "-PYMT_ID"),
            "amount_lowest": ("PYMT_AMOUNT_CENTAVOS", "PYMT_ID"),
        }
        return queryset.order_by(*ordering[filters.get("ordering", "newest")])

    @staticmethod
    def get_summary():
        """Aggregate global Merchant Plus counts independently of directory filters."""
        summary = PaymentInspectionService.queryset().aggregate(
            total_payments=Count("pk"),
            pending=Count("pk", filter=Q(PYMT_STATUS="pending")),
            paid=Count("pk", filter=Q(PYMT_STATUS="paid")),
            review_count=Count("pk", filter=Q(needs_review=True)),
        )
        summary["needs_review"] = summary.pop("review_count")
        return summary

    @staticmethod
    def get_payment(payment_id):
        """Load an inspection snapshot and chronological metadata without tokenized URLs."""
        try:
            payment = (
                PaymentInspectionService.queryset()
                .select_related("paid_plus_entitlement", "BUSN_ID__USER_ID")
                .annotate(
                    display_cover_photo_url=display_cover_photo_expression("BUSN_ID"),
                )
                .prefetch_related(
                    Prefetch(
                        "checkout_sessions",
                        queryset=PaymentCheckoutSession.objects
                        .defer("PCHK_CHECKOUT_URL")
                        .order_by("PCHK_ID"),
                        to_attr="inspection_checkouts",
                    ),
                )
                .get(pk=payment_id)
            )
        except Payment.DoesNotExist:
            raise NotFound("Payment could not be found.") from None
        checkout_ids = [
            checkout.pk
            for checkout in payment.inspection_checkouts
        ]
        provider_ids = [
            checkout.PCHK_PROVIDER_SESSION_ID
            for checkout in payment.inspection_checkouts
            if checkout.PCHK_PROVIDER_SESSION_ID
        ]
        payment.inspection_events = list(
            PaymentProviderEvent.objects.filter(
                Q(PYMT_ID=payment)
                | Q(PCHK_ID_id__in=checkout_ids)
                | Q(
                    PWEV_PROVIDER=payment.PYMT_PROVIDER,
                    PWEV_MODE=payment.PYMT_MODE,
                    PWEV_PROVIDER_CHECKOUT_ID__in=provider_ids,
                ),
            )
            .defer("PWEV_DATA", "PWEV_PAYLOAD_DIGEST", "PWEV_DEDUPE_KEY")
            .order_by("PWEV_RECEIVED_AT", "PWEV_ID"),
        )
        return payment
