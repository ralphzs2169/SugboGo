"""Durable, model-independent dispatch and recovery for experimental ratings."""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from apps.business.models import Business
from apps.reviews.models import BusinessRating
from apps.reviews.services.business_rating_service import BusinessRatingService

logger = logging.getLogger(__name__)


class BusinessRatingWorkService:
    """Coalesce source changes by business using the aggregate's durable revision."""

    BATCH_SIZE = 100

    @classmethod
    @transaction.atomic
    def request_changes(
        cls,
        business_ids,
    ):
        """Record explicit bulk mutation demand in stable business lock order."""
        for business_id in sorted(set(business_ids)):
            cls.request_change(business_id)

    @classmethod
    @transaction.atomic
    def request_change(
        cls,
        business_id,
        initialize=True,
    ):
        """Record demand in the source transaction and publish only after commit."""
        business = (
            Business.objects
            .select_for_update()
            .filter(pk=business_id)
            .first()
        )
        if business is None:
            return False
        if (
            not initialize
            and not BusinessRating.objects.filter(BUSN_ID=business).exists()
        ):
            return False
        aggregate, _ = BusinessRating.objects.select_for_update().get_or_create(
            BUSN_ID=business,
            defaults={
                "BRAT_SCORING_VERSION": settings.BUSINESS_RATING_DEFAULT_SCORING_VERSION,
                "BRAT_CALCULATION_VERSION": BusinessRatingService.CALCULATION_VERSION,
            },
        )
        aggregate.BRAT_REQUESTED_REVISION += 1
        aggregate.BRAT_ATTEMPTS = 0
        aggregate.BRAT_RETRY_AT = None
        aggregate.BRAT_LAST_ERROR = ""
        aggregate.save(update_fields=[
            "BRAT_REQUESTED_REVISION",
            "BRAT_ATTEMPTS",
            "BRAT_RETRY_AT",
            "BRAT_LAST_ERROR",
            "BRAT_UPDATED_AT",
        ])
        transaction.on_commit(
            lambda: cls.dispatch(business_id),
            robust=True,
        )
        return True

    @staticmethod
    def dispatch(business_id):
        """Treat broker delivery as a hint while durable demand remains authoritative."""
        if not settings.BUSINESS_RATING_AUTO_UPDATES_ENABLED:
            return False
        from apps.reviews.tasks import recalculate_business_rating

        try:
            recalculate_business_rating.apply_async(
                args=[business_id],
                retry=False,
            )
        except Exception as exc:
            logger.warning(
                "Rating dispatch failed; durable demand remains pending. business_id=%s error=%s",
                business_id,
                type(exc).__name__,
            )
            return False
        return True

    @staticmethod
    @transaction.atomic
    def process(business_id):
        """Read the latest version and revision under the same lock used by invalidation."""
        if not settings.BUSINESS_RATING_AUTO_UPDATES_ENABLED:
            return "disabled"
        business = (
            Business.objects
            .select_for_update()
            .filter(pk=business_id)
            .first()
        )
        if business is None:
            return "missing"
        aggregate = (
            BusinessRating.objects
            .select_for_update()
            .filter(BUSN_ID=business)
            .first()
        )
        if aggregate is None:
            return "missing"
        if aggregate.BRAT_REQUESTED_REVISION == aggregate.BRAT_COMPLETED_REVISION:
            return "unchanged"
        if (
            aggregate.BRAT_RETRY_AT
            and aggregate.BRAT_RETRY_AT > timezone.now()
        ):
            return "retry_wait"
        BusinessRatingService.recompute(
            business_id,
            aggregate.BRAT_SCORING_VERSION,
            allow_legacy=True,
            expected_revision=aggregate.BRAT_REQUESTED_REVISION,
        )
        return "updated"

    @staticmethod
    @transaction.atomic
    def record_failure(
        business_id,
        revision,
        error_type,
    ):
        """Back off only the failed revision without overwriting newer demand."""
        if not Business.objects.select_for_update().filter(pk=business_id).exists():
            return None
        aggregate = (
            BusinessRating.objects
            .select_for_update()
            .filter(
                BUSN_ID_id=business_id,
                BRAT_REQUESTED_REVISION=revision,
                BRAT_COMPLETED_REVISION__lt=revision,
            )
            .first()
        )
        if aggregate is None:
            return None
        aggregate.BRAT_ATTEMPTS += 1
        delay = min(30 * (2 ** min(aggregate.BRAT_ATTEMPTS - 1, 4)), 300)
        aggregate.BRAT_RETRY_AT = timezone.now() + timedelta(seconds=delay)
        aggregate.BRAT_LAST_ERROR = error_type[:64]
        aggregate.save(update_fields=[
            "BRAT_ATTEMPTS",
            "BRAT_RETRY_AT",
            "BRAT_LAST_ERROR",
            "BRAT_UPDATED_AT",
        ])
        return delay

    @classmethod
    def recover_pending(cls):
        """Redispatch bounded due work independently of original broker delivery."""
        if not settings.BUSINESS_RATING_AUTO_UPDATES_ENABLED:
            return 0
        ids = list(
            BusinessRating.objects
            .filter(BRAT_REQUESTED_REVISION__gt=F("BRAT_COMPLETED_REVISION"))
            .filter(
                Q(BRAT_RETRY_AT__isnull=True)
                | Q(BRAT_RETRY_AT__lte=timezone.now()),
            )
            .order_by("BRAT_UPDATED_AT", "pk")
            .values_list("BUSN_ID_id", flat=True)[:cls.BATCH_SIZE]
        )
        return sum(
            cls.dispatch(business_id)
            for business_id in ids
        )

    @classmethod
    def reconcile(cls):
        """Rotate through missing or aged snapshots to repair bypassed bulk mutations."""
        if not settings.BUSINESS_RATING_AUTO_UPDATES_ENABLED:
            return 0
        cutoff = timezone.now() - timedelta(hours=1)
        ids = list(
            Business.objects
            .filter(
                Q(business_rating__isnull=True)
                | (
                    Q(
                        business_rating__BRAT_REQUESTED_REVISION=F(
                            "business_rating__BRAT_COMPLETED_REVISION",
                        ),
                    )
                    & (
                        Q(business_rating__BRAT_COMPUTED_AT__isnull=True)
                        | Q(business_rating__BRAT_COMPUTED_AT__lt=cutoff)
                        | ~Q(
                            business_rating__BRAT_CALCULATION_VERSION=(
                                BusinessRatingService.CALCULATION_VERSION
                            ),
                        )
                    )
                ),
            )
            .order_by(
                F("business_rating__BRAT_COMPUTED_AT").asc(nulls_first=True),
                "pk",
            )
            .values_list("pk", flat=True)[:cls.BATCH_SIZE]
        )
        for business_id in ids:
            cls.request_change(business_id)
        return len(ids)

