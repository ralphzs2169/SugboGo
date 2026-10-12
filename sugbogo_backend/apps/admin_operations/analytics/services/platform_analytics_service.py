"""Current platform inventory and selected-period discovery/account activity."""

from datetime import UTC, timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncWeek

from apps.admin_operations.analytics.services.discovery_analytics_service import (
    DiscoveryAnalyticsService,
)
from apps.business.models import Business
from apps.merchant_application.models import MerchantApplication
from apps.shared.analytics.comparisons import compare_values
from apps.shared.analytics.date_ranges import MANILA
from apps.shared.analytics.metadata import build_meta
from apps.users.models import User


class PlatformAnalyticsService:
    """Aggregate inventory snapshots separately from period-based activity measures."""

    @staticmethod
    def _snapshot(value, label, description, period):
        """Describe current inventory without inventing an earlier status snapshot."""
        return {
            "label": label,
            "description": description,
            "measurement_type": "current_snapshot",
            "as_of": period.generated_at.isoformat(),
            "value": value,
            "previous_value": None,
            "change": {
                "value": None, "direction": None, "unit": "percent",
                "reason": "historical_snapshot_unavailable",
            },
            "source": "domain",
        }

    @staticmethod
    def _registrations(period):
        """Count currently explorer-role accounts created in current and prior windows."""
        explorers = User.objects.filter(
            USER_ROLE=User.UserRole.EXPLORER,
            USER_CREATED_AT__gte=period.previous_start,
            USER_CREATED_AT__lt=period.end,
        )
        counts = explorers.aggregate(
            current=Count("USER_ID", filter=Q(
                USER_CREATED_AT__gte=period.start,
                USER_CREATED_AT__lt=period.end,
            )),
            previous=Count("USER_ID", filter=Q(
                USER_CREATED_AT__gte=period.previous_start,
                USER_CREATED_AT__lt=period.previous_end,
            )),
        )
        weekly_rows = (
            explorers.filter(
                USER_CREATED_AT__gte=period.start,
                USER_CREATED_AT__lt=period.end,
            )
            .annotate(bucket=TruncWeek("USER_CREATED_AT", tzinfo=MANILA))
            .values("bucket")
            .annotate(value=Count("USER_ID"))
            .order_by("bucket")
        )
        weekly = []
        for row in weekly_rows:
            bucket = row["bucket"].astimezone(MANILA)
            weekly.append({
                "date": bucket.date().isoformat(),
                "start": max(bucket.astimezone(UTC), period.start).isoformat(),
                "end_exclusive": min(
                    (bucket + timedelta(days=7)).astimezone(UTC), period.end,
                ).isoformat(),
                "value": row["value"],
            })
        return {
            "label": "New explorer accounts",
            "description": (
                "Accounts created during the period with the explorer role at query time, "
                "including all account statuses. Later role changes can revise this count."
            ),
            "measurement_type": "period_current_state",
            "value": counts["current"],
            "previous_value": counts["previous"],
            "change": compare_values(
                current=counts["current"], previous=counts["previous"],
                current_sample_size=counts["current"],
                previous_sample_size=counts["previous"],
            ),
            "source": "domain",
        }, weekly

    @classmethod
    def get_overview(cls, period):
        """Return SQL inventory/account metrics alongside independently available discovery data."""
        inventory = Business.objects.aggregate(
            active=Count("BUSN_ID", filter=Q(BUSN_STATUS=Business.BusinessStatus.ACTIVE)),
            # Product decision: approved onboarding, not the legacy verification flag.
            approved=Count("BUSN_ID", filter=Q(
                merchant_application__MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
            )),
        )
        registrations, weekly = cls._registrations(period)
        discovery = DiscoveryAnalyticsService.get_report(
            period, metric="distinct_engaged_explorers", include_series=False,
        )
        domain_meta = build_meta(
            period, coverage_verified=True, data_through=period.end,
            partial_reasons=("current_state_reporting",),
        )
        meta = build_meta(
            period, availability="partial", partial_reasons=(
                "current_state_reporting", "visibility_coverage_unverified",
                *(("visibility_unavailable",) if discovery["value"] is None else ()),
                *(("previous_visibility_unavailable",) if discovery["previous_value"] is None else ()),
            ),
        )
        return {
            "kpis": {
                "active_businesses": cls._snapshot(
                    inventory["active"], "Active businesses",
                    "Businesses currently marked active, regardless of verification or owner status.",
                    period,
                ),
                "approved_businesses": cls._snapshot(
                    inventory["approved"], "Approved businesses",
                    "Businesses linked to a currently approved merchant application, including suspended businesses.",
                    period,
                ),
                "new_explorer_accounts": registrations,
                "discovery_active_explorers": {
                    key: discovery[key] for key in (
                        "label", "description", "measurement_type", "value", "previous_value", "change",
                    )
                } | {"source": "visibility"},
            },
            "new_explorer_accounts_weekly": weekly,
            "registration_series_is_sparse": True,
            "meta": meta,
            "sources": {"domain": domain_meta, **discovery["sources"]},
        }
