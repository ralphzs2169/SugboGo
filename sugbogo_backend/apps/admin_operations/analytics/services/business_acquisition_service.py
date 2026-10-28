"""Business creation and first approvals grouped by current classification."""

from django.db.models import Count

from apps.business.models import Business
from apps.shared.analytics.metadata import build_meta

from .platform_growth_service import PlatformGrowthService


class BusinessAcquisitionService:
    """Reuse growth event populations in four population-independent grouped queries."""

    @staticmethod
    def grouped_counts(
        queryset,
        identifier,
        name,
    ):
        """Retain missing or unusable classification as an explicit unclassified group."""
        rows = queryset.order_by().values(identifier, name).annotate(count=Count("pk"))
        counts = {}
        for row in rows:
            group_id = row[identifier]
            label = row[name]
            if group_id is None or not label or not label.strip():
                group_id = None
                label = "Unclassified"
            key = (group_id, label)
            counts[key] = counts.get(key, 0) + row["count"]
        return counts

    @classmethod
    def get_report(
        cls,
        period,
    ):
        """Keep creation and approval events independent and reconcile each grouping."""
        created = Business.objects.filter(
            BUSN_CREATED_AT__gte=period.start,
            BUSN_CREATED_AT__lt=period.end,
            BUSN_CREATED_AT__lte=period.generated_at,
        )
        approved = PlatformGrowthService.first_business_approvals().filter(
            MAREV_REVIEWED_AT__gte=period.start,
            MAREV_REVIEWED_AT__lt=period.end,
        )
        report = {}
        for group, path, name in (
            ("categories", "CTGRY_ID", "CTGRY_NAME"),
            ("clusters", "CTGRY_ID__CLUS_ID", "CLUS_NAME"),
        ):
            creations = cls.grouped_counts(
                created,
                path,
                f"{path}__{name}",
            )
            approvals = cls.grouped_counts(
                approved,
                f"MAPP_ID__BUSN_ID__{path}",
                f"MAPP_ID__BUSN_ID__{path}__{name}",
            )
            rows = [
                {
                    "id": key[0],
                    "name": key[1],
                    "created": creations.get(key, 0),
                    "approved": approvals.get(key, 0),
                }
                for key in creations.keys() | approvals.keys()
            ]
            rows.sort(key=lambda row: (
                -(row["created"] + row["approved"]),
                -row["created"],
                row["name"].casefold(),
                row["id"] or 0,
            ))
            report[group] = rows
        return {
            **report,
            "totals": {
                "created": sum(row["created"] for row in report["categories"]),
                "approved": sum(row["approved"] for row in report["categories"]),
            },
            "definitions": {
                "created": "Same retained business creation population as Platform Growth, regardless of current status.",
                "approved": "Same earliest recorded approval per application currently linked to a business as Platform Growth. Current application or business status does not filter approval events.",
                "classification": "Current category and cluster, not historical classifications. Missing IDs or unusable names are retained as Unclassified; no classification exclusions.",
                "period": "Creation and decision times are selected independently using start-inclusive/end-exclusive Manila reporting bounds. These are separate events, not a period-matched conversion funnel.",
                "ordering": "Descending combined event counts, then created count, name and identifier. Each business counts once per event in each grouping.",
            },
            "meta": build_meta(
                period,
                coverage_verified=True,
                data_through=period.end,
                partial_reasons=(
                    "current_classification_attribution",
                    "recorded_approval_history_only",
                    "retained_businesses_only",
                ),
            ),
        }
