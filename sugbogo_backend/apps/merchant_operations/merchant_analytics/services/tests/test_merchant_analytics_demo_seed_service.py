"""Exercise development seed writes only in Django's isolated database and an in-memory visibility store."""

import copy
import json
import os
from datetime import UTC, datetime, timedelta
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.gis.geos import Point
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from pymongo.errors import ServerSelectionTimeoutError
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.business.models import (
    Business,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.tests.test_visibility_analytics_service import ReadOnlyCollection
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.reviews.models import BusinessReviewSummary, Review, ReviewReply
from apps.notifications.models import Notification
from apps.users.models import ReputationEvent, User
from apps.shared.analytics.date_ranges import resolve_period

from ..analytics_demo_dataset import build_dataset, observation_identity, parse_timestamp
from ..analytics_demo_manifest import AnalyticsDemoManifest
from ..analytics_demo_visibility import AnalyticsDemoVisibility, INDEXES
from ..engagement_heatmap_service import EngagementHeatmapService
from ..merchant_analytics_demo_seed_service import MerchantAnalyticsDemoSeedService as Seeder
from ..premium_review_performance_service import PremiumReviewPerformanceService
from ..premium_specialty_service import PremiumSpecialtyService
from ..premium_visibility_service import PremiumVisibilityService
from ..standard_analytics_service import StandardAnalyticsService
from ..recommendation_service import RecommendationService
from ...models import MerchantRecommendation


class MemoryCollection(ReadOnlyCollection):
    """Extend the repository's pipeline test double with exact fixture write operations."""

    def __init__(self):
        super().__init__([])
        self.indexes = {}
        self.exists = False
        self.database = self
        self.name = "analytics_demo_test"

    def __getitem__(
        self,
        name,
    ):
        return self

    def index_information(self):
        return copy.deepcopy(self.indexes)

    def list_collection_names(
        self,
        **options,
    ):
        return [VisibilityEventService.COLLECTION_NAME] if self.exists else []

    def create_index(
        self,
        keys,
        **options,
    ):
        self.exists = True
        self.indexes[options["name"]] = {
            "key": keys,
            "unique": options.get("unique", False),
        }

    @staticmethod
    def matches(
        row,
        query,
    ):
        for key, value in query.items():
            if isinstance(value, dict):
                if row.get(key) not in value["$in"]:
                    return False
            elif row.get(key) != value:
                return False
        return True

    def find(
        self,
        query,
    ):
        return [
            copy.deepcopy(row)
            for row in self.documents
            if self.matches(row, query)
        ]

    def find_one(
        self,
        query,
    ):
        return next(iter(self.find(query)), None)

    def count_documents(
        self,
        query,
    ):
        return len(self.find(query))

    def update_one(
        self,
        query,
        changes,
        *,
        upsert,
    ):
        existing = self.find_one(query)
        if existing is not None:
            return SimpleNamespace(upserted_id=None)
        self.exists = True
        document = copy.deepcopy(changes["$setOnInsert"])
        if self.find_one({"dedupe_key": document["dedupe_key"]}) is not None:
            raise AssertionError("A conflicting observation would violate the unique index.")
        document["_id"] = f"doc-{len(self.documents)}"
        self.documents.append(document)
        return SimpleNamespace(upserted_id=document["_id"])

    def delete_one(
        self,
        query,
    ):
        for index, row in enumerate(self.documents):
            if self.matches(row, query):
                self.documents.pop(index)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


@override_settings(
    DEBUG=True,
    MONGODB_URI="mongodb://127.0.0.1:27017",
    MONGODB_DATABASE="analytics_demo_test",
    MERCHANT_PLUS_ENFORCED=False,
)
class MerchantAnalyticsDemoSeedTests(TestCase):
    """Verify fixture ownership, restart boundaries and the real analytics service definitions."""

    NOW = datetime(2026, 10, 17, 4, 30, tzinfo=UTC)

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            email="seed-target-owner@example.com",
            password=None,
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Existing",
            USER_LNAME="Merchant",
        )
        cluster = Cluster.objects.create(CLUS_NAME="Seed target cluster")
        category = Category.objects.create(CTGRY_NAME="Seed target category", CLUS_ID=cluster)
        location = Location.objects.create(
            LOCT_POINT=Point(123.88, 10.31, srid=4326),
            LOCT_ADDRESS="Cebu City",
        )
        cls.business = Business.objects.create(
            USER_ID=cls.owner,
            CTGRY_ID=category,
            LOCT_ID=location,
            BUSN_NAME="Existing target",
            BUSN_CONTACT_NUMBER="09170000000",
            BUSN_POCKET_COUNT=17,
            BUSN_REVIEW_COUNT=18,
            BUSN_VOUCH_COUNT=19,
        )
        old = cls.NOW - timedelta(days=120)
        Business.objects.filter(pk=cls.business.pk).update(BUSN_CREATED_AT=old)
        for index in range(3):
            tag = SpecialtyTag.objects.create(TAG_NAME=f"Existing specialty {index}")
            link = BusinessSpecialtyTag.objects.create(
                BUSN_ID=cls.business,
                TAG_ID=tag,
                BST_VOUCH_COUNT=23,
            )
            BusinessSpecialtyTag.objects.filter(pk=link.pk).update(
                BST_CREATED_AT=old,
                BST_ACTIVATED_AT=old,
            )
        cls.other = User.objects.create_user(
            email="unrelated-real-explorer@example.com",
            password=None,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_FNAME="Other",
            USER_LNAME="Explorer",
        )
        cls.real_review = Review.objects.create(
            USER_ID=cls.other,
            BUSN_ID=cls.business,
            REVW_TEXT="Existing real feedback",
        )
        Review.objects.filter(pk=cls.real_review.pk).update(
            REVW_CREATED_AT=cls.NOW - timedelta(days=2),
        )

    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.mongo = MemoryCollection()
        mongo = patch(
            "apps.shared.services.mongodb_service.MongoDBService.get_database",
            return_value=self.mongo,
        )
        mongo.start()
        self.addCleanup(mongo.stop)
        clock = patch("django.utils.timezone.now", return_value=self.NOW)
        clock.start()
        self.addCleanup(clock.stop)
        environment = patch.dict(os.environ, {"SUGBOGO_ANALYTICS_DEMO_ALLOW": "local-development"})
        environment.start()
        self.addCleanup(environment.stop)
        self.journal = AnalyticsDemoManifest(self.directory.name, self.business.pk)
        self.mongo.documents.append({
            "event_type": "PROFILE_VISIT", "business_id": self.business.pk,
            "explorer_id": self.other.pk, "occurred_at": self.NOW - timedelta(days=1),
            "dedupe_key": "real-existing-event", "_id": "real",
        })
        self.mongo.exists = True

    def run_seed(
        self,
        **overrides,
    ):
        options = {
            "business_id": self.business.pk,
            "manifest_directory": self.directory.name,
            "confirm_postgres_database": connection.settings_dict["NAME"],
            "confirm_mongodb_database": "analytics_demo_test",
            "workers_stopped": True,
        }
        options.update(overrides)
        return Seeder.run(**options)

    def command(
        self,
        *arguments,
    ):
        output = StringIO()
        call_command("seed_merchant_analytics_demo", *arguments, stdout=output)
        return json.loads(output.getvalue())

    def test_business_identifier_is_mandatory_and_never_implicitly_selected(self):
        with self.assertRaises(CommandError):
            self.command()
        with self.assertRaises(CommandError):
            self.command("--business-id", "-1")

    def test_default_dry_run_writes_no_sql_mongo_manifest_or_indexes(self):
        before = User.objects.count(), Review.objects.count(), copy.deepcopy(self.mongo.documents)
        result = self.command(
            "--business-id",
            str(self.business.pk),
            "--manifest-directory",
            self.directory.name,
        )
        self.assertEqual(result["state"], "dry_run")
        self.assertEqual(result["planned_contribution"]["PROFILE_VISIT"], 165)
        self.assertEqual(result["planned_contribution"]["IMPRESSION"], 460)
        self.assertEqual(result["planned_contribution"]["SAVE"], 30)
        self.assertEqual(result["planned_contribution"]["reviews"], 30)
        self.assertEqual(result["planned_contribution"]["vouches"], 36)
        self.assertEqual(
            before,
            (User.objects.count(), Review.objects.count(), self.mongo.documents),
        )
        self.assertFalse(self.journal.path.exists())
        self.assertEqual(self.mongo.indexes, {})

    def test_debug_alone_never_authorizes_apply(self):
        with patch.dict(os.environ, {"SUGBOGO_ANALYTICS_DEMO_ALLOW": ""}):
            with self.assertRaises(PermissionDenied):
                self.run_seed(apply=True)
        self.assertFalse(self.journal.path.exists())

    @override_settings(DEBUG=False)
    def test_production_settings_refuse_even_dry_run(self):
        with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
            self.run_seed()

    @override_settings(MONGODB_URI="mongodb+srv://example.invalid")
    def test_remote_mongo_is_rejected_before_sql_or_mongo_access(self):
        with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
            self.run_seed(apply=True)

    @override_settings(MONGODB_URI="mongodb+srv://demo.example.invalid")
    def test_hosted_mongo_requires_opt_in_and_exact_database_even_for_dry_run(self):
        for options in (
            {},
            {"allow_remote_development_mongodb": True, "confirm_mongodb_database": None},
            {"allow_remote_development_mongodb": True, "confirm_mongodb_database": "wrong"},
        ):
            with self.subTest(options=options):
                with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                    self.run_seed(**options)
        self.assertFalse(self.journal.path.exists())

    @override_settings(MONGODB_URI="mongodb+srv://demo.example.invalid")
    def test_hosted_mongo_command_dry_run_is_read_only_and_reports_sanitized_identity(self):
        before = User.objects.count()
        result = self.command(
            "--business-id",
            str(self.business.pk),
            "--manifest-directory",
            self.directory.name,
            "--allow-remote-development-mongodb",
            "--confirm-mongodb-database",
            "analytics_demo_test",
        )
        self.assertEqual(result["state"], "dry_run")
        self.assertEqual(result["database_environment"]["mongodb"], {
            "scheme": "mongodb+srv",
            "host": "demo.example.invalid",
            "port": None,
            "database": "analytics_demo_test",
        })
        self.assertEqual(User.objects.count(), before)
        self.assertFalse(self.journal.path.exists())
        self.assertEqual(self.mongo.indexes, {})
        self.assertEqual(len(self.mongo.documents), 1)

    def test_explicit_hosted_development_apply_resume_and_cleanup(self):
        for uri in (
            "mongodb+srv://demo.example.invalid",
            "mongodb://demo.example.invalid:27018",
        ):
            with self.subTest(uri=uri), override_settings(MONGODB_URI=uri):
                first = self.run_seed(
                    apply=True,
                    allow_remote_development_mongodb=True,
                )
                self.assertEqual(first["mongo_inserted_this_run"], 655)
                second = self.run_seed(
                    apply=True,
                    allow_remote_development_mongodb=True,
                )
                self.assertEqual(second["mongo_inserted_this_run"], 0)
                result = self.run_seed(
                    apply=True,
                    cleanup=True,
                    confirm_cleanup=self.business.pk,
                    allow_remote_development_mongodb=True,
                )
                self.assertEqual(result["state"], "cleaned")
                self.assertEqual(len(self.mongo.documents), 1)

    @override_settings(MONGODB_URI="mongodb+srv://demo.example.invalid")
    def test_hosted_opt_in_does_not_bypass_write_or_postgres_guards(self):
        with patch.dict(os.environ, {"SUGBOGO_ANALYTICS_DEMO_ALLOW": ""}):
            with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                self.run_seed(apply=True, allow_remote_development_mongodb=True)
        with patch.object(
            connection,
            "get_connection_params",
            return_value={"host": "remote.invalid", "dbname": "development"},
        ):
            with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                self.run_seed(allow_remote_development_mongodb=True)
        with override_settings(MONGODB_DATABASE="sugbogo_production"):
            with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                self.run_seed(
                    allow_remote_development_mongodb=True,
                    confirm_mongodb_database="sugbogo_production",
                )

    def test_hosted_opt_in_rejects_malformed_or_unsupported_mongo_uris(self):
        for uri in (
            "https://demo.example.invalid",
            "mongodb+srv://",
            "mongodb+srv://demo.example.invalid:27017",
            "mongodb://first.example.invalid,second.example.invalid",
        ):
            with self.subTest(uri=uri), override_settings(MONGODB_URI=uri):
                with self.assertNumQueries(0), self.assertRaises(PermissionDenied):
                    self.run_seed(allow_remote_development_mongodb=True)

    def test_database_and_worker_confirmations_are_required(self):
        for changes in (
            {"confirm_postgres_database": "wrong"},
            {"confirm_mongodb_database": "wrong"},
            {"workers_stopped": False},
        ):
            with self.subTest(changes=changes), self.assertRaises(PermissionDenied):
                self.run_seed(apply=True, **changes)

    def test_sql_remote_or_production_name_is_rejected(self):
        for parameters in (
            {"host": "remote.invalid", "dbname": "development"},
            {"host": "localhost", "dbname": "sugbogo_production"},
            {"host": "localhost", "hostaddr": "203.0.113.5", "dbname": "development"},
        ):
            with self.subTest(parameters=parameters):
                with patch.object(connection, "get_connection_params", return_value=parameters):
                    with self.assertRaises(PermissionDenied):
                        self.run_seed()

    def test_inactive_business_or_wrong_owner_role_is_rejected(self):
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
        )
        with self.assertRaises(ValidationError):
            self.run_seed()
        Business.objects.filter(pk=self.business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
        )
        User.objects.filter(pk=self.owner.pk).update(USER_ROLE=User.UserRole.EXPLORER)
        with self.assertRaises(ValidationError):
            self.run_seed()

    def test_repeat_apply_creates_exactly_one_dataset_and_preserves_counters(self):
        first = self.run_seed(apply=True)
        counts = (
            User.objects.count(),
            Review.objects.count(),
            BusinessVouch.objects.count(),
            len(self.mongo.documents),
        )
        second = self.run_seed(apply=True)
        self.assertEqual(first["mongo_inserted_this_run"], 655)
        self.assertEqual(second["mongo_inserted_this_run"], 0)
        self.assertEqual(
            counts,
            (
                User.objects.count(),
                Review.objects.count(),
                BusinessVouch.objects.count(),
                len(self.mongo.documents),
            ),
        )
        self.business.refresh_from_db()
        self.assertEqual(
            (
                self.business.BUSN_POCKET_COUNT,
                self.business.BUSN_REVIEW_COUNT,
                self.business.BUSN_VOUCH_COUNT,
            ),
            (17, 18, 19),
        )
        self.assertTrue(
            all(
                link.BST_VOUCH_COUNT == 23
                for link in BusinessSpecialtyTag.objects.filter(BUSN_ID=self.business)
            ),
        )
        self.assertEqual(set(self.mongo.indexes), set(INDEXES))
        self.assertEqual(
            len({row["dedupe_key"] for row in self.mongo.documents}),
            len(self.mongo.documents),
        )

    def test_seed_accounts_have_unusable_passwords_and_no_owner_observations(self):
        self.run_seed(apply=True)
        data = self.journal.read()
        actors = Seeder.actors(data)
        self.assertEqual(len(actors), 48)
        self.assertNotIn(self.owner.pk, actors.values())
        self.assertTrue(
            all(
                not user.has_usable_password()
                for user in User.objects.filter(pk__in=actors.values())
            ),
        )

    def test_existing_reserved_identity_is_not_claimed(self):
        email = f"merchant-analytics-b{self.business.pk}-v1-e00@sugbogo.invalid"
        User.objects.create_user(
            email=email,
            password=None,
            USER_REPUTATION="0.20",
            USER_ROLE="explorer",
            USER_FNAME="Real",
            USER_LNAME="User",
        )
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True)
        self.assertFalse(self.journal.path.exists())

    def test_young_business_and_recent_specialties_omit_earlier_activity(self):
        created = self.NOW - timedelta(days=3)
        Business.objects.filter(pk=self.business.pk).update(BUSN_CREATED_AT=created)
        activated = self.NOW - timedelta(days=1)
        BusinessSpecialtyTag.objects.filter(BUSN_ID=self.business).update(
            BST_ACTIVATED_AT=activated,
        )
        self.run_seed(apply=True)
        plan = self.journal.read()["plan"]
        self.assertTrue(all(parse_timestamp(row["at"]) >= created for row in plan["events"]))
        self.assertTrue(all(parse_timestamp(row["at"]) >= activated for row in plan["vouches"]))
        self.assertLess(len(plan["reviews"]), 30)
        self.assertLess(len(plan["events"]), 655)

    def test_no_active_specialties_skips_vouches_without_adding_business_links(self):
        BusinessSpecialtyTag.objects.filter(BUSN_ID=self.business).update(BST_IS_ACTIVE=False)
        result = self.run_seed(apply=True)
        self.assertEqual(result["planned_contribution"]["vouches"], 0)
        self.assertEqual(BusinessSpecialtyTag.objects.filter(BUSN_ID=self.business).count(), 3)

    def test_first_store_commit_can_resume_after_journal_phase_write_failure(self):
        original = AnalyticsDemoManifest.write
        def fail_after_commit(
            journal,
            data,
        ):
            if data["phase"] == "sql_ready":
                raise OSError("Simulated interruption after relational commit")
            return original(journal, data)
        with patch.object(AnalyticsDemoManifest, "write", new=fail_after_commit):
            with self.assertRaises(OSError):
                self.run_seed(apply=True)
        self.assertEqual(self.journal.read()["phase"], "sql_commit_intent")
        before = Review.objects.count()
        result = self.run_seed(apply=True)
        self.assertEqual(result["state"], "complete")
        self.assertEqual(Review.objects.count(), before)

    def test_partial_mongo_write_can_resume_without_duplicate_observations(self):
        original = self.mongo.update_one
        calls = []
        def interrupt(
            query,
            changes,
            *,
            upsert,
        ):
            calls.append(1)
            if len(calls) == 8:
                raise OSError("Simulated interruption")
            return original(query, changes, upsert=upsert)
        with patch.object(self.mongo, "update_one", side_effect=interrupt):
            with self.assertRaises(OSError):
                self.run_seed(apply=True)
        self.assertEqual(self.journal.read()["phase"], "mongo_writing")
        sql_count = Review.objects.count()
        result = self.run_seed(apply=True)
        self.assertEqual(result["mongo_inserted_this_run"], 648)
        self.assertEqual(Review.objects.count(), sql_count)
        self.assertEqual(len(self.mongo.documents), 656)

    def test_rolled_back_sql_commit_intent_is_safely_replanned(self):
        original = AnalyticsDemoManifest.write

        def fail_before_commit(
            journal,
            data,
        ):
            original(journal, data)
            if data["phase"] == "sql_commit_intent":
                raise OSError("Simulated interruption before relational commit")

        before = User.objects.count()
        with patch.object(AnalyticsDemoManifest, "write", new=fail_before_commit):
            with self.assertRaises(OSError):
                self.run_seed(apply=True)
        self.assertEqual(User.objects.count(), before)
        self.assertEqual(self.journal.read()["phase"], "sql_commit_intent")
        result = self.run_seed(apply=True)
        self.assertEqual(result["state"], "complete")
        self.assertEqual(User.objects.count(), before + 48)

    def test_unreachable_mongo_stops_before_any_seed_write(self):
        before = User.objects.count()
        with patch(
            "apps.shared.services.mongodb_service.MongoDBService.get_database",
            side_effect=ServerSelectionTimeoutError("Unavailable"),
        ):
            with self.assertRaises(ServerSelectionTimeoutError):
                self.run_seed(apply=True)
        self.assertEqual(User.objects.count(), before)
        self.assertFalse(self.journal.path.exists())

    def test_conflicting_index_is_rejected_without_replacing_it(self):
        name = VisibilityEventService.DEDUPE_INDEX_NAME
        self.mongo.indexes[name] = {"key": [("business_id", 1)], "unique": False}
        before = copy.deepcopy(self.mongo.indexes)
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True)
        self.assertEqual(self.mongo.indexes, before)
        self.assertFalse(self.journal.path.exists())

    def test_changed_business_context_cannot_silently_shift_a_saved_plan(self):
        self.run_seed(apply=True)
        BusinessSpecialtyTag.objects.filter(BUSN_ID=self.business).update(
            BST_IS_ACTIVE=False,
        )
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True)
        result = self.run_seed(
            cleanup=True,
            apply=True,
            confirm_cleanup=self.business.pk,
        )
        self.assertEqual(result["state"], "cleaned")

    def test_cleanup_resumes_after_partial_mongo_deletion(self):
        self.run_seed(apply=True)
        original = self.mongo.delete_one
        deleted = []

        def interrupt(query):
            if len(deleted) == 5:
                raise OSError("Simulated cleanup interruption")
            deleted.append(1)
            return original(query)

        with patch.object(self.mongo, "delete_one", side_effect=interrupt):
            with self.assertRaises(OSError):
                self.run_seed(
                    cleanup=True,
                    apply=True,
                    confirm_cleanup=self.business.pk,
                )
        self.assertEqual(self.journal.read()["phase"], "cleanup")
        self.assertEqual(len(Seeder.verify_rows(self.journal.read())), 147)
        result = self.run_seed(
            cleanup=True,
            apply=True,
            confirm_cleanup=self.business.pk,
        )
        self.assertEqual(result["mongo_deleted_this_run"], 650)
        self.assertEqual(len(self.mongo.documents), 1)

    def test_cleanup_resumes_after_sql_deletion_before_receipt_archival(self):
        before = User.objects.count()
        self.run_seed(apply=True)
        with patch.object(
            AnalyticsDemoManifest,
            "archive",
            side_effect=OSError("Simulated receipt write failure"),
        ):
            with self.assertRaises(OSError):
                self.run_seed(
                    cleanup=True,
                    apply=True,
                    confirm_cleanup=self.business.pk,
                )
        self.assertEqual(User.objects.count(), before)
        result = self.run_seed(
            cleanup=True,
            apply=True,
            confirm_cleanup=self.business.pk,
        )
        self.assertEqual(result["state"], "cleaned")
        self.assertEqual(User.objects.count(), before)

    def test_cleanup_is_explicit_scoped_and_repeatable(self):
        before = User.objects.count(), Review.objects.count(), Business.objects.count()
        self.run_seed(apply=True)
        with self.assertRaises(PermissionDenied):
            self.run_seed(cleanup=True, apply=True)
        preview = self.run_seed(cleanup=True)
        self.assertEqual(preview["state"], "dry_run_cleanup")
        result = self.run_seed(cleanup=True, apply=True, confirm_cleanup=self.business.pk)
        self.assertEqual(result["state"], "cleaned")
        self.assertEqual(
            before,
            (User.objects.count(), Review.objects.count(), Business.objects.count()),
        )
        self.assertEqual([row["_id"] for row in self.mongo.documents], ["real"])
        self.assertTrue(Path(result["receipt"]).exists())
        self.assertFalse(self.journal.path.exists())
        self.assertEqual(
            self.run_seed(cleanup=True, apply=True, confirm_cleanup=self.business.pk)["state"],
            "nothing_to_clean",
        )
        self.assertEqual(set(self.mongo.indexes), set(INDEXES))

    def test_cleanup_refuses_edited_rows_or_additional_real_replies(self):
        self.run_seed(apply=True)
        seeded = Review.objects.exclude(pk=self.real_review.pk).first()
        Review.objects.filter(pk=seeded.pk).update(REVW_TEXT="Edited by an actual user")
        with self.assertRaises(ValidationError):
            self.run_seed(cleanup=True, apply=True, confirm_cleanup=self.business.pk)
        self.assertTrue(Review.objects.filter(pk=seeded.pk).exists())

    def test_cleanup_refuses_cascading_an_unowned_reply(self):
        self.run_seed(apply=True)
        review = Review.objects.exclude(pk=self.real_review.pk).filter(reply__isnull=True).first()
        reply = ReviewReply.objects.create(REVW_ID=review, RPLY_TEXT="Actual merchant reply")
        with self.assertRaises(ValidationError):
            self.run_seed(cleanup=True, apply=True, confirm_cleanup=self.business.pk)
        self.assertTrue(ReviewReply.objects.filter(pk=reply.pk).exists())

    def test_cleanup_refuses_an_unrelated_mongo_observation_from_a_demo_actor(self):
        self.run_seed(apply=True)
        actor = next(iter(Seeder.actors(self.journal.read()).values()))
        self.mongo.documents.append(
            {
                "event_type": "SAVE",
                "business_id": 9999,
                "explorer_id": actor,
                "occurred_at": self.NOW,
                "dedupe_key": "not-our-event",
            },
        )
        with self.assertRaises(ValidationError):
            self.run_seed(cleanup=True, apply=True, confirm_cleanup=self.business.pk)

    def test_tampered_manifest_is_never_trusted(self):
        self.run_seed(apply=True)
        wrapper = json.loads(self.journal.path.read_text())
        wrapper["data"]["context"]["business_id"] = 999
        self.journal.path.write_text(json.dumps(wrapper))
        with self.assertRaises(ValidationError):
            self.run_seed(cleanup=True, apply=True, confirm_cleanup=self.business.pk)

    def test_duplicate_or_edited_mongo_documents_are_not_silently_claimed(self):
        self.run_seed(apply=True)
        original = copy.deepcopy(self.mongo.documents[1])
        duplicate = {**original, "_id": "unexpected-duplicate"}
        self.mongo.documents.append(duplicate)
        with self.assertRaises(ValidationError):
            self.run_seed(
                cleanup=True,
                apply=True,
                confirm_cleanup=self.business.pk,
            )
        self.assertIn(duplicate, self.mongo.documents)
        self.mongo.documents.pop()
        self.mongo.documents[1]["event_type"] = "SAVE"
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True)
        self.assertTrue(User.objects.filter(
            pk=self.mongo.documents[1]["explorer_id"],
        ).exists())

    def test_real_standard_and_plus_services_read_the_seeded_records(self):
        self.run_seed(apply=True)
        with patch.object(VisibilityEventService, "_get_collection", return_value=self.mongo):
            with patch.object(
                VisibilityEventService,
                "ensure_indexes",
                side_effect=AssertionError("Analytics index write"),
            ):
                period = resolve_period(preset="90", now=self.NOW)
                standard = StandardAnalyticsService.get_report(self.owner, period)
                visibility = PremiumVisibilityService.get_report(self.owner, period)
                specialty = PremiumSpecialtyService.get_report(self.owner, period)
                reviews = PremiumReviewPerformanceService.get_report(self.owner, period)
                timing = EngagementHeatmapService.get_report(self.owner, period)
        self.assertEqual(standard["profile_visits"], 166)
        self.assertEqual(standard["saves_in_period"], 30)
        self.assertEqual(standard["current_pocket_holders"], 14)
        self.assertEqual(standard["reviews"]["new_published_in_period"], 31)
        self.assertEqual(standard["reviews"]["period_replied_published"], 19)
        self.assertEqual(visibility["metrics"]["impressions"]["value"], 460)
        self.assertIsNone(visibility["metrics"]["profile_visits"]["change"]["value"])
        self.assertEqual(sum(row["added_and_still_valid"] for row in specialty["specialties"]), 36)
        self.assertEqual(reviews["current"]["classified_review_count"], 27)
        self.assertEqual(timing["total_profile_visits"], 166)
        self.assertFalse(timing["sample"]["conclusions_available"])

    def test_no_workflow_tasks_notifications_or_reputation_are_invoked(self):
        with patch(
            "apps.reviews.tasks.process_review_sentiment.delay",
            side_effect=AssertionError("Task sent"),
        ):
            with patch(
                "apps.reviews.tasks.refresh_business_review_insights.delay",
                side_effect=AssertionError("Generation sent"),
            ):
                with patch(
                    "apps.business.services.pocket_service.PocketService.create_pocket",
                    side_effect=AssertionError("User workflow"),
                ):
                    with self.captureOnCommitCallbacks(execute=True) as callbacks:
                        self.run_seed(apply=True)
                        self.assertEqual(Notification.objects.count(), 0)
                        self.run_seed(
                            cleanup=True,
                            apply=True,
                            confirm_cleanup=self.business.pk,
                        )
                    self.assertEqual(callbacks, [])
        self.assertEqual(ReputationEvent.objects.count(), 0)
        self.assertEqual(BusinessReviewSummary.objects.count(), 0)
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(MerchantRecommendation.objects.count(), 0)

    def test_period_switching_preserves_snapshots_and_deterministic_findings(self):
        self.run_seed(apply=True)
        with patch.object(
            VisibilityEventService,
            "_get_collection",
            return_value=self.mongo,
        ):
            for preset, visits, saves in (("7", 30, 6), ("30", 85, 16), ("90", 165, 30)):
                period = resolve_period(preset=preset, now=self.NOW)
                standard = StandardAnalyticsService.get_report(self.owner, period)
                pocket = PremiumVisibilityService.get_report(
                    self.owner,
                    period,
                    pocket=True,
                )
                self.assertEqual(standard["profile_visits"], visits + 1)
                self.assertEqual(standard["current_pocket_holders"], 14)
                self.assertEqual(standard["saves_in_period"], saves)
                self.assertEqual(pocket["metrics"]["saves"]["value"], saves)
            recommendations = RecommendationService.read(self.owner, period)
        self.assertTrue(recommendations["key_findings"])
        self.assertEqual(recommendations["state"], "not_requested")
        self.assertEqual(recommendations["ai_recommendations"], [])
        self.assertEqual(MerchantRecommendation.objects.count(), 0)

    def test_dedupe_uses_utc_days_while_reporting_uses_manila_calendar_dates(self):
        one = datetime(2026, 10, 12, 17, tzinfo=UTC)
        two = datetime(2026, 10, 13, 1, tzinfo=UTC)
        self.assertNotEqual(
            observation_identity("PROFILE_VISIT", 1, one),
            observation_identity("PROFILE_VISIT", 1, two),
        )
        period = resolve_period(
            preset="custom",
            start_date="2026-10-13",
            end_date="2026-10-13",
            now=self.NOW,
        )
        self.assertEqual(period.start, datetime(2026, 10, 12, 16, tzinfo=UTC))
        context = Seeder.context(Seeder.target(self.business.pk))
        plan = build_dataset(context, self.NOW, "0.20")
        identities = [
            observation_identity(
                row["type"],
                row["actor"],
                parse_timestamp(row["at"]),
            )
            for row in plan["events"]
        ]
        self.assertEqual(len(identities), len(set(identities)))
