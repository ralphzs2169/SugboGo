from itertools import chain

from apps.business.models import BusinessVouch
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationSubmission,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class UserActivityService:
    """Builds a limited administrator-facing feed from existing user data."""

    @staticmethod
    def list_recent_activity(
        *,
        user: User,
        limit: int,
    ) -> list[dict]:
        """Returns the newest supported user activities in a normalized form."""
        reviews = (
            Review.objects
            .filter(
                USER_ID=user,
            )
            .select_related(
                "BUSN_ID",
            )
            .order_by(
                "-REVW_CREATED_AT",
            )[:limit]
        )

        vouches = (
            BusinessVouch.objects
            .filter(
                USER_ID=user,
            )
            .select_related(
                "BUSN_ID",
                "TAG_ID",
            )
            .order_by(
                "-VOUCH_CREATED_AT",
            )[:limit]
        )

        reports = (
            ReviewReport.objects
            .filter(
                USER_ID=user,
            )
            .select_related(
                "REVW_ID",
                "REVW_ID__BUSN_ID",
            )
            .order_by(
                "-RREP_CREATED_AT",
            )[:limit]
        )

        applications = (
            MerchantApplication.objects
            .filter(
                USER_ID=user,
            )
            .order_by(
                "-MAPP_CREATED_AT",
            )[:limit]
        )

        submissions = (
            MerchantApplicationSubmission.objects
            .filter(
                MAPP_ID__USER_ID=user,
            )
            .select_related(
                "MAPP_ID",
            )
            .order_by(
                "-MASUB_SUBMITTED_AT",
            )[:limit]
        )

        disputes = (
            MerchantReviewDispute.objects
            .filter(
                USER_ID=user,
            )
            .select_related(
                "BUSN_ID",
                "REVW_ID",
            )
            .order_by(
                "-MRDSP_CREATED_AT",
            )[:limit]
        )

        activities = chain(
            (
                {
                    "type": "review_created",
                    "timestamp": review.REVW_CREATED_AT,
                    "description_data": {
                        "review_id": review.REVW_ID,
                        "business_id": review.BUSN_ID_id,
                        "business_name": review.BUSN_ID.BUSN_NAME,
                        "status": review.REVW_STATUS,
                    },
                }
                for review in reviews
            ),
            (
                {
                    "type": "business_vouched",
                    "timestamp": vouch.VOUCH_CREATED_AT,
                    "description_data": {
                        "vouch_id": vouch.VOUCH_ID,
                        "business_id": vouch.BUSN_ID_id,
                        "business_name": vouch.BUSN_ID.BUSN_NAME,
                        "specialty_tag_id": vouch.TAG_ID_id,
                        "specialty_tag_name": vouch.TAG_ID.TAG_NAME,
                    },
                }
                for vouch in vouches
            ),
            (
                {
                    "type": "review_reported",
                    "timestamp": report.RREP_CREATED_AT,
                    "description_data": {
                        "report_id": report.RREP_ID,
                        "review_id": report.REVW_ID_id,
                        "business_id": report.REVW_ID.BUSN_ID_id,
                        "business_name": report.REVW_ID.BUSN_ID.BUSN_NAME,
                        "report_type": report.RREP_TYPE,
                        "status": report.RREP_STATUS,
                    },
                }
                for report in reports
            ),
            (
                {
                    "type": "merchant_application_created",
                    "timestamp": application.MAPP_CREATED_AT,
                    "description_data": {
                        "application_id": application.MAPP_ID,
                        "status": application.MAPP_STATUS,
                    },
                }
                for application in applications
            ),
            (
                {
                    "type": "merchant_application_submitted",
                    "timestamp": submission.MASUB_SUBMITTED_AT,
                    "description_data": {
                        "application_id": submission.MAPP_ID_id,
                        "submission_number": (
                            submission.MASUB_SUBMISSION_NUMBER
                        ),
                    },
                }
                for submission in submissions
            ),
            (
                {
                    "type": "review_dispute_created",
                    "timestamp": dispute.MRDSP_CREATED_AT,
                    "description_data": {
                        "dispute_id": dispute.MRDSP_ID,
                        "review_id": dispute.REVW_ID_id,
                        "business_id": dispute.BUSN_ID_id,
                        "business_name": dispute.BUSN_ID.BUSN_NAME,
                        "reason": dispute.MRDSP_REASON,
                        "status": dispute.MRDSP_STATUS,
                    },
                }
                for dispute in disputes
            ),
        )

        return sorted(
            activities,
            key=lambda activity: activity["timestamp"],
            reverse=True,
        )[:limit]
