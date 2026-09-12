from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase, override_settings
from pymongo.errors import AutoReconnect
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.pocket_service import PocketService
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityEventType,
    VisibilityTrackingUnavailable,
)
from apps.shared.services.mongodb_service import MongoDBService
from apps.users.models import ReputationEvent, User


class FakeVisibilityCollection:
    def __init__(self):
        self.documents = {}
        self.index_calls = []
        self.aggregate_calls = []
        self.aggregate_rows = []
        self.bulk_write_error = None

    def create_index(
        self,
        keys,
        **kwargs,
    ):
        self.index_calls.append(
            (
                keys,
                kwargs,
            ),
        )

        return kwargs.get(
            "name",
        )

    def bulk_write(
        self,
        operations,
        ordered,
    ):
        if self.bulk_write_error is not None:
            raise self.bulk_write_error

        upserted_count = 0

        for operation in operations:
            dedupe_key = operation._filter["dedupe_key"]

            if dedupe_key in self.documents:
                continue

            self.documents[dedupe_key] = operation._doc[
                "$setOnInsert"
            ].copy()
            upserted_count += 1

        return SimpleNamespace(
            upserted_count=upserted_count,
            ordered=ordered,
        )

    def aggregate(
        self,
        pipeline,
    ):
        self.aggregate_calls.append(
            pipeline,
        )

        return iter(
            self.aggregate_rows,
        )


class FakeVisibilityDatabase:
    def __init__(
        self,
        collection,
    ):
        self.collection = collection

    def __getitem__(
        self,
        collection_name,
    ):
        if collection_name != VisibilityEventService.COLLECTION_NAME:
            raise KeyError(
                collection_name,
            )

        return self.collection


class VisibilityEventServiceTests(TestCase):
    EVENT_TIME = datetime(
        2026,
        9,
        10,
        8,
        30,
        tzinfo=UTC,
    )

    @classmethod
    def setUpTestData(cls):
        cls.explorer = User.objects.create_user(
            email="visibility-explorer@example.com",
            password=None,
            USER_FNAME="Visibility",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.second_explorer = User.objects.create_user(
            email="visibility-explorer-two@example.com",
            password=None,
            USER_FNAME="Second",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.first_owner = User.objects.create_user(
            email="visibility-owner-one@example.com",
            password=None,
            USER_FNAME="First",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.second_owner = User.objects.create_user(
            email="visibility-owner-two@example.com",
            password=None,
            USER_FNAME="Second",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.suspended_owner = User.objects.create_user(
            email="visibility-owner-suspended@example.com",
            password=None,
            USER_FNAME="Suspended",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.cluster = Cluster.objects.create(
            CLUS_NAME="Visibility Cluster",
            CLUS_DESCRIPTION="Visibility test cluster.",
        )
        cls.category = Category.objects.create(
            CTGRY_NAME="Visibility Category",
            CTGRY_DESCRIPTION="Visibility test category.",
            CLUS_ID=cls.cluster,
        )
        cls.first_location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="First Visibility Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.second_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9000,
                10.3200,
                srid=4326,
            ),
            LOCT_ADDRESS="Second Visibility Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.suspended_location = Location.objects.create(
            LOCT_POINT=Point(
                123.9100,
                10.3300,
                srid=4326,
            ),
            LOCT_ADDRESS="Suspended Visibility Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        cls.first_business = Business.objects.create(
            BUSN_NAME="First Visibility Business",
            BUSN_DESCRIPTION="First active visibility business.",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.first_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.first_location,
        )
        cls.second_business = Business.objects.create(
            BUSN_NAME="Second Visibility Business",
            BUSN_DESCRIPTION="Second active visibility business.",
            BUSN_CONTACT_NUMBER="09171234568",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=cls.second_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.second_location,
        )
        cls.suspended_business = Business.objects.create(
            BUSN_NAME="Suspended Visibility Business",
            BUSN_DESCRIPTION="Suspended visibility business.",
            BUSN_CONTACT_NUMBER="09171234569",
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
            USER_ID=cls.suspended_owner,
            CTGRY_ID=cls.category,
            LOCT_ID=cls.suspended_location,
        )

    def setUp(self):
        self.collection = FakeVisibilityCollection()
        self.database = FakeVisibilityDatabase(
            self.collection,
        )
        self.database_patcher = patch.object(
            MongoDBService,
            "get_database",
            return_value=self.database,
        )
        self.get_database = self.database_patcher.start()
        self.addCleanup(
            self.database_patcher.stop,
        )

        VisibilityEventService._indexes_initialized = False
        VisibilityEventService._unavailable_until = 0.0
        self.time_patcher = patch.object(
            VisibilityEventService,
            "_get_current_time",
            return_value=self.EVENT_TIME,
        )
        self.time_patcher.start()
        self.addCleanup(
            self.time_patcher.stop,
        )

    def _record_first_impression(
        self,
        explorer_id=None,
    ):
        if explorer_id is None:
            explorer_id = self.explorer.USER_ID

        return VisibilityEventService.record_impressions(
            explorer_id=explorer_id,
            business_ids=[
                self.first_business.BUSN_ID,
            ],
        )

    def test_first_impression_creates_event(self):
        result = self._record_first_impression()
        document = next(
            iter(
                self.collection.documents.values(),
            ),
        )

        self.assertEqual(
            result.recorded_count,
            1,
        )
        self.assertEqual(
            document["event_type"],
            VisibilityEventType.IMPRESSION.value,
        )
        self.assertEqual(
            document["business_id"],
            self.first_business.BUSN_ID,
        )
        self.assertEqual(
            document["explorer_id"],
            self.explorer.USER_ID,
        )
        self.assertEqual(
            document["occurred_at"],
            self.EVENT_TIME,
        )

    def test_same_daily_impression_is_deduplicated(self):
        first = self._record_first_impression()
        second = self._record_first_impression()

        self.assertEqual(
            first.recorded_count,
            1,
        )
        self.assertEqual(
            second.recorded_count,
            0,
        )
        self.assertEqual(
            second.duplicate_count,
            1,
        )
        self.assertEqual(
            len(self.collection.documents),
            1,
        )

    def test_same_impression_on_next_day_creates_event(self):
        self._record_first_impression()

        with patch.object(
            VisibilityEventService,
            "_get_current_time",
            return_value=(
                self.EVENT_TIME
                + timedelta(days=1)
            ),
        ):
            second = self._record_first_impression()

        self.assertEqual(
            second.recorded_count,
            1,
        )
        self.assertEqual(
            len(self.collection.documents),
            2,
        )

    @override_settings(
        TIME_ZONE="Asia/Manila",
    )
    def test_deduplication_day_uses_configured_timezone(self):
        local_next_day = datetime(
            2026,
            9,
            10,
            18,
            0,
            tzinfo=UTC,
        )

        with patch.object(
            VisibilityEventService,
            "_get_current_time",
            return_value=local_next_day,
        ):
            self._record_first_impression()

        dedupe_key = next(
            iter(
                self.collection.documents,
            ),
        )

        self.assertTrue(
            dedupe_key.endswith(
                "2026-09-11",
            ),
        )

    def test_different_explorers_create_separate_impressions(self):
        self._record_first_impression(
            explorer_id=self.explorer.USER_ID,
        )
        self._record_first_impression(
            explorer_id=self.second_explorer.USER_ID,
        )

        self.assertEqual(
            len(self.collection.documents),
            2,
        )

    def test_different_businesses_create_separate_impressions(self):
        result = VisibilityEventService.record_impressions(
            explorer_id=self.explorer.USER_ID,
            business_ids=[
                self.first_business.BUSN_ID,
                self.second_business.BUSN_ID,
            ],
        )

        self.assertEqual(
            result.recorded_count,
            2,
        )
        self.assertEqual(
            len(self.collection.documents),
            2,
        )

    def test_duplicate_business_ids_in_batch_are_deduplicated(self):
        result = VisibilityEventService.record_impressions(
            explorer_id=self.explorer.USER_ID,
            business_ids=[
                self.first_business.BUSN_ID,
                self.first_business.BUSN_ID,
                self.first_business.BUSN_ID,
            ],
        )

        self.assertEqual(
            result.eligible_business_ids,
            (
                self.first_business.BUSN_ID,
            ),
        )
        self.assertEqual(
            result.recorded_count,
            1,
        )

    def test_batch_rejects_nonexistent_business(self):
        with self.assertRaises(ValidationError):
            VisibilityEventService.record_impressions(
                explorer_id=self.explorer.USER_ID,
                business_ids=[
                    self.first_business.BUSN_ID,
                    999999,
                ],
            )

        self.assertEqual(
            len(self.collection.documents),
            0,
        )

    def test_batch_rejects_inactive_business(self):
        with self.assertRaises(ValidationError):
            VisibilityEventService.record_impressions(
                explorer_id=self.explorer.USER_ID,
                business_ids=[
                    self.suspended_business.BUSN_ID,
                ],
            )

    def test_batch_business_validation_uses_one_query(self):
        with self.assertNumQueries(1):
            VisibilityEventService.record_impressions(
                explorer_id=self.explorer.USER_ID,
                business_ids=[
                    self.first_business.BUSN_ID,
                    self.second_business.BUSN_ID,
                ],
            )

    def test_first_profile_visit_creates_event(self):
        result = VisibilityEventService.record_profile_visit(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )

        self.assertEqual(
            result.recorded_count,
            1,
        )
        self.assertEqual(
            next(iter(self.collection.documents.values()))["event_type"],
            VisibilityEventType.PROFILE_VISIT.value,
        )

    def test_same_daily_profile_visit_is_deduplicated(self):
        first = VisibilityEventService.record_profile_visit(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )
        second = VisibilityEventService.record_profile_visit(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )

        self.assertEqual(
            first.recorded_count,
            1,
        )
        self.assertEqual(
            second.duplicate_count,
            1,
        )

    def test_profile_visit_and_impression_coexist(self):
        self._record_first_impression()
        VisibilityEventService.record_profile_visit(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )

        event_types = {
            document["event_type"]
            for document in self.collection.documents.values()
        }

        self.assertEqual(
            event_types,
            {
                VisibilityEventType.IMPRESSION.value,
                VisibilityEventType.PROFILE_VISIT.value,
            },
        )

    def test_next_day_profile_visit_creates_event(self):
        VisibilityEventService.record_profile_visit(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )

        with patch.object(
            VisibilityEventService,
            "_get_current_time",
            return_value=(
                self.EVENT_TIME
                + timedelta(days=1)
            ),
        ):
            result = VisibilityEventService.record_profile_visit(
                explorer_id=self.explorer.USER_ID,
                business_id=self.first_business.BUSN_ID,
            )

        self.assertEqual(
            result.recorded_count,
            1,
        )

    def test_profile_visit_rejects_nonexistent_business(self):
        with self.assertRaisesMessage(
            NotFound,
            "The business could not be found.",
        ):
            VisibilityEventService.record_profile_visit(
                explorer_id=self.explorer.USER_ID,
                business_id=999999,
            )

    def test_unique_and_aggregation_indexes_are_initialized_once(self):
        self._record_first_impression()
        self._record_first_impression()

        self.assertEqual(
            len(self.collection.index_calls),
            2,
        )
        unique_index = self.collection.index_calls[0]
        aggregation_index = self.collection.index_calls[1]

        self.assertTrue(
            unique_index[1]["unique"],
        )
        self.assertEqual(
            unique_index[1]["name"],
            VisibilityEventService.DEDUPE_INDEX_NAME,
        )
        self.assertEqual(
            aggregation_index[1]["name"],
            VisibilityEventService.AGGREGATION_INDEX_NAME,
        )

    def test_service_uses_shared_mongodb_service(self):
        self._record_first_impression()

        self.assertGreaterEqual(
            self.get_database.call_count,
            1,
        )

    def test_mongo_write_failure_becomes_controlled_exception(self):
        self.collection.bulk_write_error = AutoReconnect(
            "MongoDB unavailable.",
        )

        with self.assertRaises(VisibilityTrackingUnavailable):
            self._record_first_impression()

    @override_settings(
        MONGODB_VISIBILITY_FAILURE_COOLDOWN_SECONDS=30,
    )
    def test_mongo_failure_cooldown_fails_fast_then_allows_recovery(self):
        clock = {
            "value": 100.0,
        }
        self.get_database.side_effect = [
            AutoReconnect(
                "MongoDB unavailable.",
            ),
            self.database,
        ]

        with patch.object(
            VisibilityEventService,
            "_get_monotonic_time",
            side_effect=lambda: clock["value"],
        ):
            with self.assertRaises(
                VisibilityTrackingUnavailable,
            ) as first_failure:
                VisibilityEventService.ensure_indexes()

            self.assertFalse(
                first_failure.exception.cooldown_short_circuit,
            )
            self.assertEqual(
                self.get_database.call_count,
                1,
            )

            with self.assertRaises(
                VisibilityTrackingUnavailable,
            ) as cooldown_failure:
                VisibilityEventService.ensure_indexes()

            self.assertTrue(
                cooldown_failure.exception.cooldown_short_circuit,
            )
            self.assertEqual(
                self.get_database.call_count,
                1,
            )

            clock["value"] = 131.0
            VisibilityEventService.ensure_indexes()
            VisibilityEventService.ensure_indexes()

        self.assertEqual(
            self.get_database.call_count,
            2,
        )
        self.assertEqual(
            len(self.collection.index_calls),
            2,
        )
        self.assertEqual(
            VisibilityEventService._unavailable_until,
            0.0,
        )

    def test_unexpected_index_initialization_error_propagates(self):
        self.get_database.side_effect = RuntimeError(
            "programming error",
        )

        with self.assertRaisesMessage(
            RuntimeError,
            "programming error",
        ):
            VisibilityEventService.ensure_indexes()

        self.assertEqual(
            VisibilityEventService._unavailable_until,
            0.0,
        )

    def test_recent_metrics_pipeline_uses_time_window(self):
        start_time = self.EVENT_TIME - timedelta(days=30)
        end_time = self.EVENT_TIME
        self.collection.aggregate_rows = [
            {
                "_id": {
                    "business_id": self.first_business.BUSN_ID,
                    "event_type": VisibilityEventType.IMPRESSION.value,
                },
                "event_count": 4,
                "explorer_ids": [
                    self.explorer.USER_ID,
                ],
            },
            {
                "_id": {
                    "business_id": self.first_business.BUSN_ID,
                    "event_type": VisibilityEventType.SAVE.value,
                },
                "event_count": 3,
                "explorer_ids": [
                    self.explorer.USER_ID,
                    self.second_explorer.USER_ID,
                ],
            },
        ]

        metrics = VisibilityEventService.get_recent_visibility_metrics(
            business_ids=[
                self.first_business.BUSN_ID,
                self.second_business.BUSN_ID,
            ],
            start_time=start_time,
            end_time=end_time,
        )
        match = self.collection.aggregate_calls[0][0]["$match"]

        self.assertEqual(
            match["occurred_at"],
            {
                "$gte": start_time,
                "$lt": end_time,
            },
        )
        self.assertEqual(
            metrics[self.first_business.BUSN_ID]["impression_count"],
            4,
        )
        self.assertEqual(
            metrics[self.first_business.BUSN_ID]["save_event_count"],
            3,
        )
        self.assertEqual(
            metrics[self.first_business.BUSN_ID]["unique_saver_count"],
            2,
        )
        self.assertEqual(
            metrics[self.second_business.BUSN_ID]["impression_count"],
            0,
        )

    def test_save_event_is_derived_after_pocket_commit(self):
        with self.captureOnCommitCallbacks(
            execute=True,
        ):
            pocket = PocketService.create_pocket(
                user=self.explorer,
                business_id=self.first_business.BUSN_ID,
            )

        document = next(
            iter(
                self.collection.documents.values(),
            ),
        )

        self.assertTrue(
            BusinessPocket.objects.filter(
                PCKT_ID=pocket.PCKT_ID,
            ).exists(),
        )
        self.assertEqual(
            document["event_type"],
            VisibilityEventType.SAVE.value,
        )

    def test_same_daily_save_event_is_deduplicated(self):
        first = VisibilityEventService.record_save(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )
        second = VisibilityEventService.record_save(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )

        self.assertEqual(
            first.recorded_count,
            1,
        )
        self.assertEqual(
            second.recorded_count,
            0,
        )
        self.assertEqual(
            second.duplicate_count,
            1,
        )

    def test_same_day_pocket_recreation_does_not_duplicate_save_event(self):
        with self.captureOnCommitCallbacks(
            execute=True,
        ):
            PocketService.create_pocket(
                user=self.explorer,
                business_id=self.first_business.BUSN_ID,
            )

        PocketService.remove_pocket(
            user=self.explorer,
            business_id=self.first_business.BUSN_ID,
        )

        with self.captureOnCommitCallbacks(
            execute=True,
        ):
            PocketService.create_pocket(
                user=self.explorer,
                business_id=self.first_business.BUSN_ID,
            )

        self.assertEqual(
            len(self.collection.documents),
            1,
        )

    def test_removing_pocket_keeps_historical_save_event(self):
        with self.captureOnCommitCallbacks(
            execute=True,
        ):
            PocketService.create_pocket(
                user=self.explorer,
                business_id=self.first_business.BUSN_ID,
            )

        PocketService.remove_pocket(
            user=self.explorer,
            business_id=self.first_business.BUSN_ID,
        )

        self.assertEqual(
            len(self.collection.documents),
            1,
        )
        self.assertFalse(
            BusinessPocket.objects.filter(
                USER_ID=self.explorer,
                BUSN_ID=self.first_business,
            ).exists(),
        )

    def test_saves_for_different_businesses_are_independent(self):
        with self.captureOnCommitCallbacks(
            execute=True,
        ):
            PocketService.create_pocket(
                user=self.explorer,
                business_id=self.first_business.BUSN_ID,
            )
            PocketService.create_pocket(
                user=self.explorer,
                business_id=self.second_business.BUSN_ID,
            )

        self.assertEqual(
            len(self.collection.documents),
            2,
        )

    def test_mongo_failure_does_not_roll_back_pocket(self):
        with patch.object(
            VisibilityEventService,
            "record_save",
            side_effect=VisibilityTrackingUnavailable(),
        ):
            with self.captureOnCommitCallbacks(
                execute=True,
            ):
                pocket = PocketService.create_pocket(
                    user=self.explorer,
                    business_id=self.first_business.BUSN_ID,
                )

        self.assertTrue(
            BusinessPocket.objects.filter(
                PCKT_ID=pocket.PCKT_ID,
            ).exists(),
        )
        self.first_business.refresh_from_db()
        self.assertEqual(
            self.first_business.BUSN_POCKET_COUNT,
            1,
        )

    def test_visibility_tracking_does_not_change_scores_or_reputation(self):
        specialty = SpecialtyTag.objects.create(
            TAG_NAME="Visibility Regression Specialty",
            TAG_COLOR="green",
        )
        business_specialty = BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.first_business,
            TAG_ID=specialty,
            BST_TAG_SCORE="0.54321",
        )
        reputation = self.explorer.USER_REPUTATION
        reputation_event_count = ReputationEvent.objects.count()

        self._record_first_impression()
        VisibilityEventService.record_profile_visit(
            explorer_id=self.explorer.USER_ID,
            business_id=self.first_business.BUSN_ID,
        )
        business_specialty.refresh_from_db()
        self.explorer.refresh_from_db()

        self.assertEqual(
            business_specialty.BST_TAG_SCORE,
            Decimal("0.54321"),
        )
        self.assertEqual(
            self.explorer.USER_REPUTATION,
            reputation,
        )
        self.assertEqual(
            ReputationEvent.objects.count(),
            reputation_event_count,
        )
