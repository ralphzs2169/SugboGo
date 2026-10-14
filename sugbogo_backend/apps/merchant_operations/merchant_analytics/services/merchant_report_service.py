"""Compose merchant aggregates and conservative deterministic findings without provider calls."""

from apps.shared.analytics.metadata import build_meta
from apps.shared.analytics.policy import current_policy, with_policy_snapshot

from .peer_analytics_service import PeerAnalyticsService
from .premium_review_insights_service import PremiumReviewInsightsService
from .premium_review_performance_service import PremiumReviewPerformanceService
from .premium_specialty_service import PremiumSpecialtyService
from .premium_visibility_service import PremiumVisibilityService
from .standard_analytics_service import StandardAnalyticsService


class MerchantReportService:
    """Build one Premium-gated JSON report using a single resolved period and cutoff."""

    @staticmethod
    def findings(standard, premium, peers):
        """Emit stable rules from owned evidence without interpreting incomplete visibility as performance."""
        findings = []
        actions = []

        def add(code, message, action=None):
            """Attach an optional recommendation to a deterministic finding code."""
            findings.append({"code": code, "message": message})
            if action:
                actions.append({"code": code, "message": action})

        unanswered = standard["reviews"]["current_unanswered_published"]
        if unanswered:
            add("UNANSWERED_REVIEWS", f"{unanswered} current published reviews have no qualifying retained reply.",
                "Review the unanswered published-review backlog and respond where appropriate.")
        current = premium["review_performance"]["current"]
        if not current["has_sufficient_sentiment_data"]:
            add("INSUFFICIENT_SENTIMENT", "The selected period has too few classified reviews for a sentiment conclusion.",
                "Wait for sufficient classified review data before drawing sentiment conclusions.")
        summary = premium["review_insights"]["stored_summary"]
        if summary is None:
            add("STORED_INSIGHTS_MISSING", "No stored review summary is available.")
        elif summary["state"] == "outdated":
            add("STORED_INSIGHTS_OUTDATED", "Stored review insights are outdated; their original coverage and freshness still apply.",
                "Check the stored insights state and generation date before using the narrative or mentions.")
        elif not summary["content_available"]:
            add("STORED_CONTENT_UNAVAILABLE", "Stored narrative and mentions are not currently available.")
        sections = [standard["sources"]["visibility"], premium["visibility"]["meta"], premium["pocket"]["meta"]]
        if "visibility" in peers["sources"]:
            sections.append(peers["sources"]["visibility"])
        if any(section["availability"] == "unavailable" or
               any("unavailable" in reason for reason in section["partial_reasons"]) for section in sections):
            add("VISIBILITY_UNAVAILABLE", "Some visibility results are unavailable and must not be treated as zero.")
        add("VISIBILITY_COVERAGE_UNVERIFIED", "Recorded visibility does not establish complete tracking or reliable growth.")
        if peers["status"] == "insufficient_data":
            add("INSUFFICIENT_PEERS", "The selected peer group is too small to disclose comparisons.")
        elif peers["metrics"]["positive_review_share"]["status"] == "insufficient_data":
            add("INSUFFICIENT_SENTIMENT_PEERS", "Positive-share peer comparison lacks sufficient merchant or peer review samples.")
        return findings, actions

    @classmethod
    @with_policy_snapshot
    def get_report(cls, user, period, *, interval="daily"):
        """Compose services directly while preserving each section's measurement and availability metadata."""
        standard = StandardAnalyticsService.get_report(user, period)
        premium = {
            "visibility": PremiumVisibilityService.get_report(user, period, interval=interval),
            "pocket": PremiumVisibilityService.get_report(user, period, interval="weekly", pocket=True),
            "specialties": PremiumSpecialtyService.get_report(user, period),
            "review_insights": PremiumReviewInsightsService.get_report(user, period),
            "review_performance": PremiumReviewPerformanceService.get_report(user, period),
        }
        peers = PeerAnalyticsService.get_report(user, period)
        findings, actions = cls.findings(standard, premium, peers)
        reasons = ["composed_current_state_report", "stored_summary_uses_own_coverage"]
        for name, section in {"standard": standard, **premium, "peers": peers}.items():
            if section["meta"]["is_partial"]:
                reasons.append(f"{name}_partial")
        return {
            "business": standard["business"], "report_version": "1", "policy_version": current_policy().version,
            "snapshot_as_of": period.generated_at.isoformat(),
            "results": {"standard": standard, "premium": premium},
            "changes": {
                "visibility": {name: metric["change"] for name, metric in premium["visibility"]["metrics"].items()},
                "pocket": {name: metric["change"] for name, metric in premium["pocket"]["metrics"].items()},
                "reply_rate": premium["review_performance"]["reply_rate_change"],
            },
            "peers": peers, "key_findings": findings, "recommended_actions": actions,
            "meta": build_meta(period, availability="partial", partial_reasons=reasons),
            "measurement_note": (
                "One reporting clock is used across sections; reads are not a cross-database transactional snapshot. "
                "Stored summaries retain their own coverage. Peer medians describe current eligible inventory and recorded activity, "
                "not business quality, causes, or normalized lifetime exposure."
            ),
        }
