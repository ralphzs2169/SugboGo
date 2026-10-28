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
        *,
        classification_rows=None,
    ):
        """Retain missing or unusable classification as an explicit unclassified group."""
        fields = [identifier, name]
        if classification_rows is not None:
            fields.extend(
                [
                    f"{identifier}__CLUS_ID",
                    f"{identifier}__CLUS_ID__CLUS_NAME",
                    f"{identifier}__CLUS_ID__CLUS_ICON",
                ],
            )
        rows = (
            queryset.order_by()
            .values(*fields)
            .annotate(count=Count("pk"))
        )
        counts = {}
        for row in rows:
            # Preserve parent identity before flat Unclassified groups are merged.
            if classification_rows is not None:
                classification_rows.append(
                    {
                        "category_id": row[identifier],
                        "category_name": row[name],
                        "cluster_id": row[f"{identifier}__CLUS_ID"],
                        "cluster_name": row[f"{identifier}__CLUS_ID__CLUS_NAME"],
                        "cluster_icon": row[f"{identifier}__CLUS_ID__CLUS_ICON"],
                        "count": row["count"],
                    },
                )
            group_id = row[identifier]
            label = row[name]
            if group_id is None or not label or not label.strip():
                group_id = None
                label = "Unclassified"
            key = (group_id, label)
            counts[key] = counts.get(key, 0) + row["count"]
        return counts

    @staticmethod
    def classification_hierarchy(
        created_rows,
        approved_rows,
    ):
        """Reconcile category creation counts under their current parent clusters."""
        clusters = {}
        for rows, count_creations in (
            (created_rows, True),
            (approved_rows, False),
        ):
            for row in rows:
                cluster_id = row["cluster_id"]
                cluster_name = row["cluster_name"]
                cluster_icon = row["cluster_icon"]
                if (
                    cluster_id is None
                    or not cluster_name
                    or not cluster_name.strip()
                ):
                    cluster_id = None
                    cluster_name = "Unclassified"
                    cluster_icon = None

                category_id = row["category_id"]
                category_name = row["category_name"]
                if (
                    category_id is None
                    or not category_name
                    or not category_name.strip()
                ):
                    category_id = None
                    category_name = "Unclassified"

                cluster = clusters.setdefault(
                    cluster_id,
                    {
                        "id": cluster_id,
                        "name": cluster_name,
                        "icon": cluster_icon,
                        "categories": {},
                    },
                )
                category = cluster["categories"].setdefault(
                    category_id,
                    {
                        "id": category_id,
                        "name": category_name,
                        "created": 0,
                    },
                )
                # Approval-only classifications remain visible with zero creations.
                if count_creations:
                    category["created"] += row["count"]

        hierarchy = []
        for cluster in clusters.values():
            cluster["categories"] = sorted(
                cluster["categories"].values(),
                key=lambda row: (
                    row["id"] is None,
                    -row["created"],
                    row["name"].casefold(),
                    row["id"] or 0,
                ),
            )
            cluster["created"] = sum(
                category["created"]
                for category in cluster["categories"]
            )
            hierarchy.append(cluster)
        hierarchy.sort(
            key=lambda row: (
                row["id"] is None,
                -row["created"],
                row["name"].casefold(),
                row["id"] or 0,
            ),
        )
        return hierarchy

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
        created_classifications = []
        approved_classifications = []
        for group, path, name in (
            ("categories", "CTGRY_ID", "CTGRY_NAME"),
            ("clusters", "CTGRY_ID__CLUS_ID", "CLUS_NAME"),
        ):
            if group == "categories":
                created_rows = created_classifications
                approved_rows = approved_classifications
            else:
                created_rows = None
                approved_rows = None
            creations = cls.grouped_counts(
                created,
                path,
                f"{path}__{name}",
                classification_rows=created_rows,
            )
            approvals = cls.grouped_counts(
                approved,
                f"MAPP_ID__BUSN_ID__{path}",
                f"MAPP_ID__BUSN_ID__{path}__{name}",
                classification_rows=approved_rows,
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
            "hierarchy": cls.classification_hierarchy(
                created_classifications,
                approved_classifications,
            ),
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
                "hierarchy": (
                    "Current clusters and their categories, ordered by creation count, "
                    "name and identifier, with Unclassified last. Cluster counts are "
                    "category subtotals, not additional businesses. Approval-only "
                    "classifications remain visible with zero creations."
                ),
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
