from datetime import UTC, datetime
from decimal import Decimal

from django.contrib.gis.geos import Point
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.business.models import (
    Business,
    Category,
    Cluster,
    Location,
)
from apps.users.models import User


class DiscoveryScoreMigrationTests(TransactionTestCase):
    """Tests how the current-score migration preserves legacy rows."""

    migrate_from = (
        "business",
        "0024_businessspecialtytag_score_state",
    )
    migrate_to = (
        "business",
        "0025_alter_discoveryscore_options_and_more",
    )

    def tearDown(self):
        """Restores the latest schema even when a migration assertion fails."""

        self._migrate_to(
            self.migrate_to,
        )
        super().tearDown()

    def _migrate_to(
        self,
        target,
    ):
        """Moves the business app to one migration and returns its app state."""

        executor = MigrationExecutor(
            connection,
        )
        executor.migrate(
            [
                target,
            ],
        )

        return executor.loader.project_state(
            [
                target,
            ],
        ).apps

    def _create_owner(
        self,
        index: int,
    ) -> User:
        """Creates a historical merchant user for one migration business."""

        return User.objects.create_user(
            email=f"migration-owner-{index}@example.com",
            password=None,
            USER_FNAME="Migration",
            USER_LNAME=f"Owner {index}",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=Decimal("0.20000"),
        )

    def _create_business(
        self,
        owner: User,
        category: Category,
        location: Location,
        index: int,
    ) -> Business:
        """Creates a historical business used by legacy score rows."""

        return Business.objects.create(
            BUSN_NAME=f"Migration Business {index}",
            BUSN_DESCRIPTION="Legacy score migration business.",
            BUSN_CONTACT_NUMBER=f"0917123456{index}",
            BUSN_STATUS="active",
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    def test_migration_keeps_one_deterministic_legacy_score_per_business(self):
        """Keeps newest current rows and otherwise keeps the newest score."""

        old_apps = self._migrate_to(
            self.migrate_from,
        )
        discovery_score_model = old_apps.get_model(
            "business",
            "DiscoveryScore",
        )
        cluster = Cluster.objects.create(
            CLUS_NAME="Migration Score Cluster",
            CLUS_DESCRIPTION="Migration cluster.",
        )
        category = Category.objects.create(
            CTGRY_NAME="Migration Score Category",
            CTGRY_DESCRIPTION="Migration category.",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Migration Score Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        first_owner = self._create_owner(
            index=1,
        )
        second_owner = self._create_owner(
            index=2,
        )
        first_business = self._create_business(
            owner=first_owner,
            category=category,
            location=location,
            index=1,
        )
        second_business = self._create_business(
            owner=second_owner,
            category=category,
            location=location,
            index=2,
        )
        older_time = datetime(
            2026,
            1,
            1,
            tzinfo=UTC,
        )
        newer_time = datetime(
            2026,
            2,
            1,
            tzinfo=UTC,
        )
        newest_time = datetime(
            2026,
            3,
            1,
            tzinfo=UTC,
        )
        discovery_score_model.objects.create(
            BUSN_ID_id=first_business.BUSN_ID,
            DSC_S_SCORE=Decimal("0.11"),
            DSC_V_SCORE=Decimal("0.22"),
            DSC_D_SCORE=Decimal("0.33"),
            DSC_IS_CURRENT=True,
            DSC_COMPUTED_AT=older_time,
        )
        retained_current = discovery_score_model.objects.create(
            BUSN_ID_id=first_business.BUSN_ID,
            DSC_S_SCORE=Decimal("0.44"),
            DSC_V_SCORE=Decimal("0.55"),
            DSC_D_SCORE=Decimal("0.66"),
            DSC_IS_CURRENT=True,
            DSC_COMPUTED_AT=newer_time,
        )
        discovery_score_model.objects.create(
            BUSN_ID_id=first_business.BUSN_ID,
            DSC_S_SCORE=Decimal("0.77"),
            DSC_V_SCORE=Decimal("0.88"),
            DSC_D_SCORE=Decimal("0.99"),
            DSC_IS_CURRENT=False,
            DSC_COMPUTED_AT=newest_time,
        )
        discovery_score_model.objects.create(
            BUSN_ID_id=second_business.BUSN_ID,
            DSC_S_SCORE=Decimal("0.15"),
            DSC_V_SCORE=Decimal("0.25"),
            DSC_D_SCORE=Decimal("0.35"),
            DSC_IS_CURRENT=False,
            DSC_COMPUTED_AT=older_time,
        )
        retained_latest = discovery_score_model.objects.create(
            BUSN_ID_id=second_business.BUSN_ID,
            DSC_S_SCORE=Decimal("0.75"),
            DSC_V_SCORE=Decimal("1.25"),
            DSC_D_SCORE=Decimal("-0.25"),
            DSC_IS_CURRENT=False,
            DSC_COMPUTED_AT=newest_time,
        )

        new_apps = self._migrate_to(
            self.migrate_to,
        )
        migrated_score_model = new_apps.get_model(
            "business",
            "DiscoveryScore",
        )
        first_score = migrated_score_model.objects.get(
            BUSN_ID_id=first_business.BUSN_ID,
        )
        second_score = migrated_score_model.objects.get(
            BUSN_ID_id=second_business.BUSN_ID,
        )
        migrated_field_names = {
            field.name
            for field in migrated_score_model._meta.get_fields()
        }

        self.assertEqual(
            migrated_score_model.objects.count(),
            2,
        )
        self.assertEqual(
            first_score.DSC_ID,
            retained_current.DSC_ID,
        )
        self.assertEqual(
            first_score.DSC_S_SCORE,
            Decimal("0.44000"),
        )
        self.assertEqual(
            second_score.DSC_ID,
            retained_latest.DSC_ID,
        )
        self.assertEqual(
            second_score.DSC_S_SCORE,
            Decimal("0.75000"),
        )
        self.assertEqual(
            second_score.DSC_V_SCORE,
            Decimal("1.00000"),
        )
        self.assertEqual(
            second_score.DSC_D_SCORE,
            Decimal("0.00000"),
        )
        self.assertNotIn(
            "DSC_IS_CURRENT",
            migrated_field_names,
        )
