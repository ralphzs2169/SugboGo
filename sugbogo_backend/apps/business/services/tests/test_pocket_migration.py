from datetime import timedelta
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class PocketFavoritesMigrationTests(TransactionTestCase):
    """Runs the real schema and historical-data migrations on the disposable test DB."""

    def test_backfill_preserves_saves_counters_timestamps_and_is_repeatable(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        previous = [
            ("business", "0028_rename_vouch_installation_id"),
            ("users", "0015_disable_legacy_bootstrap_superadmin"),
        ]
        target = [
            ("business", "0030_backfill_pocket_favorites"),
            ("users", "0015_disable_legacy_bootstrap_superadmin"),
        ]
        try:
            executor.migrate(previous)
            old_apps = executor.loader.project_state(previous).apps
            user_model = old_apps.get_model("users", "User")
            users = []
            for index, role in enumerate(("explorer", "merchant", "admin", "admin")):
                users.append(user_model.objects.create(
                    USER_EMAIL=f"pocket-migration-{index}@example.com",
                    USER_FNAME="Migration",
                    USER_LNAME=str(index),
                    USER_ROLE=role,
                    USER_STATUS="active",
                    USER_REPUTATION=Decimal("0.20000"),
                    password="!",
                ))
            cluster = old_apps.get_model("business", "Cluster").objects.create(CLUS_NAME="Pocket migration")
            category = old_apps.get_model("business", "Category").objects.create(
                CTGRY_NAME="Migration cafe", CLUS_ID=cluster,
            )
            location = old_apps.get_model("business", "Location").objects.create(
                LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
                LOCT_ADDRESS="Migration street",
                LOCT_CITY="Cebu City",
                LOCT_PROVINCE="Cebu",
            )
            business = old_apps.get_model("business", "Business").objects.create(
                USER_ID=users[1], CTGRY_ID=category, LOCT_ID=location,
                BUSN_NAME="Migration cafe", BUSN_CONTACT_NUMBER="09171234567",
                BUSN_STATUS="suspended", BUSN_POCKET_COUNT=23,
            )
            saved_model = old_apps.get_model("business", "BusinessPocket")
            saves = [saved_model.objects.create(USER_ID=user, BUSN_ID=business) for user in (users[0], users[2])]
            created_at = timezone.now() - timedelta(days=40)
            updated_at = created_at + timedelta(days=5)
            saved_model.objects.filter(pk__in=[saved.pk for saved in saves]).update(
                PCKT_CREATED_AT=created_at,
                PCKT_UPDATED_AT=updated_at,
            )
            with patch("apps.business.services.visibility_event_service.VisibilityEventService.record_save") as event:
                executor = MigrationExecutor(connection)
                executor.migrate(target)
                new_apps = executor.loader.project_state(target).apps
                collection_model = new_apps.get_model("business", "PocketCollection")
                membership_model = new_apps.get_model("business", "PocketMembership")
                for user in users[:3]:
                    self.assertEqual(collection_model.objects.filter(USER_ID_id=user.pk, PCOL_IS_DEFAULT=True).count(), 1)
                self.assertFalse(collection_model.objects.filter(USER_ID_id=users[3].pk).exists())
                for saved in saves:
                    restored = new_apps.get_model("business", "BusinessPocket").objects.get(pk=saved.pk)
                    self.assertEqual(restored.PCKT_CREATED_AT, created_at)
                    self.assertEqual(restored.PCKT_UPDATED_AT, updated_at)
                    membership = membership_model.objects.get(PCKT_ID_id=saved.pk)
                    self.assertEqual(membership.PMEM_CREATED_AT, created_at)
                    self.assertEqual(membership.PMEM_UPDATED_AT, updated_at)
                    self.assertEqual(membership.PCOL_ID.USER_ID_id, saved.USER_ID_id)
                self.assertEqual(new_apps.get_model("business", "Business").objects.get(pk=business.pk).BUSN_POCKET_COUNT, 23)
                import_module("apps.business.migrations.0030_backfill_pocket_favorites").backfill_favorites(
                    new_apps, SimpleNamespace(connection=connection),
                )
                self.assertEqual(collection_model.objects.filter(USER_ID_id__in=[user.pk for user in users]).count(), 3)
                self.assertEqual(membership_model.objects.filter(PCKT_ID_id__in=[saved.pk for saved in saves]).count(), 2)
                event.assert_not_called()
        finally:
            MigrationExecutor(connection).migrate(latest)
