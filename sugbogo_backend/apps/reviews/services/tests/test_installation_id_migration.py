from decimal import Decimal

from django.contrib.gis.geos import Point
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.business.models import (
    Business,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.reviews.models import Review, ReviewReport
from apps.users.models import User


class InstallationIdMigrationTests(TransactionTestCase):
    """Verify the three column renames retain existing identifier values."""

    def test_existing_identifiers_survive_forward_migration(self):
        """Historical device columns keep their values under canonical names."""
        owner = User.objects.create_user(
            email="migration-owner@example.com",
            password=None,
            USER_FNAME="Owner",
            USER_LNAME="Example",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        author = User.objects.create_user(
            email="migration-author@example.com",
            password=None,
            USER_FNAME="Author",
            USER_LNAME="Example",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(
            CLUS_NAME="Migration cluster",
            CLUS_DESCRIPTION="Migration test",
        )
        category = Category.objects.create(
            CTGRY_NAME="Migration category",
            CTGRY_DESCRIPTION="Migration test",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Migration street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        business = Business.objects.create(
            BUSN_NAME="Migration business",
            BUSN_DESCRIPTION="Migration test",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Migration tag",
            TAG_COLOR="red",
        )
        review = Review.objects.create(
            USER_ID=author,
            BUSN_ID=business,
            REVW_TEXT="A review with a persisted installation ID.",
            REVW_INSTALLATION_ID="review-installation",
        )
        report = ReviewReport.objects.create(
            USER_ID=owner,
            REVW_ID=review,
            RREP_TYPE=ReviewReport.ReportType.SPAM,
            RREP_INSTALLATION_ID="report-installation",
        )
        vouch = BusinessVouch.objects.create(
            USER_ID=author,
            BUSN_ID=business,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20000"),
            VOUCH_INSTALLATION_ID="vouch-installation",
        )
        current = [
            ("business", "0028_rename_vouch_installation_id"),
            ("reviews", "0012_rename_review_installation_ids"),
        ]
        previous = [
            ("business", "0027_clusterdiscoveryshortcut"),
            ("reviews", "0011_review_revw_moderation_data"),
        ]

        try:
            executor = MigrationExecutor(connection)
            executor.migrate(previous)
            old_apps = executor.loader.project_state(previous).apps
            old_review = old_apps.get_model("reviews", "Review")
            old_report = old_apps.get_model("reviews", "ReviewReport")
            old_vouch = old_apps.get_model("business", "BusinessVouch")
            self.assertEqual(
                old_review.objects.get(pk=review.pk).REVW_DEVICE_ID,
                "review-installation",
            )
            self.assertEqual(
                old_report.objects.get(pk=report.pk).RREP_DEVICE_ID,
                "report-installation",
            )
            self.assertEqual(
                old_vouch.objects.get(pk=vouch.pk).VOUCH_DEVICE_ID,
                "vouch-installation",
            )
        finally:
            MigrationExecutor(connection).migrate(current)

        self.assertEqual(
            Review.objects.get(pk=review.pk).REVW_INSTALLATION_ID,
            "review-installation",
        )
        self.assertEqual(
            ReviewReport.objects.get(pk=report.pk).RREP_INSTALLATION_ID,
            "report-installation",
        )
        self.assertEqual(
            BusinessVouch.objects.get(pk=vouch.pk).VOUCH_INSTALLATION_ID,
            "vouch-installation",
        )
