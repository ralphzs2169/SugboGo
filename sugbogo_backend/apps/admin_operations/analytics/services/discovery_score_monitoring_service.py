"""Discovery score monitoring queries for administrators."""

from dataclasses import asdict
from datetime import timedelta

from django.db.models import Case, CharField, Count, F, Max, Prefetch, Q, Value, When
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.admin_operations.system_configuration.models import DiscoveryAlgorithmConfiguration
from apps.admin_operations.system_configuration.services.discovery_algorithm_configuration_service import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.business.models import Business, BusinessSpecialtyTag, DiscoveryScore
from apps.business.services.discovery_score_service import DiscoveryScoreService
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService
from apps.business.services.visibility_gap_service import VisibilityGapService


class DiscoveryScoreMonitoringService:
    """Provides persisted score records and delegates recomputation."""

    TELEMETRY_NOTE = (
        "Telemetry coverage is unverified. Recorded activity may be incomplete; "
        "zero recorded events do not establish zero exposure. "
        "Score freshness describes computation, not telemetry completeness."
    )

    @staticmethod
    def visibility_context():
        """Read current settings once without initializing or persisting configuration."""
        configuration = DiscoveryAlgorithmConfiguration.objects.filter(
            pk=DiscoveryAlgorithmConfigurationService.SINGLETON_ID,
        ).first()
        if configuration is None:
            configuration = DiscoveryAlgorithmConfiguration(
                pk=DiscoveryAlgorithmConfigurationService.SINGLETON_ID,
            )
        return {
            "configuration": configuration,
            "reference_time": timezone.now(),
        }

    @staticmethod
    def observation_context(
        business,
        reference_time,
        window_days,
    ):
        """Describe potential observation age without asserting continuous tracking."""
        age = max(
            timedelta(0),
            reference_time - business.BUSN_CREATED_AT,
        )
        window = timedelta(days=window_days)
        potential_duration = min(age, window)
        return {
            "business_created_at": business.BUSN_CREATED_AT,
            "reference_time": reference_time,
            "window_days": window_days,
            "potential_observation_days": round(
                potential_duration.total_seconds() / timedelta(days=1).total_seconds(),
                2,
            ),
            "short_history": age < window,
        }

    @classmethod
    def visibility_diagnostics(
        cls,
        business_id,
    ):
        """Calculate current visibility context without saving scores or initializing indexes."""
        try:
            business = Business.objects.get(
                pk=business_id,
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        except Business.DoesNotExist:
            raise NotFound("The active business could not be found.") from None
        context = cls.visibility_context()
        configuration = context["configuration"]
        reference_time = context["reference_time"]
        result = VisibilityGapService.calculate_business_visibility_gap(
            business_id=business_id,
            reference_time=reference_time,
            configuration=configuration,
            read_only=True,
        )
        return {
            **asdict(result),
            "reference_time": reference_time,
            "observation_context": cls.observation_context(
                business,
                reference_time,
                configuration.DAC_VISIBILITY_WINDOW_DAYS,
            ),
            "signal_weights": {
                "impressions": configuration.DAC_IMPRESSION_WEIGHT,
                "profile_visits": configuration.DAC_PROFILE_VISIT_WEIGHT,
                "saves": configuration.DAC_SAVE_WEIGHT,
            },
            "coverage_verified": False,
            "telemetry_reason": "coverage_unverified",
            "telemetry_note": cls.TELEMETRY_NOTE,
        }

    @staticmethod
    def list_scores(
        search=None,
        status=None,
        cluster=None,
        category=None,
        specialty_tag=None,
        ordering=None,
        score_state=None,
    ):
        """Return scored businesses with identity relations loaded in batches."""

        active_tags = (
            BusinessSpecialtyTag.objects
            .filter(BST_IS_ACTIVE=True)
            .select_related("TAG_ID")
        )
        queryset = (
            DiscoveryScore.objects
            .annotate(
                score_state=Case(
                    When(~Q(DSC_LAST_ERROR=""), then=Value("FAILED")),
                    When(DSC_IS_PROVISIONAL=True, then=Value("PROVISIONAL")),
                    When(DSC_REFRESH_REQUESTED_AT__isnull=False, then=Value("PENDING")),
                    When(
                        DSC_COMPUTED_AT__lt=(
                            timezone.now() - DiscoveryScoreRefreshService.MAX_SCORE_AGE
                        ),
                        then=Value("STALE"),
                    ),
                    When(DSC_COMPUTED_AT__isnull=True, then=Value("PENDING")),
                    default=Value("FRESH"),
                    output_field=CharField(),
                ),
            )
            .select_related(
                "BUSN_ID",
                "BUSN_ID__CTGRY_ID",
                "BUSN_ID__CTGRY_ID__CLUS_ID",
            )
            .prefetch_related(
                Prefetch(
                    "BUSN_ID__specialty_tag_links",
                    queryset=active_tags,
                    to_attr="active_specialty_tag_links",
                ),
            )
        )

        if search:
            queryset = queryset.filter(BUSN_ID__BUSN_NAME__icontains=search)
        if score_state:
            queryset = queryset.filter(score_state=score_state)
        if status:
            queryset = queryset.filter(BUSN_ID__BUSN_STATUS=status)
        if cluster:
            queryset = queryset.filter(BUSN_ID__CTGRY_ID__CLUS_ID=cluster)
        if category:
            queryset = queryset.filter(BUSN_ID__CTGRY_ID=category)
        if specialty_tag:
            queryset = queryset.filter(
                BUSN_ID__specialty_tag_links__TAG_ID=specialty_tag,
                BUSN_ID__specialty_tag_links__BST_IS_ACTIVE=True,
            )

        ordering_map = {
            "business_name": "BUSN_ID__BUSN_NAME",
            "-business_name": "-BUSN_ID__BUSN_NAME",
            "specialty_score": "DSC_S_SCORE",
            "-specialty_score": "-DSC_S_SCORE",
            "visibility_gap": "DSC_V_SCORE",
            "-visibility_gap": "-DSC_V_SCORE",
            "discovery_score": "DSC_D_SCORE",
            "-discovery_score": "-DSC_D_SCORE",
            "computed_at": "DSC_COMPUTED_AT",
            "-computed_at": "-DSC_COMPUTED_AT",
        }
        return queryset.order_by(
            ordering_map.get(ordering, "-DSC_COMPUTED_AT"),
            "DSC_ID",
        )

    @staticmethod
    def coverage():
        """Summarizes current active-business coverage without claiming job-run history."""
        now = timezone.now()
        active = Business.objects.filter(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
        computed = Q(
            discovery_score__DSC_IS_PROVISIONAL=False,
            discovery_score__DSC_COMPUTED_AT__isnull=False,
        )
        counts = active.aggregate(
            active_businesses=Count("pk"),
            missing=Count("pk", filter=Q(discovery_score__isnull=True)),
            provisional=Count("pk", filter=Q(discovery_score__DSC_IS_PROVISIONAL=True)),
            computed=Count("pk", filter=computed),
            fresh=Count(
                "pk",
                filter=computed & Q(
                    discovery_score__DSC_COMPUTED_AT__gte=(
                        now - DiscoveryScoreRefreshService.MAX_SCORE_AGE
                    ),
                    discovery_score__DSC_REFRESH_REQUESTED_AT__isnull=True,
                    discovery_score__DSC_LAST_ERROR="",
                ),
            ),
            stale=Count(
                "pk",
                filter=computed & Q(
                    discovery_score__DSC_COMPUTED_AT__lt=(
                        now - DiscoveryScoreRefreshService.MAX_SCORE_AGE
                    ),
                ),
            ),
            pending=Count(
                "pk",
                filter=Q(discovery_score__DSC_REFRESH_REQUESTED_AT__isnull=False),
            ),
            failed=Count(
                "pk",
                filter=Q(discovery_score__isnull=False)
                & ~Q(discovery_score__DSC_LAST_ERROR=""),
            ),
            last_successful_computation=Max(
                "discovery_score__DSC_COMPUTED_AT",
                filter=computed,
            ),
        )
        missing = list(
            active.filter(discovery_score__isnull=True)
            .order_by("BUSN_ID")
            .values(
                id=F("BUSN_ID"),
                business_name=F("BUSN_NAME"),
            )[:25],
        )
        if counts["active_businesses"]:
            coverage_percent = round(
                counts["computed"] / counts["active_businesses"] * 100,
                1,
            )
        else:
            coverage_percent = 0
        return {
            **counts,
            "snapshot_at": now,
            "max_score_age_hours": (
                DiscoveryScoreRefreshService.MAX_SCORE_AGE.total_seconds() / 3600
            ),
            "authoritative_coverage_percent": coverage_percent,
            "missing_businesses": missing,
            "missing_businesses_truncated": counts["missing"] > len(missing),
        }

    @staticmethod
    def recompute_scores():
        """Run the same batch service used by the scheduled task."""

        result = DiscoveryScoreService.recompute_business_scores()
        return {
            "considered": result.considered_count,
            "updated": result.updated_count,
            "skipped_stale": result.stale_count,
            "failed": result.failed_count,
            "failed_business_ids": [
                failure.business_id
                for failure in result.failures
            ],
        }
