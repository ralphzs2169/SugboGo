from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.reviews.models import Review, ReviewReport
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)
from apps.users.models import User


class ReportFlagMigrationTests(SummaryFixtureMixin, TransactionTestCase):
    """Check that historical attention is derived from pending report rows."""

    def test_forward_migration_recomputes_stale_flags(self):
        business = self.create_business()
        reviews = [
            self.create_review(business, index)
            for index in range(4)
        ]
        reviews[2].REVW_STATUS = Review.ReviewStatus.REJECTED
        reviews[2].save(update_fields=["REVW_STATUS"])

        reporters = [
            User.objects.create_user(
                email=f"migration-reporter-{index}@example.com",
                password=None,
                USER_FNAME="Migration",
                USER_LNAME="Reporter",
                USER_ROLE=User.UserRole.EXPLORER,
                USER_STATUS=User.UserStatus.ACTIVE,
            )
            for index in range(3)
        ]
        for review in reviews:
            for index, reporter in enumerate(reporters):
                status = ReviewReport.ReportStatus.PENDING
                if review.pk == reviews[1].pk and index == 2:
                    status = ReviewReport.ReportStatus.REJECTED
                ReviewReport.objects.create(
                    REVW_ID=review,
                    USER_ID=reporter,
                    RREP_TYPE=ReviewReport.ReportType.OTHER,
                    RREP_STATUS=status,
                )

        latest_targets = MigrationExecutor(connection).loader.graph.leaf_nodes()
        previous = [("reviews", "0013_review_revw_reliability_reasons")]
        current = [("reviews", "0014_rename_report_attention_flag")]
        try:
            executor = MigrationExecutor(connection)
            executor.migrate(previous)
            old_review = executor.loader.project_state(previous).apps.get_model(
                "reviews",
                "Review",
            )
            old_review.objects.filter(
                pk__in=[reviews[1].pk, reviews[2].pk],
            ).update(
                REVW_IS_SPAM_FLAGGED=True,
            )
            old_review.objects.filter(
                pk__in=[reviews[0].pk, reviews[3].pk],
            ).update(
                REVW_IS_SPAM_FLAGGED=False,
            )

            MigrationExecutor(connection).migrate(current)
            self.assertEqual(
                list(
                    Review.objects.order_by("pk").values_list(
                        "REVW_IS_REPORT_FLAGGED",
                        flat=True,
                    )
                ),
                [True, False, False, True],
            )
        finally:
            MigrationExecutor(connection).migrate(latest_targets)
