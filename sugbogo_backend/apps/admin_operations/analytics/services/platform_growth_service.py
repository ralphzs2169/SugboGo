"""Retained consumer/business creation and first recorded business approvals."""

from django.db.models import Count, Exists, OuterRef, Q

from apps.business.models import Business
from apps.merchant_application.models import MerchantApplicationReview
from apps.shared.analytics.metadata import build_meta
from apps.users.models import User

from .reporting_helpers import calendar_buckets, grouped_time_counts, period_count


class PlatformGrowthService:
    """Separate current inventory from timestamped acquisition measures."""

    @staticmethod
    def consumer_accounts():
        """Exclude administrator roles and staff/superuser flags from current consumer roles."""
        return User.objects.filter(
            USER_ROLE__in=(User.UserRole.EXPLORER, User.UserRole.MERCHANT),
            is_staff=False,
            is_superuser=False,
        )

    @staticmethod
    def first_business_approvals():
        """Count each linked business once using its application's earliest recorded approval."""
        approvals = MerchantApplicationReview.objects.filter(
            MAREV_DECISION=MerchantApplicationReview.Decision.APPROVED,
            MAREV_REVIEWED_AT__isnull=False,
        )
        earlier = approvals.filter(
            MAPP_ID=OuterRef("MAPP_ID"),
        ).filter(
            Q(MAREV_REVIEWED_AT__lt=OuterRef("MAREV_REVIEWED_AT"))
            | Q(
                MAREV_REVIEWED_AT=OuterRef("MAREV_REVIEWED_AT"),
                MAREV_ID__lt=OuterRef("MAREV_ID"),
            ),
        )
        return approvals.filter(
            MAPP_ID__BUSN_ID__isnull=False,
        ).filter(
            ~Exists(earlier),
        )

    @classmethod
    def get_report(
        cls,
        period,
        interval="daily",
    ):
        """Report current inventory and zero-filled creation/approval event series."""
        consumers = cls.consumer_accounts().filter(USER_CREATED_AT__lte=period.generated_at)
        businesses = Business.objects.filter(BUSN_CREATED_AT__lte=period.generated_at)
        accounts = consumers.aggregate(
            consumer_accounts=Count("pk"),
            current_explorer_accounts=Count(
                "pk",
                filter=Q(USER_ROLE=User.UserRole.EXPLORER),
            ),
            current_merchant_accounts=Count(
                "pk",
                filter=Q(USER_ROLE=User.UserRole.MERCHANT),
            ),
        )
        inventory = businesses.aggregate(
            total_businesses=Count("pk"),
            active_businesses=Count(
                "pk",
                filter=Q(BUSN_STATUS=Business.BusinessStatus.ACTIVE),
            ),
            suspended_businesses=Count(
                "pk",
                filter=Q(BUSN_STATUS=Business.BusinessStatus.SUSPENDED),
            ),
        )
        sources = (
            ("new_consumer_accounts", consumers, "USER_CREATED_AT"),
            ("new_businesses", businesses, "BUSN_CREATED_AT"),
            ("newly_approved_businesses", cls.first_business_approvals(), "MAREV_REVIEWED_AT"),
        )
        activity = {}
        series_counts = {}
        for name, queryset, field in sources:
            activity[name] = period_count(queryset, field, period)
            rows = grouped_time_counts(queryset, field, period, interval)
            series_counts[name] = {
                row["bucket"].date().isoformat(): row["value"]
                for row in rows
            }
        series = []
        for bucket in calendar_buckets(period, interval):
            series.append({
                **bucket,
                **{
                    name: counts.get(bucket["date"], 0)
                    for name, counts in series_counts.items()
                },
            })
        return {
            "inventory": {
                "measurement_type": "current_snapshot",
                "as_of": period.generated_at.isoformat(),
                "selected_period_applies": False,
                **accounts,
                **inventory,
            },
            "activity": activity,
            "interval": interval,
            "series": series,
            "series_is_sparse": False,
            "definitions": {
                "consumer_accounts": (
                    "Current Explorer/Merchant roles, all account statuses, excluding "
                    "staff, superusers and Admin/Super Admin roles. Role changes/deletion "
                    "can revise retained creation cohorts."
                ),
                "new_businesses": "Retained businesses created in the period, regardless of current status.",
                "newly_approved_businesses": (
                    "Earliest recorded approval per application currently linked to a business; "
                    "not current Merchant-role accounts. Later approvals of the same application "
                    "do not count again; current business/application status is not a filter."
                ),
                "comparisons": (
                    "Absolute count differences across adjacent equal-elapsed periods; "
                    "no inventory comparison."
                ),
            },
            "meta": build_meta(
                period,
                coverage_verified=True,
                data_through=period.end,
                partial_reasons=("current_role_and_retained_rows", "recorded_approval_history_only"),
            ),
        }
