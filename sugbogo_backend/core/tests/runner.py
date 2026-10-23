"""Keep Django regression runs away from live brokers and AI providers."""

import os
from unittest.mock import patch

from django.test import override_settings
from django.test.runner import DiscoverRunner
from kombu import Connection


class IsolatedExternalServicesTestRunner(DiscoverRunner):
    """Use process-local messaging and require explicit provider mocks in tests."""

    def run_suite(
        self,
        suite,
        **kwargs,
    ):
        """Isolate transports for the entire suite, including commit callbacks."""
        from config import celery_app

        previous_broker = celery_app.conf.broker_url
        previous_eager = celery_app.conf.task_always_eager
        establish_connection = Connection._establish_connection

        def isolated_connection(
            broker_connection,
        ):
            """Refuse network transports even when a test constructs another Celery app."""
            if broker_connection.transport.driver_type != "memory":
                raise AssertionError("Use the isolated memory broker in tests.")
            return establish_connection(broker_connection)

        with (
            patch.dict(
                os.environ,
                {
                    "CELERY_BROKER_URL": "memory://",
                    "CELERY_BROKER_READ_URL": "memory://",
                    "CELERY_BROKER_WRITE_URL": "memory://",
                },
            ),
            override_settings(
                CELERY_BROKER_URL="memory://",
                CELERY_TASK_ALWAYS_EAGER=False,
                CHANNEL_LAYERS={
                    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
                },
            ),
            patch.object(Connection, "_establish_connection", isolated_connection),
            patch(
                "google.genai.models.Models.generate_content",
                side_effect=AssertionError("Mock Gemini before running provider-dependent tests."),
            ),
            patch(
                "openai.resources.moderations.Moderations.create",
                side_effect=AssertionError("Mock OpenAI before running provider-dependent tests."),
            ),
        ):
            celery_app.conf.update(broker_url="memory://", task_always_eager=False)
            try:
                return super().run_suite(suite, **kwargs)
            finally:
                celery_app.conf.update(
                    broker_url=previous_broker,
                    task_always_eager=previous_eager,
                )
