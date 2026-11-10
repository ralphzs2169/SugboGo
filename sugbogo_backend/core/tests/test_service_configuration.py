"""Validate deployable service configuration without opening service connections."""

import os
from pathlib import Path
import runpy
import ssl
from tempfile import TemporaryDirectory
from unittest.mock import patch

from celery.beat import PersistentScheduler
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key
from django.test import SimpleTestCase, override_settings
from kombu import Connection
from pymongo.errors import ConnectionFailure
from redis.asyncio import ConnectionPool

from apps.business.services.route_planning_event_service import (
    RoutePlanningEventService,
    RoutePlanningUnavailable,
)
from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)
from apps.shared.services.mongodb_service import MongoDBService
from config import celery_app


SETTINGS_FILE = Path(__file__).resolve().parents[2] / "config" / "settings.py"


class ServiceConfigurationTests(SimpleTestCase):
    """Exercise the existing settings file with isolated configuration fixtures."""

    def load_settings(
        self,
        overrides=None,
    ):
        """Load production settings without local credentials or external clients."""
        environment = {
            "DEBUG": "False",
            "SECRET_KEY": get_random_secret_key(),
            "ALLOWED_HOSTS": "api.example.com",
        }
        if overrides:
            environment.update(overrides)
        with (
            patch.dict(os.environ, environment, clear=True),
            patch("dotenv.load_dotenv"),
            patch("cloudinary.config"),
        ):
            return runpy.run_path(str(SETTINGS_FILE))

    def test_production_defaults_to_postgis_and_rejects_other_engines(self):
        """Prevent deployment with a backend unable to migrate geographic fields."""
        configuration = self.load_settings()
        self.assertEqual(
            configuration["DATABASES"]["default"]["ENGINE"],
            "django.contrib.gis.db.backends.postgis",
        )
        for engine in ("", "django.db.backends.postgresql", "django.db.backends.sqlite3"):
            with self.subTest(engine=engine):
                with self.assertRaisesRegex(ImproperlyConfigured, "DB_ENGINE"):
                    self.load_settings({"DB_ENGINE": engine})

    def test_database_connection_values_and_optional_tls_are_passed_through(self):
        """Pass remote connection settings and CA verification to libpq unchanged."""
        configuration = self.load_settings({
            "DB_NAME": "fixture_database",
            "DB_USER": "fixture_user",
            "DB_PASSWORD": "fixture-only-password",
            "DB_HOST": "database.example.invalid",
            "DB_PORT": "6543",
            "DB_SSLMODE": " verify-full ",
            "DB_SSLROOTCERT": " /run/certs/database-ca.crt ",
        })
        database = configuration["DATABASES"]["default"]
        self.assertEqual(database["NAME"], "fixture_database")
        self.assertEqual(database["USER"], "fixture_user")
        self.assertEqual(database["PASSWORD"], "fixture-only-password")
        self.assertEqual(database["HOST"], "database.example.invalid")
        self.assertEqual(database["PORT"], "6543")
        self.assertEqual(database["OPTIONS"], {
            "sslmode": "verify-full",
            "sslrootcert": "/run/certs/database-ca.crt",
        })
        with self.assertRaisesRegex(ImproperlyConfigured, "DB_SSLMODE"):
            self.load_settings({"DB_SSLMODE": "invalid"})

    def test_local_database_and_celery_defaults_are_preserved(self):
        """Leave local TLS, concurrency and relative Beat state behavior intact."""
        configuration = self.load_settings({
            "DEBUG": "True",
            "DB_ENGINE": "django.db.backends.postgresql",
            "DB_HOST": "localhost",
            "DB_NAME": "fixture_database",
        })
        database = configuration["DATABASES"]["default"]
        self.assertEqual(database["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(database["HOST"], "localhost")
        self.assertEqual(database["PORT"], "5432")
        self.assertNotIn("OPTIONS", database)
        self.assertNotIn("CELERY_WORKER_CONCURRENCY", configuration)
        self.assertEqual(configuration["CELERY_BEAT_SCHEDULE_FILENAME"], "celerybeat-schedule")

    def test_redis_urls_support_one_server_with_separate_databases_and_tls(self):
        """Parse secure Redis transport settings without contacting the server."""
        broker_url = (
            "rediss://redis.example.invalid:6380/0"
            "?ssl_cert_reqs=required&ssl_check_hostname=true"
        )
        channel_url = (
            "rediss://redis.example.invalid:6380/1"
            "?ssl_cert_reqs=required&ssl_check_hostname=true"
        )
        configuration = self.load_settings({
            "CELERY_BROKER_URL": broker_url,
            "NOTIFICATION_REDIS_URL": channel_url,
        })
        self.assertEqual(configuration["CELERY_BROKER_URL"], broker_url)
        address = configuration["CHANNEL_LAYERS"]["default"]["CONFIG"]["hosts"][0]["address"]
        self.assertEqual(address, channel_url)
        connection = Connection(broker_url)
        self.assertEqual(connection.virtual_host, "0")
        self.assertEqual(connection.ssl["ssl_cert_reqs"], ssl.CERT_REQUIRED)
        self.assertTrue(connection.ssl["ssl_check_hostname"])
        pool = ConnectionPool.from_url(address)
        self.assertEqual(pool.connection_kwargs["db"], 1)
        self.assertEqual(pool.connection_kwargs["ssl_cert_reqs"], "required")
        self.assertTrue(pool.connection_kwargs["ssl_check_hostname"])
        self.assertEqual(
            configuration["CHANNEL_LAYERS"]["default"]["CONFIG"]["prefix"],
            "sugbogo_notifications",
        )
        self.assertNotIn("CELERY_RESULT_BACKEND", configuration)

    def test_worker_concurrency_and_beat_path_are_environment_configurable(self):
        """Accept conservative worker sizing and an explicit writable state path."""
        configuration = self.load_settings({
            "CELERY_WORKER_CONCURRENCY": "1",
            "CELERY_BEAT_SCHEDULE_FILENAME": "/var/lib/sugbogo/celerybeat-schedule",
        })
        self.assertEqual(configuration["CELERY_WORKER_CONCURRENCY"], 1)
        self.assertEqual(
            configuration["CELERY_BEAT_SCHEDULE_FILENAME"],
            "/var/lib/sugbogo/celerybeat-schedule",
        )
        for value in ("", "0", "-1", "invalid"):
            with self.subTest(concurrency=value):
                with self.assertRaisesRegex(ImproperlyConfigured, "CELERY_WORKER_CONCURRENCY"):
                    self.load_settings({"CELERY_WORKER_CONCURRENCY": value})
        with self.assertRaisesRegex(ImproperlyConfigured, "CELERY_BEAT_SCHEDULE_FILENAME"):
            self.load_settings({"CELERY_BEAT_SCHEDULE_FILENAME": " "})

    def test_scheduled_tasks_are_discovered_and_shadow_queue_does_not_enable_features(self):
        """Keep the existing routing and optional inference switches independent."""
        celery_app.loader.import_default_modules()
        self.assertEqual(celery_app.conf.task_default_queue, "celery")
        for entry in settings.CELERY_BEAT_SCHEDULE.values():
            self.assertIn(entry["task"], celery_app.tasks)
        for name in (
            "apps.reviews.tasks.process_gemini_sentiment_shadow",
            "apps.reviews.tasks.recover_gemini_sentiment_shadow",
        ):
            self.assertEqual(celery_app.tasks[name].queue, "gemini_sentiment_shadow")
        configuration = self.load_settings()
        self.assertFalse(configuration["GEMINI_SENTIMENT_SHADOW_ENABLED"])
        self.assertFalse(configuration["GEMINI_SENTIMENT_CUTOVER_ENABLED"])
        with override_settings(
            GEMINI_SENTIMENT_SHADOW_ENABLED=False,
            GEMINI_SENTIMENT_CUTOVER_ENABLED=False,
        ):
            from apps.reviews.services.gemini_sentiment_shadow_service import (
                GeminiSentimentShadowService,
            )
            self.assertEqual(GeminiSentimentShadowService.recover(), 0)

    def test_beat_state_can_be_written_and_reopened_without_dispatching_tasks(self):
        """Persist scheduler timestamps in disposable storage without ticking Beat."""
        with TemporaryDirectory() as directory:
            filename = str(Path(directory) / "celerybeat-schedule")
            scheduler = PersistentScheduler(
                app=celery_app,
                schedule_filename=filename,
            )
            name = "daily-discovery-score-recomputation"
            try:
                last_run_at = scheduler.schedule[name].last_run_at
            finally:
                scheduler.close()
            scheduler = PersistentScheduler(
                app=celery_app,
                schedule_filename=filename,
            )
            try:
                self.assertEqual(scheduler.schedule[name].last_run_at, last_run_at)
                self.assertEqual(
                    scheduler.schedule[name].task,
                    settings.CELERY_BEAT_SCHEDULE[name]["task"],
                )
            finally:
                scheduler.close()

    def test_hosted_mongodb_uri_database_and_client_timeouts_are_preserved(self):
        """Pass hosted MongoDB settings to the existing lazy client with no DNS calls."""
        configuration = self.load_settings({
            "MONGODB_URI": "mongodb+srv://mongo.example.invalid/?tls=true",
            "MONGODB_DATABASE": "fixture_analytics",
        })
        with (
            override_settings(
                MONGODB_URI=configuration["MONGODB_URI"],
                MONGODB_DATABASE=configuration["MONGODB_DATABASE"],
                MONGODB_SERVER_SELECTION_TIMEOUT_MS=(
                    configuration["MONGODB_SERVER_SELECTION_TIMEOUT_MS"]
                ),
            ),
            patch.object(MongoDBService, "_client", None),
            patch("apps.shared.services.mongodb_service.MongoClient") as client,
        ):
            MongoDBService.get_database()
            self.assertEqual(client.call_args.args[0], configuration["MONGODB_URI"])
            self.assertEqual(client.call_args.kwargs["serverSelectionTimeoutMS"], 3000)
            client.return_value.__getitem__.assert_called_once_with("fixture_analytics")

    def test_mongodb_outages_preserve_controlled_write_and_reporting_failures(self):
        """Keep existing 503 and unavailable-source behavior without network access."""
        with (
            patch.object(VisibilityEventService, "_indexes_initialized", False),
            patch.object(VisibilityEventService, "_unavailable_until", 0.0),
            patch.object(
                VisibilityEventService,
                "_get_collection",
                side_effect=ConnectionFailure("Fixture outage"),
            ) as collection,
            patch("apps.business.services.visibility_event_service.logger"),
        ):
            with self.assertRaises(VisibilityTrackingUnavailable) as raised:
                VisibilityEventService.ensure_indexes()
            self.assertEqual(raised.exception.status_code, 503)
            with self.assertRaises(VisibilityTrackingUnavailable):
                VisibilityEventService.ensure_indexes()
            collection.assert_called_once()
        with (
            patch.object(
                RoutePlanningEventService,
                "_get_collection",
                side_effect=ConnectionFailure("Fixture outage"),
            ),
            patch("apps.business.services.route_planning_event_service.logger"),
        ):
            with self.assertRaises(RoutePlanningUnavailable) as raised:
                RoutePlanningEventService.initialize_tracking()
            self.assertEqual(raised.exception.status_code, 503)
            self.assertEqual(
                RoutePlanningEventService.get_totals(1, 1, None),
                (None, None, "route_source_unavailable"),
            )
