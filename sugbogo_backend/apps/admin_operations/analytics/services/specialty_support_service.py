"""Current platform specialty evidence using the maintained vouch validity rules."""

from django.db.models import Count, Exists, OuterRef

from apps.business.models import BusinessSpecialtyTag, BusinessVouch
from apps.shared.analytics.metadata import build_meta


class SpecialtySupportService:
    """Keep endorsement records, distinct people and supported businesses separate."""

    TOP_LIMIT = 10

    @staticmethod
    def valid_evidence(as_of):
        """Match VouchService retained evidence on current active business/tag assignments."""
        active_assignment = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=OuterRef("BUSN_ID"),
            TAG_ID=OuterRef("TAG_ID"),
            BST_IS_ACTIVE=True,
            BST_CREATED_AT__lte=as_of,
        )
        return BusinessVouch.objects.filter(
            VOUCH_WITHDRAWN_AT__isnull=True,
            VOUCH_EVIDENCE_IS_VALID=True,
            VOUCH_CREATED_AT__lte=as_of,
        ).filter(
            Exists(active_assignment),
        )

    @classmethod
    def get_report(
        cls,
        period,
    ):
        """Aggregate current support globally and by tag without summing grouped people counts."""
        evidence = cls.valid_evidence(period.generated_at)
        summary = evidence.aggregate(
            valid_vouches=Count("pk"),
            distinct_supporters=Count("USER_ID", distinct=True),
            supported_businesses=Count("BUSN_ID", distinct=True),
            supported_specialties=Count("TAG_ID", distinct=True),
        )
        grouped = evidence.order_by().values(
            "TAG_ID",
            "TAG_ID__TAG_NAME",
        ).annotate(
            valid_vouches=Count("pk"),
            distinct_supporters=Count("USER_ID", distinct=True),
            supported_businesses=Count("BUSN_ID", distinct=True),
        ).order_by(
            "-valid_vouches",
            "-distinct_supporters",
            "TAG_ID",
        )
        specialties = [
            {
                "specialty_id": row["TAG_ID"],
                "name": row["TAG_ID__TAG_NAME"],
                "valid_vouches": row["valid_vouches"],
                "distinct_supporters": row["distinct_supporters"],
                "supported_businesses": row["supported_businesses"],
            }
            for row in grouped
        ]
        return {
            "measurement_type": "current_snapshot",
            "selected_period_applies": False,
            "as_of": period.generated_at.isoformat(),
            "summary": summary,
            "specialties": specialties,
            "top_supported_specialties": specialties[:cls.TOP_LIMIT],
            "top_limit": cls.TOP_LIMIT,
            "definition": (
                "Non-withdrawn, valid evidence on current active business-specialty assignments "
                "created by as_of, matching VouchService. All retained business/account statuses "
                "are included; suspicion alone does not invalidate evidence. Multiple tags "
                "produce separate endorsements, but global supporters/businesses are distinct "
                "across all tags. Only specialties receiving valid support are listed. "
                "Selected dates do not filter this current snapshot; no historical comparison."
            ),
            "meta": build_meta(
                period,
                coverage_verified=True,
                data_through=period.end,
                partial_reasons=(
                    "current_specialty_and_evidence_state",
                    "selected_period_not_applied_to_snapshot",
                ),
            ),
        }
