"""Selected-decision-period application turnaround and section-level rejection evidence."""

from django.db.models import Count, Exists, OuterRef, Q

from apps.merchant_application.models import (
    MerchantApplicationFeedback,
    MerchantApplicationReview,
)
from apps.shared.analytics.metadata import build_meta

from .reporting_helpers import summarize_turnaround


class ApplicationProcessingAnalyticsService:
    """Extend onboarding using linked submission/review events rather than application age."""

    @staticmethod
    def review_turnaround(period):
        """Measure linked submissions against their own selected administrator decision time."""
        decisions = MerchantApplicationReview.objects.filter(
            MAREV_DECISION__in=MerchantApplicationReview.Decision.values,
        )
        selected = decisions.filter(
            MAREV_REVIEWED_AT__gte=period.start,
            MAREV_REVIEWED_AT__lt=period.end,
        ).values_list(
            "MASUB_ID__MASUB_SUBMITTED_AT",
            "MAREV_REVIEWED_AT",
            "MAPP_ID",
            "MASUB_ID__MAPP_ID",
        )
        summary = summarize_turnaround(
            (
                (submitted, reviewed, application_id == submission_application_id)
                for submitted, reviewed, application_id, submission_application_id
                in selected.iterator()
            ),
        )
        return {
            **summary,
            "missing_decision_timestamp_count": decisions.filter(
                MAREV_REVIEWED_AT__isnull=True,
            ).count(),
            "missing_decision_timestamp_scope": (
                "All recorded decisions; missing decision times cannot be assigned to a period."
            ),
            "measurement_type": "review_decision_period",
            "definition": (
                "Elapsed hours from the linked submission to its own approved/rejected review. "
                "Each review cycle counts once, selected by reviewed_at. Missing links/times, "
                "cross-application links and negative durations are excluded in that order. "
                "Zero-hour reviews are valid. No classified SLA requirement is imposed."
            ),
        }

    @staticmethod
    def rejection_insights(period):
        """Count distinct rejection decisions and affected applications for each stored section."""
        sections = MerchantApplicationFeedback.Section
        feedback = MerchantApplicationFeedback.objects.filter(
            MAREV_ID=OuterRef("pk"),
        )
        rejected = MerchantApplicationReview.objects.filter(
            MAREV_DECISION=MerchantApplicationReview.Decision.REJECTED,
            MAREV_REVIEWED_AT__gte=period.start,
            MAREV_REVIEWED_AT__lt=period.end,
        )
        totals = rejected.annotate(
            has_section=Exists(feedback.filter(MAPF_SECTION__in=sections.values)),
            has_unrecognized_section=Exists(feedback.exclude(MAPF_SECTION__in=sections.values)),
        ).aggregate(
            rejected_decisions=Count("pk"),
            distinct_applications=Count("MAPP_ID", distinct=True),
            decisions_without_section_feedback=Count("pk", filter=Q(has_section=False)),
            decisions_with_unrecognized_section=Count("pk", filter=Q(has_unrecognized_section=True)),
        )
        grouped = MerchantApplicationFeedback.objects.filter(
            MAREV_ID__in=rejected,
            MAPF_SECTION__in=sections.values,
        ).order_by().values("MAPF_SECTION").annotate(
            rejection_decisions=Count("MAREV_ID", distinct=True),
            distinct_applications=Count("MAREV_ID__MAPP_ID", distinct=True),
        )
        counts = {
            row["MAPF_SECTION"]: row
            for row in grouped
        }
        rows = []
        for section, label in sections.choices:
            row = counts.get(section, {})
            decision_count = row.get("rejection_decisions", 0)
            application_count = row.get("distinct_applications", 0)
            if totals["rejected_decisions"]:
                decision_share = round(decision_count / totals["rejected_decisions"] * 100, 2)
                application_share = round(application_count / totals["distinct_applications"] * 100, 2)
            else:
                decision_share = None
                application_share = None
            rows.append({
                "section": section,
                "label": label,
                "rejection_decisions": decision_count,
                "distinct_applications": application_count,
                "decision_share_percentage": decision_share,
                "application_share_percentage": application_share,
            })
        return {
            **totals,
            "sections": rows,
            "definition": (
                "Rejection review decisions dated within the selected period. A decision "
                "counts once per section despite repeated feedback rows; applications "
                "count once per section despite repeated rejections. Shares use all selected "
                "rejected decisions/applications respectively, including decisions without "
                "section feedback. Section shares can sum above 100% because sections overlap. "
                "No free-text reason taxonomy is inferred."
            ),
        }

    @classmethod
    def get_report(
        cls,
        period,
    ):
        """Return additive selected-period processing metrics independently of legacy UTC KPIs."""
        return {
            "review_turnaround": cls.review_turnaround(period),
            "rejection_insights": cls.rejection_insights(period),
            "processing_meta": build_meta(
                period,
                coverage_verified=True,
                data_through=period.end,
                partial_reasons=("recorded_application_history_only",),
            ),
        }
