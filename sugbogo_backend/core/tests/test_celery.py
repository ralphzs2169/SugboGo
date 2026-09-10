from celery.schedules import crontab
from django.conf import settings
from django.test import SimpleTestCase

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
        """Schedules one daily run at 02:00 in Django's timezone."""

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
                2,
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
