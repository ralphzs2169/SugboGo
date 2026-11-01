"""Persisted recent platform events and current account composition for the Dashboard."""

from django.db.models import Count, Q

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
    def get_overview():
        """Assemble four SQL aggregates using the canonical Manila period without snapshot guarantees."""
        period = resolve_period(preset="7")
        applications_submitted = MerchantApplicationSubmission.objects.filter(
            MASUB_SUBMITTED_AT__gte=period.start,
            MASUB_SUBMITTED_AT__lt=period.end,
        ).count()
        reviews_published = Review.objects.filter(
            REVW_PUBLISHED_AT__gte=period.start,
            REVW_PUBLISHED_AT__lt=period.end,
        ).count()
        vouches_created = BusinessVouch.objects.filter(
            VOUCH_CREATED_AT__gte=period.start,
            VOUCH_CREATED_AT__lt=period.end,
        ).count()
        distribution = User.objects.aggregate(
            total=Count("USER_ID"),
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
            "activity": {
                "window": {
                    "start": period.start,
                    "end_exclusive": period.end,
                    "timezone": MANILA.key,
                    "includes_partial_day": period.includes_partial_day,
                },
                "applications_submitted": applications_submitted,
                "reviews_published": reviews_published,
                "vouches_created": vouches_created,
                "definitions": PlatformOverviewService.ACTIVITY_DEFINITIONS,
            },
            "user_distribution": distribution,
        }
