"""Current specialty evidence alongside recorded business attention."""

from datetime import timedelta

from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.admin_operations.analytics import constants
from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch, Category, Cluster
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.date_ranges import MANILA, resolve_period
from apps.shared.analytics.metadata import build_meta


from apps.shared.analytics.policy import current_policy, with_policy_snapshot


class BusinessAttentionService:
    """Build correctly sorted attention rows before applying API pagination."""

    ORDER_FIELDS = (
        "business_name", "profile_visits", "saves", "distinct_savers",
        "valid_vouches", "distinct_supporters",
    )
    VISIBILITY_FIELDS = {"profile_visits", "saves", "distinct_savers"}

    @staticmethod
    def eligible_businesses(*, cluster=None, category=None):
        """Resolve active current inventory with validated classification filters."""
        if cluster is not None and not Cluster.objects.filter(CLUS_ID=cluster).exists():
            raise ValidationError({"cluster": "The cluster does not exist."})
        if category is not None:
            category_row = Category.objects.filter(CTGRY_ID=category).values("CLUS_ID").first()
            if category_row is None:
                raise ValidationError({"category": "The category does not exist."})
            if cluster is not None and category_row["CLUS_ID"] != cluster:
                raise ValidationError({"category": "The category does not belong to this cluster."})
        queryset = Business.objects.filter(BUSN_STATUS=Business.BusinessStatus.ACTIVE)
        if cluster is not None:
            queryset = queryset.filter(CTGRY_ID__CLUS_ID=cluster)
        if category is not None:
            queryset = queryset.filter(CTGRY_ID=category)
        return queryset.select_related("CTGRY_ID", "CTGRY_ID__CLUS_ID").order_by("BUSN_ID")

    @staticmethod
    def read_visibility(period, business_ids):
        """Read scoped observations without interpreting source failure as zero attention."""
        try:
            metrics = VisibilityEventService.get_business_attention_metrics(
                business_ids=business_ids, start_time=period.start, end_time=period.end,
            )
        except VisibilityTrackingUnavailable:
            return None, build_meta(period, availability="unavailable")
        return metrics, build_meta(period)

    @staticmethod
    def specialty_support(business_ids):
        """Count valid endorsements and distinct supporters for currently active specialties."""
        active_link = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"), TAG_ID=OuterRef("TAG_ID"), BST_IS_ACTIVE=True,
        )
        # Match maintained evidence validity; suspicion alone is not invalidation.
        rows = (
            BusinessVouch.objects.filter(BUSN_ID__in=business_ids, VOUCH_EVIDENCE_IS_VALID=True)
            .filter(Exists(active_link)).values("BUSN_ID")
            .annotate(valid_vouches=Count("VOUCH_ID"), distinct_supporters=Count("USER_ID", distinct=True))
        )
        return {row["BUSN_ID"]: {key: row[key] for key in ("valid_vouches", "distinct_supporters")} for row in rows}

    @staticmethod
    def fixed_low_exposure_period(now=None):
        """Resolve the approved recent completed-day window without request date overrides."""
        captured = now if now is not None else timezone.now()
        today = captured.astimezone(MANILA).date()
        return resolve_period(
            preset="custom", start_date=today - timedelta(days=constants.LOW_EXPOSURE_WINDOW_DAYS),
            end_date=today - timedelta(days=1), now=captured,
        )

    @staticmethod
    def thresholds():
        """Expose the admin-owned pilot policy used by the current request."""
        return {
            "window_days": constants.LOW_EXPOSURE_WINDOW_DAYS,
            "max_profile_visits": current_policy()["low_exposure_max_profile_visits"],
            "min_distinct_supporters": current_policy()["low_exposure_min_distinct_supporters"],
            "policy_version": current_policy().version,
            "excludes_today": True,
            "is_pilot_policy": True,
        }

    @classmethod
    @with_policy_snapshot
    def get_report(
        cls, period, *, cluster=None, category=None, ordering="-profile_visits", low_exposure=False,
    ):
        """Assemble current SQL support and period visibility, then sort the whole population."""
        field = ordering.removeprefix("-")
        if field not in cls.ORDER_FIELDS:
            raise ValidationError({"ordering": "Unsupported attention ordering."})
        if low_exposure:
            # A passed selectable period cannot change the admin's fixed-window policy.
            period = cls.fixed_low_exposure_period(period.generated_at)
        businesses = list(cls.eligible_businesses(cluster=cluster, category=category))
        ids = [business.BUSN_ID for business in businesses]
        visibility, visibility_meta = cls.read_visibility(period, ids)
        support = cls.specialty_support(ids)
        domain_meta = build_meta(
            period, coverage_verified=True, data_through=period.end,
            partial_reasons=("current_state_reporting",),
        )
        reasons = ["current_state_reporting", "visibility_coverage_unverified"]
        if visibility is None:
            reasons.append("visibility_unavailable")
        needs_visibility = low_exposure or field in cls.VISIBILITY_FIELDS
        unavailable = visibility is None and needs_visibility
        meta = build_meta(
            period, availability="unavailable" if unavailable else "partial",
            partial_reasons=reasons,
        )
        result = {
            "label": "Low recorded attention with specialty support" if low_exposure else "Business attention",
            "description": (
                "Preliminary candidates from recorded visits and current valid specialty supporters; not a quality ranking."
                if low_exposure else "Period visits and saves alongside current specialty support."
            ),
            "items": None, "ordering": ordering,
            "meta": meta, "sources": {"domain": domain_meta, "visibility": visibility_meta},
            "selection_status": "unavailable" if unavailable else "provisional" if low_exposure else "not_applicable",
            "thresholds": cls.thresholds() if low_exposure else None,
        }
        if unavailable:
            return result
        items = []
        for business in businesses:
            metrics = visibility[business.BUSN_ID] if visibility is not None else {
                "profile_visits": None, "saves": None, "distinct_savers": None,
            }
            evidence = support.get(business.BUSN_ID, {"valid_vouches": 0, "distinct_supporters": 0})
            created = business.BUSN_CREATED_AT
            if low_exposure:
                if created >= period.end:
                    continue  # No opportunity to be observed in the completed-day window.
                if (
                    metrics["profile_visits"] > current_policy()["low_exposure_max_profile_visits"]
                    or evidence["distinct_supporters"] < current_policy()["low_exposure_min_distinct_supporters"]
                ):
                    continue
            items.append({
                "business_id": business.BUSN_ID, "business_name": business.BUSN_NAME,
                "category_id": business.CTGRY_ID_id, "category_name": business.CTGRY_ID.CTGRY_NAME,
                "cluster_id": business.CTGRY_ID.CLUS_ID_id, "cluster_name": business.CTGRY_ID.CLUS_ID.CLUS_NAME,
                **metrics, **evidence,
                "specialty_support_as_of": period.generated_at.isoformat(),
                "business_created_at": created.isoformat(),
                "has_full_business_window": created <= period.start,
                "business_window_days": round(max(
                    0, (period.end - max(created, period.start)).total_seconds() / 86400,
                ), 2),
            })
        # Stable ID ties survive both ascending and descending requested ordering.
        items.sort(key=lambda item: item["business_id"])
        items.sort(
            key=lambda item: item[field].casefold() if field == "business_name" else item[field],
            reverse=ordering.startswith("-"),
        )
        result["items"] = items
        return result
