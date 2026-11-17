from unittest.mock import patch

from amqp.exceptions import ConnectionError as AMQPConnectionError
from celery.schedules import crontab
from django.conf import settings
from django.test import SimpleTestCase
from kombu import Connection
from kombu.exceptions import OperationalError
from kombu.messaging import Producer

from apps.business.tasks import recompute_discovery_scores
from config import celery_app


class CeleryConfigurationTests(SimpleTestCase):
    """Tests the project-level Celery application and daily schedule."""

    def test_celery_application_uses_django_namespaced_settings(self):
        """Loads the broker and serializers from CELERY-prefixed settings."""

        self.assertEqual(
            celery_app.conf.broker_url,
            settings.CELERY_BROKER_URL,
        )
        self.assertEqual(
            celery_app.conf.task_serializer,
            "json",
        )
        self.assertIn(
            "json",
            celery_app.conf.accept_content,
        )

    def test_celery_autodiscovers_the_discovery_score_task(self):
        """Registers the business Discovery Score task through autodiscovery."""

        celery_app.loader.import_default_modules()

        self.assertIn(
            "apps.business.tasks.recompute_discovery_scores",
            celery_app.tasks,
        )

    def test_daily_schedule_uses_django_timezone(self):
        """Schedules Discovery at 18:00 UTC, which is 02:00 the next Manila day."""

        schedule_entry = settings.CELERY_BEAT_SCHEDULE[
            "daily-discovery-score-recomputation"
        ]
        schedule = schedule_entry[
            "schedule"
        ]

        self.assertEqual(
            settings.CELERY_TIMEZONE,
            settings.TIME_ZONE,
        )
        self.assertEqual(
            schedule_entry["task"],
            "apps.business.tasks.recompute_discovery_scores",
        )
        self.assertIsInstance(
            schedule,
            crontab,
        )
        self.assertEqual(
            schedule.minute,
            {
                0,
            },
        )
        self.assertEqual(
            schedule.hour,
            {
                18,
            },
        )
        self.assertEqual(
            schedule.day_of_week,
            set(
                range(
                    7,
                ),
            ),
        )

    def test_other_periodic_schedules_and_global_timezone_are_unchanged(self):
        """Keep UTC and all unrelated daily and recovery job cadences."""
        self.assertEqual(settings.TIME_ZONE, "UTC")
        self.assertEqual(settings.CELERY_TIMEZONE, "UTC")
        self.assertTrue(settings.USE_TZ)
        self.assertTrue(settings.CELERY_ENABLE_UTC)
        schedules = settings.CELERY_BEAT_SCHEDULE
        hourly = schedules["hourly-discovery-score-reconciliation"]["schedule"]
        self.assertEqual(hourly.minute, {15})
        self.assertEqual(hourly.hour, set(range(24)))
        for name, hour in (
            ("daily-login-history-pruning", 4),
            ("daily-review-summary-recomputation", 3),
        ):
            schedule = schedules[name]["schedule"]
            self.assertEqual(schedule.hour, {hour})
            self.assertEqual(schedule.minute, {0})
        media = schedules["recover-review-media-cleanup"]["schedule"]
        self.assertEqual(media.minute, set(range(0, 60, 5)))
        self.assertEqual(media.hour, set(range(24)))
        for name, interval in (
            ("recover-merchant-plus-fulfilment", 30.0),
            ("recover-gemini-sentiment-shadow", 60.0),
            ("recover-business-ratings", 60.0),
            ("reconcile-business-ratings", 300.0),
            ("recover-review-moderation-retries", 30.0),
            ("recover-review-insight-regeneration", 30.0),
        ):
            self.assertEqual(schedules[name]["schedule"], interval)
        if "recover-maya-events" in schedules:
            self.assertEqual(schedules["recover-maya-events"]["schedule"], 30.0)

    def test_celery_does_not_require_a_result_backend(self):
        """Ignores task results without configuring a persistent backend."""

        self.assertTrue(
            settings.CELERY_TASK_IGNORE_RESULT,
        )
        self.assertFalse(
            hasattr(
                settings,
                "CELERY_RESULT_BACKEND",
            ),
        )

    def test_discovery_publish_retries_transient_broker_failure(self):
        """Use Celery's existing short, bounded publish retry policy."""
        policy = celery_app.conf.task_publish_retry_policy
        self.assertTrue(celery_app.conf.task_publish_retry)
        self.assertEqual(policy["max_retries"], 3)
        self.assertLessEqual(policy["interval_max"], 1)

        original_publish = Producer._publish
        attempts = []

        def fail_once(
            producer,
            *args,
            **kwargs,
        ):
            attempts.append(1)
            if len(attempts) == 1:
                raise AMQPConnectionError("Temporary broker failure")
            return original_publish(producer, *args, **kwargs)

        with patch.object(Producer, "_publish", fail_once):
            recompute_discovery_scores.apply_async(
                connection=Connection("memory://"),
            )

        self.assertEqual(len(attempts), 2)

    def test_discovery_publish_retry_is_bounded(self):
        """Raise after finite attempts when the broker stays unavailable."""
        attempts = []

        def fail_publish(
            producer,
            *args,
            **kwargs,
        ):
            attempts.append(1)
            raise AMQPConnectionError("Broker unavailable")

        with patch.object(Producer, "_publish", fail_publish):
            with self.assertRaises(OperationalError):
                recompute_discovery_scores.apply_async(
                    connection=Connection("memory://"),
                )

        self.assertGreater(len(attempts), 1)
        self.assertLessEqual(
            len(attempts),
            celery_app.conf.task_publish_retry_policy["max_retries"] + 1,
        )
