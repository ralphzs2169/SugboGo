"""Build aggregate-only provider evidence and server-owned explanation choices."""

import hashlib
import json
from datetime import datetime

from apps.shared.analytics.date_ranges import AnalyticsPeriod
from apps.shared.analytics.policy import current_policy, with_policy_snapshot

from .merchant_report_service import MerchantReportService


SCHEMA_VERSION = "merchant-recommendations-1"
PROMPT_VERSION = "restricted-actions-1"
RELEVANT_RULES = (
    "sentiment_min_classified_reviews", "narrative_min_eligible_reviews",
    "mention_min_supporting_reviews", "peer_min_businesses",
    "peer_positive_share_min_reviews",
)

# Provider output selects vetted wording; arbitrary generated prose is never published.
ACTION_OPTIONS = {
    "UNANSWERED_REVIEWS": {
        "review_backlog": "Review the unanswered published-review backlog and respond where appropriate.",
        "consider_reply": "Consider a helpful reply to unanswered published feedback where appropriate.",
    },
    "INSUFFICIENT_SENTIMENT": {
        "wait_for_evidence": "Wait for sufficient classified review data before drawing sentiment conclusions.",
        "avoid_conclusion": "Review individual feedback cautiously while the classified sample remains insufficient.",
    },
    "STORED_INSIGHTS_OUTDATED": {
        "check_freshness": "Check the stored insights state, original coverage, and generation date before using them.",
        "use_current_evidence": "Use current review evidence cautiously while stored insights await refresh.",
    },
}


def digest(value):
    """Hash canonical JSON without exposing the underlying source in identifiers."""
    serialized = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def selection_key(period):
    """Match the requested Manila calendar selection independently of its elapsed cutoff."""
    return digest([period.start_date.isoformat(), period.end_date.isoformat()])


def period_data(period):
    """Record exact resolved boundaries and the original reporting clock."""
    return {
        "timezone": "Asia/Manila", "start_date": period.start_date.isoformat(),
        "end_date": period.end_date.isoformat(), "start": period.start.isoformat(),
        "end_exclusive": period.end.isoformat(), "previous_start": period.previous_start.isoformat(),
        "previous_end_exclusive": period.previous_end.isoformat(),
        "snapshot_as_of": period.generated_at.isoformat(),
        "includes_partial_day": period.includes_partial_day,
    }


def restore_period(data, *, checked_at=None):
    """Restore stored selection bounds while optionally checking current retained SQL state."""
    return AnalyticsPeriod(
        start_date=datetime.fromisoformat(data["start_date"]).date(),
        end_date=datetime.fromisoformat(data["end_date"]).date(),
        start=datetime.fromisoformat(data["start"]), end=datetime.fromisoformat(data["end_exclusive"]),
        previous_start=datetime.fromisoformat(data["previous_start"]),
        previous_end=datetime.fromisoformat(data["previous_end_exclusive"]),
        generated_at=checked_at or datetime.fromisoformat(data["snapshot_as_of"]),
        includes_partial_day=data["includes_partial_day"],
    )


class RecommendationEvidenceService:
    """Reuse report findings while excluding narrative, review text, and identities from AI."""

    @staticmethod
    @with_policy_snapshot
    def build(user, period):
        """Capture allowlisted facts and supported actions with one policy and reporting clock."""
        report = MerchantReportService.get_report(user, period)
        standard = report["results"]["standard"]
        premium = report["results"]["premium"]
        summary = premium["review_insights"]["stored_summary"]
        performance = premium["review_performance"]["current"]
        candidates = [action["code"] for action in report["recommended_actions"] if action["code"] in ACTION_OPTIONS]
        facts = {
            "current_unanswered_published": standard["reviews"]["current_unanswered_published"],
            "period_published_reviews": performance["published_review_count"],
            "period_classified_reviews": performance["classified_review_count"],
            "has_sufficient_sentiment_data": performance["has_sufficient_sentiment_data"],
            "stored_insights_state": None if summary is None else summary["state"],
            "stored_content_available": False if summary is None else summary["content_available"],
            "stored_coverage_start": None if summary is None else summary["coverage_start"],
            "stored_coverage_end": None if summary is None else summary["coverage_end"],
            "stored_generated_at": None if summary is None else summary["generated_at"],
            "visibility_availability": standard["sources"]["visibility"]["availability"],
            "visibility_coverage_verified": False,
        }
        policy = current_policy()
        rules = {name: policy[name] for name in RELEVANT_RULES}
        snapshot = {
            "schema_version": SCHEMA_VERSION,
            "source_period": {
                "timezone": "Asia/Manila", "start": period.start.isoformat(),
                "end_exclusive": period.end.isoformat(),
            },
            "facts": facts,
            "finding_codes": [finding["code"] for finding in report["key_findings"]],
            "candidates": [
                {"action_code": code, "evidence_codes": [code], "explanations": ACTION_OPTIONS[code]}
                for code in candidates
            ],
        }
        return {
            "snapshot": snapshot, "fingerprint": digest([snapshot, rules]),
            "policy_version": policy.version, "policy_values": rules,
            "business": report["business"], "key_findings": report["key_findings"],
            "recommended_actions": report["recommended_actions"], "meta": report["meta"],
        }

    @staticmethod
    def equivalent(stored, current):
        """Require unchanged facts, disclosure gates, finding codes, and relevant policy rules."""
        return (
            stored.MREC_FINGERPRINT == current["fingerprint"]
            and stored.MREC_POLICY_VALUES == current["policy_values"]
        )
