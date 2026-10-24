"""Anonymous medians for current active same-category or same-cluster businesses."""

from statistics import median

from django.db.models import Count, Exists, OuterRef, Q

from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.merchant_operations.business_profile.services.business_profile_service import BusinessProfileService
from apps.shared.analytics.policy import current_policy, with_policy_snapshot
from apps.reviews.models import Review
from apps.shared.analytics.metadata import build_meta

from .. import constants
from .premium_common import owned_business_data, snapshot_meta


class PeerAnalyticsService:
    """Compute peer medians without returning peer identities or individual values."""

    METRICS = {
        "profile_visits": ("Recorded profile visits", "events"),
        "saves": ("Recorded Pocket SAVE events", "events"),
        "specialty_support": ("Vouches added and still valid", "endorsements"),
        "positive_review_share": ("Positive share of classified published reviews", "percent"),
    }

    @staticmethod
    def select_group(business, period):
        """Prefer five other same-category businesses, otherwise use the same cluster."""
        eligible = Business.objects.filter(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            CTGRY_ID__CLUS_ID=business.CTGRY_ID.CLUS_ID_id,
            BUSN_CREATED_AT__lte=period.generated_at,
        ).exclude(pk=business.pk).order_by("BUSN_ID")
        category_ids = list(eligible.filter(CTGRY_ID_id=business.CTGRY_ID_id).values_list("pk", flat=True))
        if len(category_ids) >= current_policy()["peer_min_businesses"]:
            return category_ids, "category", None
        return list(eligible.values_list("pk", flat=True)), "cluster", "category_group_too_small"

    @classmethod
    def unavailable_metric(cls, name, reason, *, sample_size=None, status="insufficient_data"):
        """Suppress both sides and position when evidence cannot support a comparison."""
        label, unit = cls.METRICS[name]
        return {
            "label": label, "unit": unit, "status": status, "reason": reason,
            "merchant_value": None, "peer_median": None, "position": None,
            "eligible_peer_sample_size": sample_size, "merchant_classified_review_count": None,
        }

    @classmethod
    def comparison(cls, name, own_value, peer_values, *, classified_count=None, recorded=False):
        """Classify ties using the same rounded values returned for display."""
        label, unit = cls.METRICS[name]
        own = round(float(own_value), constants.PEER_DISPLAY_DECIMAL_PLACES)
        peer = round(float(median(peer_values)), constants.PEER_DISPLAY_DECIMAL_PLACES)
        return {
            "label": label, "unit": unit,
            "status": "partial" if recorded else "available",
            "reason": "coverage_unverified" if recorded else None,
            "merchant_value": own, "peer_median": peer,
            "position": "at_median" if own == peer else "above_median" if own > peer else "below_median",
            "eligible_peer_sample_size": len(peer_values),
            "merchant_classified_review_count": classified_count,
        }

    @staticmethod
    def specialty_counts(business_ids, period):
        """Count period endorsements surviving on current active specialty links."""
        active_link = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"), TAG_ID=OuterRef("TAG_ID"),
            BST_IS_ACTIVE=True, BST_CREATED_AT__lte=period.generated_at,
        )
        # Approved period definition differs from Standard's all-time current support.
        rows = BusinessVouch.objects.filter(
            VOUCH_WITHDRAWN_AT__isnull=True,
            BUSN_ID__in=business_ids, VOUCH_EVIDENCE_IS_VALID=True,
            VOUCH_CREATED_AT__gte=period.start, VOUCH_CREATED_AT__lt=period.end,
        ).filter(Exists(active_link)).values("BUSN_ID").annotate(value=Count("pk"))
        result = dict.fromkeys(business_ids, 0)
        result.update({row["BUSN_ID"]: row["value"] for row in rows})
        return result

    @staticmethod
    def sentiment_counts(business_ids, period):
        """Read stored labels on the same current published creation cohorts as Premium trends."""
        # Preserve the documented legacy published/date scope; no classification refresh.
        rows = Review.objects.filter(
            BUSN_ID__in=business_ids, REVW_STATUS=Review.ReviewStatus.PUBLISHED,
            REVW_CREATED_AT__gte=period.start, REVW_CREATED_AT__lt=period.end,
        ).values("BUSN_ID").annotate(
            positive=Count("pk", filter=Q(REVW_SENTIMENT_LABEL="positive")),
            classified=Count("pk", filter=Q(REVW_SENTIMENT_LABEL__in=("positive", "neutral", "negative"))),
        )
        return {row["BUSN_ID"]: row for row in rows}

    @classmethod
    @with_policy_snapshot
    def get_report(cls, user, period):
        """Derive ownership and return only group metadata and disclosure-safe comparisons."""
        business = BusinessProfileService.get_business_for_merchant(user)
        policy = current_policy()
        peer_ids, scope, fallback = cls.select_group(business, period)
        group = {
            "scope": scope, "size": len(peer_ids), "minimum_size": policy["peer_min_businesses"],
            "policy_version": policy.version,
            "positive_share_min_classified_reviews": policy["peer_positive_share_min_reviews"],
            "fallback_reason": fallback,
            "eligibility": "Current active businesses in the same cluster; merchant excluded.",
        }
        reasons = ["current_state_reporting", "peer_lifetimes_not_normalized"]
        if len(peer_ids) < policy["peer_min_businesses"]:
            return {
                "business": owned_business_data(business), "status": "insufficient_data",
                "reason": "peer_group_too_small", "group": group,
                "metrics": {name: cls.unavailable_metric(name, "peer_group_too_small") for name in cls.METRICS},
                "meta": snapshot_meta(period, "peer_group_too_small", "peer_lifetimes_not_normalized"),
                "sources": {},
            }

        ids = [business.pk, *peer_ids]
        metrics = {}
        try:
            visibility = VisibilityEventService.get_business_attention_metrics(
                business_ids=ids, start_time=period.start, end_time=period.end,
            )
        except VisibilityTrackingUnavailable:
            for name in ("profile_visits", "saves"):
                metrics[name] = cls.unavailable_metric(name, "visibility_unavailable", status="unavailable")
            visibility_meta = build_meta(period, availability="unavailable")
            reasons.append("visibility_unavailable")
        else:
            for name in ("profile_visits", "saves"):
                metrics[name] = cls.comparison(name, visibility[business.pk][name],
                                              [visibility[pk][name] for pk in peer_ids], recorded=True)
            visibility_meta = build_meta(period)

        support = cls.specialty_counts(ids, period)
        metrics["specialty_support"] = cls.comparison("specialty_support", support[business.pk],
                                                    [support[pk] for pk in peer_ids])
        sentiments = cls.sentiment_counts(ids, period)
        own = sentiments.get(business.pk, {"classified": 0, "positive": 0})
        valid_peers = [sentiments[pk] for pk in peer_ids if pk in sentiments
                       and sentiments[pk]["classified"] >= policy["peer_positive_share_min_reviews"]]
        if own["classified"] < policy["peer_positive_share_min_reviews"]:
            metrics["positive_review_share"] = cls.unavailable_metric(
                "positive_review_share", "merchant_sentiment_sample_too_small", sample_size=len(valid_peers),
            )
        elif len(valid_peers) < policy["peer_min_businesses"]:
            metrics["positive_review_share"] = cls.unavailable_metric(
                "positive_review_share", "peer_sentiment_sample_too_small", sample_size=len(valid_peers),
            )
        else:
            metrics["positive_review_share"] = cls.comparison(
                "positive_review_share", own["positive"] / own["classified"] * 100,
                [row["positive"] / row["classified"] * 100 for row in valid_peers], classified_count=own["classified"],
            )
        if metrics["positive_review_share"]["status"] == "insufficient_data":
            reasons.append(metrics["positive_review_share"]["reason"])
        reasons.extend(("visibility_coverage_unverified", "retained_valid_vouches_only", "review_status_history_unavailable"))
        return {
            "business": owned_business_data(business), "status": "partial", "reason": "see_metric_statuses",
            "group": group, "metrics": metrics,
            "meta": build_meta(period, availability="partial", partial_reasons=reasons),
            "sources": {"visibility": visibility_meta,
                        "domain": snapshot_meta(period, "retained_valid_vouches_only", "review_status_history_unavailable")},
        }
