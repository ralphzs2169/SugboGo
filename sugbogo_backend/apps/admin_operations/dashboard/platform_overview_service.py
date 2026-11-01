"""Persisted recent platform events and current account composition for the Dashboard."""

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate

from apps.business.models import BusinessVouch
from apps.merchant_application.models import MerchantApplicationSubmission
from apps.reviews.models import Review
from apps.shared.analytics.date_ranges import MANILA, resolve_period
from apps.users.models import User


class PlatformOverviewService:
    """Keep seven-day event activity distinct from current assigned-role inventory."""

    ACTIVITY_DEFINITIONS = {
        "applications_submitted": (
            "Retained submission events, including each resubmission, regardless "
            "of the application's current status."
        ),
        "reviews_published": (
            "Recorded first publications of retained reviews, regardless of current "
            "review status. Legacy reviews without publication timestamps are excluded."
        ),
        "vouches_created": (
            "Retained vouch records first created in the window, including withdrawn, "
            "invalidated or flagged records. Reinstatement is not a new creation."
        ),
    }

    @staticmethod
    def _daily_counts(
        model,
        timestamp_field,
        period,
    ):
        """Group retained events by Manila date within the single captured reporting window."""
        rows = (
            model.objects.filter(
                **{
                    f"{timestamp_field}__gte": period.start,
                    f"{timestamp_field}__lt": period.end,
                },
            )
            .order_by()
            .annotate(
                date=TruncDate(
                    timestamp_field,
                    tzinfo=MANILA,
                ),
            )
            .values("date")
            .annotate(count=Count("pk"))
        )
        return {
            row["date"]: row["count"]
            for row in rows
        }

    @staticmethod
    def get_overview():
        """Assemble four SQL aggregates using the canonical Manila period without snapshot guarantees."""
        period = resolve_period(preset="7")
        sources = (
            (
                "applications_submitted",
                MerchantApplicationSubmission,
                "MASUB_SUBMITTED_AT",
            ),
            ("reviews_published", Review, "REVW_PUBLISHED_AT"),
            ("vouches_created", BusinessVouch, "VOUCH_CREATED_AT"),
        )
        daily = [
            {"date": period.start_date + timedelta(days=offset)}
            for offset in range(7)
        ]
        totals = {}
        for metric, model, timestamp_field in sources:
            counts = PlatformOverviewService._daily_counts(
                model,
                timestamp_field,
                period,
            )
            for bucket in daily:
                bucket[metric] = counts.get(bucket["date"], 0)
            # Derive each total from the same grouped read, avoiding count-to-series races.
            totals[metric] = sum(counts.values())
        distribution = User.objects.aggregate(
            total=Count("USER_ID"),
            active_accounts=Count(
                "USER_ID",
                filter=Q(
                    USER_STATUS=User.UserStatus.ACTIVE,
                    USER_ROLE__in=(
                        User.UserRole.EXPLORER,
                        User.UserRole.MERCHANT,
                    ),
                ),
            ),
            explorer=Count(
                "USER_ID",
                filter=Q(USER_ROLE=User.UserRole.EXPLORER),
            ),
            merchant=Count(
                "USER_ID",
                filter=Q(USER_ROLE=User.UserRole.MERCHANT),
            ),
            admin=Count(
                "USER_ID",
                filter=Q(USER_ROLE=User.UserRole.ADMIN),
            ),
            super_admin=Count(
                "USER_ID",
                filter=Q(USER_ROLE=User.UserRole.SUPER_ADMIN),
            ),
        )
        active_accounts = distribution.pop("active_accounts")
        known_accounts = sum(
            distribution[role]
            for role in User.UserRole.values
        )
        distribution["unknown_role"] = distribution["total"] - known_accounts
        distribution["scope"] = (
            "Registered accounts by current assigned USER_ROLE, including all account "
            "statuses. Each account counts once; unrecognized roles count in unknown_role."
        )

        return {
            "as_of": period.generated_at,
            "active_accounts": active_accounts,
            "activity": {
                "window": {
                    "start": period.start,
                    "end_exclusive": period.end,
                    "timezone": MANILA.key,
                    "includes_partial_day": period.includes_partial_day,
                },
                **totals,
                "daily": daily,
                "definitions": PlatformOverviewService.ACTIVITY_DEFINITIONS,
            },
            "user_distribution": distribution,
        }
