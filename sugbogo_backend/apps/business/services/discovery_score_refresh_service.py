import logging
from datetime import timedelta
from functools import partial

from django.db import DatabaseError, transaction
from django.db.models import DecimalField, F, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.models import DiscoveryAlgorithmConfiguration
from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import Business, DiscoveryScore

logger = logging.getLogger(__name__)


class DiscoveryScoreRefreshService:
    """Retains lightweight pending state so scheduled reconciliation can recover work."""

    MAX_SCORE_AGE = timedelta(hours=26)
    RECONCILIATION_LIMIT = 100
    SCORING_CONFIGURATION_FIELDS = (
        "DAC_SPECIALTY_SCORE_WEIGHT",
        "DAC_VISIBILITY_GAP_WEIGHT",
        "DAC_DECAY_RATE",
        "DAC_MIN_CATEGORY_COMPARISON_SIZE",
        "DAC_MIN_CLUSTER_COMPARISON_SIZE",
        "DAC_VISIBILITY_WINDOW_DAYS",
        "DAC_IMPRESSION_WEIGHT",
        "DAC_PROFILE_VISIT_WEIGHT",
        "DAC_SAVE_WEIGHT",
    )

    @staticmethod
    def request_global_refresh():
        """Marks existing active scores dirty when shared scoring configuration changes."""
        requested_at = timezone.now()
        DiscoveryScore.objects.filter(
            BUSN_ID__BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        ).update(
            DSC_REFRESH_VERSION=F("DSC_REFRESH_VERSION") + 1,
            DSC_REFRESH_REQUESTED_AT=requested_at,
        )
        transaction.on_commit(
            partial(
                DiscoveryScoreRefreshService._publish_global,
                requested_at,
            ),
        )

    @staticmethod
    def _publish_global(requested_at):
        """Retains dirty scores for reconciliation if a shared refresh cannot publish."""
        from apps.business.tasks import recompute_discovery_scores

        try:
            recompute_discovery_scores.delay()
        except Exception:
            try:
                DiscoveryScore.objects.filter(
                    DSC_REFRESH_REQUESTED_AT=requested_at,
                ).update(DSC_LAST_ERROR="DISPATCH_FAILED")
            except DatabaseError:
                logger.exception("Could not record global discovery publish failure.")
            logger.exception("Global discovery refresh publishing failed; pending state retained.")

    @staticmethod
    def missing_score_expression():
        """Uses the configured no-evidence baseline without computing scores in feeds."""
        weight = DiscoveryAlgorithmConfiguration.objects.filter(
            pk=1,
        ).values("DAC_VISIBILITY_GAP_WEIGHT")[:1]
        return Coalesce(
            Subquery(weight),
            Value(
                DiscoveryAlgorithmConfiguration._meta.get_field(
                    "DAC_VISIBILITY_GAP_WEIGHT",
                ).get_default(),
            ),
            output_field=DecimalField(
                max_digits=6,
                decimal_places=5,
            ),
        )

    @staticmethod
    @transaction.atomic
    def initialize(
        business_id,
        configuration=None,
    ):
        """Creates a provisional no-evidence baseline without asserting measured visibility."""
        from apps.business.services.discovery_score_service import DiscoveryScoreService

        try:
            Business.objects.select_for_update().get(
                pk=business_id,
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        except Business.DoesNotExist:
            raise NotFound("The active business could not be found.") from None
        if configuration is None:
            configuration = DiscoveryAlgorithmConfigurationService.get_current_configuration()
        initial_score = DiscoveryScoreService.calculate_discovery_score(
            specialty_score=0,
            visibility_gap=1,
            specialty_weight=configuration.DAC_SPECIALTY_SCORE_WEIGHT,
            visibility_weight=configuration.DAC_VISIBILITY_GAP_WEIGHT,
        )
        score, _ = DiscoveryScore.objects.get_or_create(
            BUSN_ID_id=business_id,
            defaults={
                "DSC_S_SCORE": 0,
                "DSC_V_SCORE": 1,
                "DSC_D_SCORE": DiscoveryScoreService._quantize_score(initial_score),
                "DSC_COMPUTED_AT": None,
                "DSC_IS_PROVISIONAL": True,
                "DSC_REFRESH_REQUESTED_AT": timezone.now(),
            },
        )
        return score

    @staticmethod
    @transaction.atomic
    def request_refresh(
        business_id,
        publisher=None,
        invalidate=True,
    ):
        """Pairs each invalidation generation with its latest time before publishing work."""
        try:
            score = DiscoveryScoreRefreshService.initialize(business_id)
        except NotFound:
            return
        if invalidate:
            score.DSC_REFRESH_VERSION += 1
            # Keep the time paired with the latest generation, even while pending.
            score.DSC_REFRESH_REQUESTED_AT = timezone.now()
        elif score.DSC_REFRESH_REQUESTED_AT is None:
            score.DSC_REFRESH_REQUESTED_AT = timezone.now()
        score.save(
            update_fields=[
                "DSC_REFRESH_VERSION",
                "DSC_REFRESH_REQUESTED_AT",
                "DSC_UPDATED_AT",
            ],
        )
        transaction.on_commit(
            partial(
                DiscoveryScoreRefreshService._publish,
                business_id=business_id,
                version=score.DSC_REFRESH_VERSION,
                publisher=publisher,
            ),
        )

    @staticmethod
    def _publish(
        business_id,
        version,
        publisher=None,
    ):
        """Records publish failure without misreporting a committed domain transaction."""
        try:
            if publisher is None:
                from apps.business.tasks import recompute_business_discovery_score

                recompute_business_discovery_score.delay(business_id=business_id)
            else:
                publisher(business_id=business_id)
        except Exception:
            try:
                DiscoveryScore.objects.filter(
                    BUSN_ID_id=business_id,
                    DSC_REFRESH_VERSION=version,
                    DSC_REFRESH_REQUESTED_AT__isnull=False,
                ).update(DSC_LAST_ERROR="DISPATCH_FAILED")
            except DatabaseError:
                logger.exception(
                    "Could not record business discovery publish failure.",
                    extra={"business_id": business_id},
                )
            logger.exception(
                "Discovery refresh publishing failed; pending state retained.",
                extra={"business_id": business_id},
            )

    @staticmethod
    def needs_refresh(
        score,
        reference_time,
    ):
        """Distinguishes pending/provisional/stale state from a recent successful score."""
        return (
            score.DSC_IS_PROVISIONAL
            or score.DSC_COMPUTED_AT is None
            or score.DSC_REFRESH_REQUESTED_AT is not None
            or bool(score.DSC_LAST_ERROR)
            or score.DSC_COMPUTED_AT < reference_time - DiscoveryScoreRefreshService.MAX_SCORE_AGE
        )

    @staticmethod
    def record_attempt(
        business_id,
        version,
        reference_time,
    ):
        """Leaves an observable pending marker when a worker dies during calculation."""
        return DiscoveryScore.objects.filter(
            Q(DSC_LAST_ATTEMPT_AT__isnull=True)
            | Q(DSC_LAST_ATTEMPT_AT__lte=reference_time),
            Q(DSC_COMPUTED_AT__isnull=True)
            | Q(DSC_COMPUTED_AT__lt=reference_time),
            BUSN_ID_id=business_id,
            DSC_REFRESH_VERSION=version,
        ).update(
            DSC_LAST_ATTEMPT_AT=reference_time,
            DSC_REFRESH_REQUESTED_AT=Coalesce(
                "DSC_REFRESH_REQUESTED_AT",
                Value(reference_time),
            ),
        )

    @staticmethod
    def record_failure(
        business_id,
        version,
        reference_time,
        error,
    ):
        """Records safe error codes without letting an older failure taint newer success."""
        DiscoveryScore.objects.filter(
            Q(DSC_COMPUTED_AT__isnull=True)
            | Q(DSC_COMPUTED_AT__lt=reference_time),
            BUSN_ID_id=business_id,
            DSC_REFRESH_VERSION=version,
            DSC_LAST_ATTEMPT_AT=reference_time,
        ).update(DSC_LAST_ERROR=type(error).__name__[:64])

    @staticmethod
    def reconcile():
        """Republishes a bounded oldest-first set of missing, pending, or stale scores."""
        cutoff = timezone.now() - DiscoveryScoreRefreshService.MAX_SCORE_AGE
        ids = list(
            Business.objects.filter(
                Q(discovery_score__isnull=True)
                | Q(discovery_score__DSC_IS_PROVISIONAL=True)
                | Q(discovery_score__DSC_COMPUTED_AT__isnull=True)
                | Q(discovery_score__DSC_COMPUTED_AT__lt=cutoff)
                | Q(discovery_score__DSC_LAST_ERROR__gt="")
                | Q(discovery_score__DSC_REFRESH_REQUESTED_AT__isnull=False),
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            ).order_by(
                F("discovery_score__DSC_LAST_ATTEMPT_AT").asc(nulls_first=True),
                "BUSN_ID",
            ).values_list("BUSN_ID", flat=True)[:DiscoveryScoreRefreshService.RECONCILIATION_LIMIT],
        )
        for business_id in ids:
            DiscoveryScoreRefreshService.request_refresh(
                business_id,
                invalidate=False,
            )
        return {
            "requested": len(ids),
            "limit": DiscoveryScoreRefreshService.RECONCILIATION_LIMIT,
        }
