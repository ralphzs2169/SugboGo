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
from django.test.utils import CaptureQueriesContext
from pymongo.errors import ServerSelectionTimeoutError
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.admin_operations.system_configuration.services import DiscoveryAlgorithmConfigurationService
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
from apps.business.services.tests.discovery_source_fixtures import DiscoverySourceCollection
from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.business.services.discovery_source import DiscoverySource
from apps.business.services.visibility_event_service import VisibilityEventService
from apps.reviews.models import BusinessReviewSummary, Review, ReviewReply
from apps.notifications.models import Notification
from apps.users.models import ReputationEvent, User
from apps.shared.analytics.date_ranges import resolve_period

from ..analytics_demo_dataset import build_dataset, observation_identity, parse_timestamp
from ..analytics_demo_manifest import AnalyticsDemoManifest, row_snapshot
from ..analytics_demo_visibility import AnalyticsDemoVisibility, INDEXES
from ..engagement_heatmap_service import EngagementHeatmapService
from ..merchant_analytics_demo_seed_service import MerchantAnalyticsDemoSeedService as Seeder
from ..premium_review_performance_service import PremiumReviewPerformanceService
from ..premium_specialty_service import PremiumSpecialtyService
from ..premium_visibility_service import PremiumVisibilityService
from ..standard_analytics_service import StandardAnalyticsService
from ..recommendation_service import RecommendationService
from ..route_planning_analytics_service import RoutePlanningAnalyticsService
from ..discovery_sources_service import DiscoverySourcesService
from ...models import MerchantRecommendation


class MemoryCollection(DiscoverySourceCollection):
    """Extend the repository's pipeline test double with exact fixture write operations."""

    def __init__(self):
        super().__init__()
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
        if "partialFilterExpression" in options:
            self.indexes[options["name"]]["partialFilterExpression"] = options["partialFilterExpression"]

    @staticmethod
    def matches(
        row,
        query,
    ):
        for key, value in query.items():
            if isinstance(value, dict):
                if "$exists" in value:
                    if (key in row) != value["$exists"]:
                        return False
                elif row.get(key) not in value["$in"]:
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
            if "$set" in changes:
                for row in self.documents:
                    if self.matches(row, query):
                        row.update(changes["$set"])
                        return SimpleNamespace(upserted_id=None, modified_count=1)
            return SimpleNamespace(upserted_id=None, modified_count=0)
        if not upsert:
            return SimpleNamespace(upserted_id=None, modified_count=0)
        self.exists = True
        document = copy.deepcopy(changes["$setOnInsert"])
        if "dedupe_key" in document and self.find_one({"dedupe_key": document["dedupe_key"]}) is not None:
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

    def expression(
        self,
        row,
        expression,
    ):
        """Reuse the reporting-expression evaluators without changing write semantics."""
        if isinstance(expression, dict):
            if "$eq" in expression:
                left, right = expression["$eq"]
                return self.expression(row, left) == self.expression(row, right)
            if "$add" in expression:
                return sum(
                    self.expression(row, value)
                    for value in expression["$add"]
                )
        return super().expression(row, expression)

    def aggregate(
        self,
        pipeline,
    ):
        """Ignore the initialization singleton as Mongo's event match naturally does."""
        documents = self.documents
        self.documents = [
            row
            for row in documents
            if row.get("_id") != RoutePlanningEventService.STATE_ID
        ]
        try:
            if pipeline[-1] == {"$project": {"_id": 0}}:
                owner_id = pipeline[0]["$match"]["explorer_id"]["$ne"]
                self.documents = [
                    row
                    for row in self.documents
                    if row.get("explorer_id") != owner_id
                ]
                rows = list(super().aggregate(pipeline[:-1]))
                for row in rows:
                    row.pop("_id", None)
                return iter(rows)
            return super().aggregate(pipeline)
        finally:
            self.documents = documents


class MemoryDatabase:
    """Keep event collections and initialization metadata isolated in tests."""

    name = "analytics_demo_test"

    def __init__(
        self,
        visibility,
        routes,
    ):
        self.collections = {
            VisibilityEventService.COLLECTION_NAME: visibility,
            RoutePlanningEventService.COLLECTION_NAME: routes,
        }
        for collection in self.collections.values():
            collection.database = self

    def __getitem__(
        self,
        name,
    ):
        return self.collections[name]

    def list_collection_names(
        self,
        **options,
    ):
        return [
            name
            for name, collection in self.collections.items()
            if collection.exists
        ]


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
        self.routes = MemoryCollection()
        self.database = MemoryDatabase(self.mongo, self.routes)
        mongo = patch(
            "apps.shared.services.mongodb_service.MongoDBService.get_database",
            return_value=self.database,
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

    def initialize_routes(
        self,
        started_at,
    ):
        self.routes.exists = True
        self.routes.documents.append({
            "_id": RoutePlanningEventService.STATE_ID,
            "started_at": started_at,
        })

    def seed_previous_version(self):
        """Build the original signed v1 SQL/visibility fixture without modern upgrade execution."""
        context = Seeder.context(Seeder.target(self.business.pk))
        configuration = DiscoveryAlgorithmConfigurationService.require_complete_reputation_configuration()
        plan = build_dataset(
            context,
            self.NOW,
            configuration.DAC_REPUTATION_BASELINE,
        )
        for event in plan["events"]:
            event.pop("discovery_source", None)
        data = {
            "version": 1,
            "identity": Seeder.environment(
                apply=True,
                confirm_postgres_database=connection.settings_dict["NAME"],
                confirm_mongodb_database="analytics_demo_test",
                workers_stopped=True,
            ),
            "context": context,
            "phase": "planned",
            "rows": [],
            "plan": plan,
            "counter_adjustments": {},
        }
        self.journal.write(data)
        Seeder.create_sql(data, self.journal)
        AnalyticsDemoVisibility().apply(
            Seeder.documents(data),
            list(Seeder.actors(data).values()),
        )
        data["phase"] = "complete"
        self.journal.write(data)
        return data

    def existing_analytics_reports(self):
        """Capture prior Standard/Core Plus metrics at fixed reporting cutoffs."""
        reports = {}
        for days in ("7", "30", "90"):
            period = resolve_period(
                preset=days,
                now=self.NOW,
            )
            reports[days] = {
                "standard": StandardAnalyticsService.get_report(self.owner, period),
                "visibility": PremiumVisibilityService.get_report(self.owner, period),
                "specialties": PremiumSpecialtyService.get_report(self.owner, period),
                "reviews": PremiumReviewPerformanceService.get_report(self.owner, period),
            }
        return reports

    def completed_with_sentiment_drift(self):
        """Reproduce normal enrichment of two unclassified reviews in a legacy completed seed."""
        data = self.seed_previous_version()
        unclassified = [
            item["key"]
            for item in data["plan"]["reviews"]
            if item["sentiment"] is None
        ][:2]
        changed = [
            row["id"]
            for row in data["rows"]
            if row["key"] in unclassified
        ]
        self.assertEqual(len(changed), 2)
        Review.objects.filter(pk__in=changed).update(
            REVW_SENTIMENT_LABEL="neutral",
            REVW_SENTIMENT_SCORE=0.004,
            REVW_UPDATED_AT=self.NOW + timedelta(seconds=2),
        )
        self.initialize_routes(self.NOW - timedelta(days=100))
        return data, changed

    def test_completed_review_drift_allows_only_mongodb_extension_and_idempotent_repeats(self):
        data, changed = self.completed_with_sentiment_drift()
        original_rows = copy.deepcopy(data["rows"])
        original_plan = copy.deepcopy(data["plan"])
        models = (User, Review, ReviewReply, BusinessPocket, BusinessVouch)
        snapshots = {
            model: list(model.objects.order_by("pk").values())
            for model in models
        }
        state = copy.deepcopy(self.routes.documents[0])
        for iteration in (1, 2, 3):
            with self.subTest(iteration=iteration):
                with patch.object(
                    Seeder,
                    "resume_sql",
                    side_effect=AssertionError("Completed extensions cannot enter SQL recovery"),
                ), CaptureQueriesContext(connection) as queries:
                    result = self.run_seed(apply=True)
                self.assertFalse(
                    any(
                        query["sql"].lstrip().upper().startswith(
                            ("INSERT", "UPDATE", "DELETE"),
                        )
                        for query in queries
                    ),
                )
                self.assertEqual(result["execution_mode"], "mongodb_extension")
                self.assertEqual(
                    {
                        row["id"]
                        for row in result["sql_drift"]
                    },
                    set(changed),
                )
                self.assertEqual(result["mongo_inserted_this_run"], 0)
                self.assertEqual(
                    result["profile_sources_updated_this_run"],
                    165 if iteration == 1 else 0,
                )
                self.assertEqual(
                    result["route_mongo_inserted_this_run"],
                    92 if iteration == 1 else 0,
                )
                self.assertEqual(result["extension_phase"], "complete")
                self.assertEqual(self.journal.read()["rows"], original_rows)
                self.assertEqual(self.journal.read()["plan"], original_plan)
                self.assertEqual(self.journal.read()["phase"], "complete")
                for model in models:
                    self.assertEqual(
                        list(model.objects.order_by("pk").values()),
                        snapshots[model],
                    )
                self.assertEqual(self.routes.documents[0], state)
        report = DiscoverySourcesService.get_report(
            self.owner,
            resolve_period(preset="90", now=self.NOW),
        )
        self.assertEqual(
            sum(
                row["count"]
                for row in report["sources"]
            ),
            report["profile_visits"],
        )
        self.assertEqual(report["profile_visits"], 166)
        with self.assertRaisesMessage(ValidationError, "was edited"):
            self.run_seed(
                cleanup=True,
                apply=True,
                confirm_cleanup=self.business.pk,
            )

    def test_pending_extension_plan_and_dry_run_preserve_manifest_and_all_data(self):
        data, changed = self.completed_with_sentiment_drift()
        Seeder.extend_plan(
            data,
            {
                "tracking_started_at": (self.NOW - timedelta(days=100)).isoformat(),
            },
        )
        data["reporting_extension"]["route_plan"]["events"] = (
            data["reporting_extension"]["route_plan"]["events"][:3]
        )
        self.journal.write(data)
        original = self.journal.path.read_bytes()
        documents = copy.deepcopy(self.mongo.documents)
        routes = copy.deepcopy(self.routes.documents)
        with CaptureQueriesContext(connection) as queries:
            preview = self.run_seed()
        self.assertEqual(preview["extension_phase"], "planned")
        self.assertEqual(len(preview["sql_drift"]), len(changed))
        self.assertEqual(self.journal.path.read_bytes(), original)
        self.assertEqual(self.mongo.documents, documents)
        self.assertEqual(self.routes.documents, routes)
        self.assertFalse(
            any(
                query["sql"].lstrip().upper().startswith(
                    ("INSERT", "UPDATE", "DELETE"),
                )
                for query in queries
            ),
        )
        pending = copy.deepcopy(data["reporting_extension"]["route_plan"])
        with patch(
            "django.utils.timezone.now",
            return_value=self.NOW + timedelta(days=1),
        ):
            applied = self.run_seed(apply=True)
        self.assertEqual(applied["route_mongo_inserted_this_run"], 3)
        self.assertEqual(
            self.journal.read()["reporting_extension"]["route_plan"],
            pending,
        )

    def test_completed_extension_interruption_keeps_original_completion_and_resumes(self):
        data, _ = self.completed_with_sentiment_drift()
        original = self.routes.update_one
        writes = []

        def interrupt(
            *args,
            **kwargs,
        ):
            if len(writes) == 3:
                raise ServerSelectionTimeoutError("Isolated extension interruption")
            writes.append(1)
            return original(*args, **kwargs)

        with patch.object(self.routes, "update_one", side_effect=interrupt):
            with self.assertRaises(ServerSelectionTimeoutError):
                self.run_seed(apply=True)
        pending = self.journal.read()
        self.assertEqual(pending["phase"], "complete")
        self.assertEqual(pending["reporting_extension"]["phase"], "applying")
        self.assertEqual(pending["rows"], data["rows"])
        result = self.run_seed(apply=True)
        self.assertEqual(result["route_mongo_inserted_this_run"], 89)
        self.assertEqual(result["extension_phase"], "complete")
        self.assertEqual(
            self.journal.read()["reporting_extension"]["route_plan"],
            pending["reporting_extension"]["route_plan"],
        )

    def test_initial_sql_recovery_remains_strict_despite_extension_metadata(self):
        data, _ = self.completed_with_sentiment_drift()
        for phase in ("sql_commit_intent", "sql_ready", "mongo_writing"):
            with self.subTest(phase=phase):
                data["phase"] = phase
                data["reporting_extension"] = {
                    "version": 1,
                    "preserve_existing_visibility": False,
                    "legacy_visibility": True,
                    "route_plan": None,
                }
                self.journal.write(data)
                documents = copy.deepcopy(self.mongo.documents)
                with self.assertRaisesMessage(ValidationError, "was edited"):
                    self.run_seed(apply=True)
                self.assertEqual(self.mongo.documents, documents)

    def test_completed_extension_refuses_modified_explorer_before_manifest_or_mongo_writes(self):
        data, _ = self.completed_with_sentiment_drift()
        actor = next(iter(Seeder.actors(data).values()))
        User.objects.filter(pk=actor).update(USER_FNAME="Changed demo account")
        original = self.journal.path.read_bytes()
        documents = copy.deepcopy(self.mongo.documents)
        with self.assertRaisesMessage(ValidationError, "Explorer account was edited"):
            self.run_seed(apply=True)
        self.assertEqual(self.journal.path.read_bytes(), original)
        self.assertEqual(self.mongo.documents, documents)

    def test_completed_extension_requires_all_original_sql_records(self):
        data, _ = self.completed_with_sentiment_drift()
        pocket = next(
            row
            for row in data["rows"]
            if row["model"] == "business.businesspocket"
        )
        BusinessPocket.objects.filter(pk=pocket["id"]).delete()
        with self.assertRaisesMessage(ValidationError, "record is missing"):
            self.run_seed(apply=True)

    def test_completed_extension_refuses_changed_fixture_identity(self):
        _, changed = self.completed_with_sentiment_drift()
        Review.objects.filter(pk=changed[0]).update(REVW_CREATED_AT=self.NOW)
        with self.assertRaisesMessage(
            ValidationError,
            "relationship or creation timestamp changed",
        ):
            self.run_seed(apply=True)

    def test_completed_extension_refuses_incomplete_signed_sql_inventory(self):
        data, _ = self.completed_with_sentiment_drift()
        data["rows"] = data["rows"][:-1]
        self.journal.write(data)
        with self.assertRaisesMessage(ValidationError, "full signed dataset"):
            self.run_seed(apply=True)

    def test_older_interrupted_completed_extension_can_resume_with_review_drift(self):
        data, _ = self.completed_with_sentiment_drift()
        Seeder.extend_plan(
            data,
            {
                "tracking_started_at": (self.NOW - timedelta(days=100)).isoformat(),
            },
        )
        data["phase"] = "mongo_writing"
        data["reporting_extension"].pop("phase")
        self.journal.write(data)
        result = self.run_seed(apply=True)
        self.assertEqual(result["execution_mode"], "mongodb_extension")
        self.assertEqual(self.journal.read()["phase"], "complete")
        self.assertEqual(result["extension_phase"], "complete")

    def test_completed_extension_does_not_relax_mongodb_ownership(self):
        self.completed_with_sentiment_drift()
        self.mongo.documents[1]["occurred_at"] += timedelta(hours=1)
        documents = copy.deepcopy(self.mongo.documents)
        with self.assertRaisesMessage(ValidationError, "edited or unrelated analytics"):
            self.run_seed(apply=True)
        self.assertEqual(self.mongo.documents, documents)
        self.assertEqual(len(self.routes.documents), 1)

    def test_completed_extension_refuses_tampered_signature(self):
        self.completed_with_sentiment_drift()
        wrapper = json.loads(self.journal.path.read_text())
        wrapper["data"]["phase"] = "sql_ready"
        self.journal.path.write_text(json.dumps(wrapper))
        documents = copy.deepcopy(self.mongo.documents)
        with self.assertRaisesMessage(ValidationError, "signature is invalid"):
            self.run_seed(apply=True)
        self.assertEqual(self.mongo.documents, documents)

    def test_completed_extension_refuses_other_business_or_database_manifest(self):
        data, _ = self.completed_with_sentiment_drift()
        for mismatch in ("business", "environment"):
            with self.subTest(mismatch=mismatch):
                changed = copy.deepcopy(data)
                if mismatch == "business":
                    changed["context"]["business_id"] = self.business.pk + 100
                else:
                    changed["identity"]["mongodb"]["database"] = "another_development_database"
                self.journal.write(changed)
                documents = copy.deepcopy(self.mongo.documents)
                with self.assertRaisesMessage(
                    ValidationError,
                    "another version, database environment or business",
                ):
                    self.run_seed(apply=True)
                self.assertEqual(self.mongo.documents, documents)

    def test_completed_extension_context_change_is_still_rejected(self):
        self.completed_with_sentiment_drift()
        link = BusinessSpecialtyTag.objects.filter(BUSN_ID=self.business).first()
        BusinessSpecialtyTag.objects.filter(pk=link.pk).update(BST_IS_ACTIVE=False)
        with self.assertRaisesMessage(ValidationError, "ownership, lifetime or specialties changed"):
            self.run_seed(apply=True)

    def test_previous_version_incremental_upgrade_preserves_metrics_through_three_runs_and_cleanup(self):
        legacy = self.seed_previous_version()
        self.assertNotIn("reporting_extension", self.journal.read())
        self.assertEqual(len(legacy["plan"]["events"]), 655)
        self.assertTrue(all(
            "discovery_source" not in row
            for row in self.mongo.documents
        ))
        original_rows = copy.deepcopy(legacy["rows"])
        original_plan = copy.deepcopy(legacy["plan"])
        original_documents = copy.deepcopy(self.mongo.documents)
        original_metrics = self.existing_analytics_reports()
        sql_counts = {
            model: model.objects.count()
            for model in (User, Review, ReviewReply, BusinessPocket, BusinessVouch)
        }
        self.initialize_routes(self.NOW - timedelta(days=100))
        state = copy.deepcopy(self.routes.documents[0])
        upgraded_routes = None
        for run_number in (1, 2, 3):
            with self.subTest(run=run_number):
                with patch.object(
                    Seeder,
                    "create_sql",
                    side_effect=AssertionError("Previously seeded SQL must not be recreated"),
                ), patch(
                    "apps.merchant_operations.merchant_analytics.services."
                    "merchant_analytics_demo_seed_service.build_dataset",
                    side_effect=AssertionError("Previously seeded activity must not be regenerated"),
                ):
                    result = self.run_seed(apply=True)
                self.assertEqual(result["mongo_inserted_this_run"], 0)
                self.assertEqual(
                    result["profile_sources_updated_this_run"],
                    165 if run_number == 1 else 0,
                )
                self.assertEqual(
                    result["route_mongo_inserted_this_run"],
                    92 if run_number == 1 else 0,
                )
                saved = self.journal.read()
                self.assertEqual(saved["rows"], original_rows)
                self.assertEqual(saved["plan"], original_plan)
                self.assertEqual(
                    [row_snapshot(record) for record in Seeder.verify_rows(saved)],
                    [
                        {
                            key: row[key]
                            for key in ("model", "id", "fingerprint")
                        }
                        for row in original_rows
                    ],
                )
                self.assertEqual(self.existing_analytics_reports(), original_metrics)
                for model, count in sql_counts.items():
                    self.assertEqual(model.objects.count(), count)
                self.assertEqual(
                    [
                        {
                            key: value
                            for key, value in document.items()
                            if key != "discovery_source"
                        }
                        for document in self.mongo.documents
                    ],
                    original_documents,
                )
                self.assertEqual(self.mongo.documents[0], original_documents[0])
                for days in ("7", "30", "90"):
                    period = resolve_period(preset=days, now=self.NOW)
                    sources = DiscoverySourcesService.get_report(self.owner, period)
                    self.assertEqual(
                        sources["profile_visits"],
                        original_metrics[days]["standard"]["profile_visits"],
                    )
                    self.assertEqual(
                        sum(row["count"] for row in sources["sources"]),
                        sources["profile_visits"],
                    )
                seeded_visits = [
                    document
                    for document in Seeder.documents(saved)
                    if document["event_type"] == "PROFILE_VISIT"
                ]
                self.assertEqual(len(seeded_visits), 165)
                self.assertEqual(
                    sum(result["seeded_contribution"]["discovery_sources"].values()),
                    len(seeded_visits),
                )
                if upgraded_routes is None:
                    upgraded_routes = copy.deepcopy(self.routes.documents)
                else:
                    self.assertEqual(self.routes.documents, upgraded_routes)
                self.assertEqual(self.routes.documents[0], state)
        cleaned = self.run_seed(
            apply=True,
            cleanup=True,
            confirm_cleanup=self.business.pk,
        )
        self.assertEqual(cleaned["mongo_deleted_this_run"], 655)
        self.assertEqual(cleaned["route_mongo_deleted_this_run"], 92)
        self.assertEqual(self.routes.documents, [state])
        self.assertEqual(self.mongo.documents, [original_documents[0]])
        self.assertTrue(Review.objects.filter(pk=self.real_review.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.other.pk).exists())

    def test_previous_version_without_manifest_refuses_to_guess_ownership(self):
        self.seed_previous_version()
        documents = copy.deepcopy(self.mongo.documents)
        counts = {
            model: model.objects.count()
            for model in (User, Review, ReviewReply, BusinessPocket, BusinessVouch)
        }
        self.journal.path.unlink()
        with self.assertRaisesMessage(ValidationError, "Reserved demo emails"):
            self.run_seed(apply=True)
        self.assertEqual(self.mongo.documents, documents)
        self.assertFalse(self.journal.path.exists())
        self.assertEqual(self.routes.documents, [])
        for model, count in counts.items():
            self.assertEqual(model.objects.count(), count)

    def test_previous_version_missing_completed_observation_is_not_regenerated(self):
        self.seed_previous_version()
        original = copy.deepcopy(self.mongo.documents)
        for event_type in ("IMPRESSION", "PROFILE_VISIT", "SAVE"):
            with self.subTest(event_type=event_type):
                self.mongo.documents = copy.deepcopy(original)
                missing = next(
                    row
                    for row in self.mongo.documents
                    if row["event_type"] == event_type and row.get("_id") != "real"
                )
                self.mongo.documents.remove(missing)
                documents = copy.deepcopy(self.mongo.documents)
                metrics = self.existing_analytics_reports()
                with self.assertRaisesMessage(ValidationError, "missing"):
                    self.run_seed(apply=True)
                self.assertEqual(self.mongo.documents, documents)
                self.assertEqual(self.existing_analytics_reports(), metrics)

    def test_source_distribution_matches_existing_profile_counts_in_all_periods(self):
        result = self.run_seed(apply=True)
        distribution = result["seeded_contribution"]["discovery_sources"]
        self.assertEqual(set(distribution), {source.value for source in DiscoverySource})
        self.assertEqual(sum(distribution.values()), 165)
        for days in ("7", "30", "90"):
            period = resolve_period(preset=days, now=self.NOW)
            standard = StandardAnalyticsService.get_report(self.owner, period)
            sources = DiscoverySourcesService.get_report(self.owner, period)
            self.assertEqual(sources["profile_visits"], standard["profile_visits"])
            self.assertEqual(sum(row["count"] for row in sources["sources"]), sources["profile_visits"])
            self.assertFalse(sources["meta"]["coverage_verified"])
        self.assertNotIn("discovery_source", self.mongo.documents[0])

    def test_legacy_visits_are_enriched_only_after_signed_ownership_verification(self):
        self.run_seed(apply=True)
        data = self.journal.read()
        actors = set(Seeder.actors(data).values())
        data.pop("reporting_extension")
        for event in data["plan"]["events"]:
            event.pop("discovery_source", None)
        for document in self.mongo.documents:
            if document["explorer_id"] in actors:
                document.pop("discovery_source", None)
        self.journal.write(data)
        before = copy.deepcopy(self.mongo.documents)
        self.run_seed()
        self.assertEqual(self.mongo.documents, before)
        self.assertNotIn("reporting_extension", self.journal.read())
        result = self.run_seed(apply=True)
        self.assertEqual(result["profile_sources_updated_this_run"], 165)
        self.assertEqual(result["mongo_inserted_this_run"], 0)
        self.assertEqual(self.mongo.documents[0], before[0])
        self.assertEqual(len(self.mongo.documents), len(before))
        self.assertEqual(self.run_seed(apply=True)["profile_sources_updated_this_run"], 0)

    def test_initialized_routes_keep_method_deduplication_distinct_accounts_and_coverage(self):
        started_at = self.NOW - timedelta(days=100)
        self.initialize_routes(started_at)
        first = self.run_seed(apply=True)
        plan = self.journal.read()
        documents = Seeder.route_documents(plan)
        self.assertEqual(first["route_mongo_inserted_this_run"], 92)
        identities = {
            (row["explorer_id"], row["business_id"], row["navigation_method"], row["utc_day"])
            for row in documents
        }
        self.assertEqual(len(identities), len(documents))
        self.assertEqual({row["navigation_method"] for row in documents}, {"ROAD_ROUTE", "JEEPNEY"})
        self.assertNotIn(self.owner.pk, {row["explorer_id"] for row in documents})
        for row in documents:
            self.assertEqual(row["utc_day"], row["occurred_at"].astimezone(UTC).date().isoformat())
            self.assertGreaterEqual(row["occurred_at"], started_at)
            self.assertLess(row["occurred_at"], self.NOW)
        for days in ("7", "30", "90"):
            period = resolve_period(preset=days, now=self.NOW)
            report = RoutePlanningAnalyticsService.get_report(self.owner, period)
            matching = [row for row in documents if period.start <= row["occurred_at"] < period.end]
            self.assertEqual(report["total_requests"], len(matching))
            self.assertEqual(report["road_route_requests"] + report["jeepney_requests"], len(matching))
            self.assertEqual(
                report["distinct_explorer_accounts"],
                len({row["explorer_id"] for row in matching}),
            )
            self.assertFalse(report["meta"]["coverage_verified"])
        self.assertEqual(self.run_seed(apply=True)["route_mongo_inserted_this_run"], 0)
        self.assertEqual(self.routes.documents[0]["started_at"], started_at)

    def test_recent_initialization_never_fabricates_older_activity(self):
        started_at = self.NOW - timedelta(seconds=30)
        self.initialize_routes(started_at)
        self.run_seed(apply=True)
        documents = Seeder.route_documents(self.journal.read())
        self.assertEqual(len(documents), 2)
        self.assertTrue(all(row["occurred_at"] >= started_at for row in documents))
        report = RoutePlanningAnalyticsService.get_report(
            self.owner,
            resolve_period(preset="90", now=self.NOW),
        )
        self.assertEqual(report["total_requests"], 2)
        self.assertEqual(report["distinct_explorer_accounts"], 1)
        self.assertIn("tracking_started_during_period", report["meta"]["partial_reasons"])
        self.assertFalse(report["meta"]["coverage_verified"])

    def test_missing_initialization_can_be_added_later_without_reseeding_visibility(self):
        first = self.run_seed(apply=True)
        anchor = first["anchor"]
        self.assertEqual(first["route_mongo_inserted_this_run"], 0)
        self.assertEqual(self.routes.documents, [])
        self.assertEqual(self.routes.indexes, {})
        self.initialize_routes(self.NOW - timedelta(seconds=30))
        second = self.run_seed(apply=True)
        self.assertEqual(second["anchor"], anchor)
        self.assertEqual(second["mongo_inserted_this_run"], 0)
        self.assertEqual(second["route_mongo_inserted_this_run"], 2)

    def test_partial_route_writes_resume_without_duplicate_events(self):
        self.initialize_routes(self.NOW - timedelta(days=100))
        original = self.routes.update_one
        calls = []

        def interrupted(
            *args,
            **kwargs,
        ):
            if len(calls) == 7:
                raise ServerSelectionTimeoutError("Isolated interruption")
            calls.append(1)
            return original(*args, **kwargs)

        with patch.object(self.routes, "update_one", side_effect=interrupted):
            with self.assertRaises(ServerSelectionTimeoutError):
                self.run_seed(apply=True)
        self.assertEqual(self.journal.read()["phase"], "mongo_writing")
        resumed = self.run_seed(apply=True)
        self.assertEqual(resumed["route_mongo_inserted_this_run"], 85)
        self.assertEqual(resumed["mongo_inserted_this_run"], 0)

    def test_cleanup_preserves_real_routes_metadata_and_indexes(self):
        started_at = self.NOW - timedelta(days=100)
        self.initialize_routes(started_at)
        real = {
            "business_id": self.business.pk,
            "explorer_id": self.other.pk,
            "navigation_method": "ROAD_ROUTE",
            "utc_day": self.NOW.date().isoformat(),
            "occurred_at": self.NOW - timedelta(minutes=1),
        }
        self.routes.documents.append(copy.deepcopy(real))
        self.run_seed(apply=True)
        indexes = copy.deepcopy(self.routes.indexes)
        cleaned = self.run_seed(apply=True, cleanup=True, confirm_cleanup=self.business.pk)
        self.assertEqual(cleaned["route_mongo_deleted_this_run"], 92)
        self.assertEqual(self.routes.documents, [
            {"_id": RoutePlanningEventService.STATE_ID, "started_at": started_at},
            real,
        ])
        self.assertEqual(self.routes.indexes, indexes)
        self.assertTrue(User.objects.filter(pk=self.other.pk).exists())

    def test_altered_tracking_start_is_not_reset_or_silently_replanned(self):
        self.initialize_routes(self.NOW - timedelta(days=100))
        self.run_seed(apply=True)
        changed = self.NOW - timedelta(days=1)
        self.routes.documents[0]["started_at"] = changed
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True)
        self.assertEqual(self.routes.documents[0]["started_at"], changed)

    def test_foreign_route_activity_using_demo_actors_blocks_cleanup(self):
        self.initialize_routes(self.NOW - timedelta(days=100))
        self.run_seed(apply=True)
        actor = next(iter(Seeder.actors(self.journal.read()).values()))
        self.routes.documents.append({
            "explorer_id": actor,
            "business_id": self.business.pk + 999,
            "navigation_method": "ROAD_ROUTE",
            "utc_day": self.NOW.date().isoformat(),
            "occurred_at": self.NOW,
        })
        before = copy.deepcopy(self.routes.documents)
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True, cleanup=True, confirm_cleanup=self.business.pk)
        self.assertEqual(self.routes.documents, before)

    def test_future_tracking_boundary_does_not_create_observations(self):
        future = self.NOW + timedelta(days=1)
        self.initialize_routes(future)
        result = self.run_seed(apply=True)
        self.assertEqual(result["route_mongo_inserted_this_run"], 0)
        self.assertEqual(len(self.routes.documents), 1)
        report = RoutePlanningAnalyticsService.get_report(
            self.owner,
            resolve_period(preset="30", now=self.NOW),
        )
        self.assertIsNone(report["total_requests"])
        self.assertIn("tracking_not_started_in_period", report["meta"]["partial_reasons"])

    def test_partial_legacy_attribution_is_resumable_and_cleans_both_shapes(self):
        self.run_seed(apply=True)
        data = self.journal.read()
        actors = set(Seeder.actors(data).values())
        data.pop("reporting_extension")
        for event in data["plan"]["events"]:
            event.pop("discovery_source", None)
        for document in self.mongo.documents:
            if document["explorer_id"] in actors:
                document.pop("discovery_source", None)
        self.journal.write(data)
        original = self.mongo.update_one
        updated = []

        def interrupt_attribution(
            *args,
            **kwargs,
        ):
            if "$set" in args[1]:
                if len(updated) == 5:
                    raise ServerSelectionTimeoutError("Isolated attribution interruption")
                updated.append(1)
            return original(*args, **kwargs)

        with patch.object(self.mongo, "update_one", side_effect=interrupt_attribution):
            with self.assertRaises(ServerSelectionTimeoutError):
                self.run_seed(apply=True)
        result = self.run_seed(apply=True)
        self.assertEqual(result["profile_sources_updated_this_run"], 160)
        self.assertEqual(result["mongo_inserted_this_run"], 0)
        self.run_seed(apply=True, cleanup=True, confirm_cleanup=self.business.pk)
        self.assertEqual(len(self.mongo.documents), 1)
        self.assertEqual(self.mongo.documents[0]["_id"], "real")

    def test_partial_route_cleanup_preserves_metadata_and_resumes(self):
        started_at = self.NOW - timedelta(days=100)
        self.initialize_routes(started_at)
        self.run_seed(apply=True)
        original = self.routes.delete_one
        deleted = []

        def interrupt_cleanup(
            *args,
            **kwargs,
        ):
            if len(deleted) == 3:
                raise ServerSelectionTimeoutError("Isolated cleanup interruption")
            deleted.append(1)
            return original(*args, **kwargs)

        with patch.object(self.routes, "delete_one", side_effect=interrupt_cleanup):
            with self.assertRaises(ServerSelectionTimeoutError):
                self.run_seed(apply=True, cleanup=True, confirm_cleanup=self.business.pk)
        self.assertEqual(self.journal.read()["phase"], "cleanup")
        self.assertEqual(len(Seeder.verify_rows(self.journal.read())), 147)
        result = self.run_seed(apply=True, cleanup=True, confirm_cleanup=self.business.pk)
        self.assertEqual(result["route_mongo_deleted_this_run"], 89)
        self.assertEqual(self.routes.documents, [
            {"_id": RoutePlanningEventService.STATE_ID, "started_at": started_at},
        ])

    def test_new_routes_have_bson_millisecond_precision(self):
        self.initialize_routes(self.NOW - timedelta(microseconds=456789))
        self.run_seed(apply=True)
        for document in Seeder.route_documents(self.journal.read()):
            self.assertEqual(document["occurred_at"].microsecond % 1000, 0)

    def test_legacy_attribution_refuses_edited_seed_observations(self):
        self.run_seed(apply=True)
        data = self.journal.read()
        data.pop("reporting_extension")
        for event in data["plan"]["events"]:
            event.pop("discovery_source", None)
        actor_ids = set(Seeder.actors(data).values())
        for document in self.mongo.documents:
            if document["explorer_id"] in actor_ids:
                document.pop("discovery_source", None)
        owned = next(
            document
            for document in self.mongo.documents
            if document["event_type"] == "PROFILE_VISIT" and document["explorer_id"] in actor_ids
        )
        owned["occurred_at"] += timedelta(minutes=1)
        self.journal.write(data)
        before = copy.deepcopy(self.mongo.documents)
        with self.assertRaises(ValidationError):
            self.run_seed(apply=True)
        self.assertEqual(self.mongo.documents, before)

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
