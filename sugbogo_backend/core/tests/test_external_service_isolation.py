from django.conf import settings
from django.test import SimpleTestCase

from config import celery_app


class ExternalServiceIsolationTests(SimpleTestCase):
    def test_celery_uses_process_local_transport_without_eager_execution(self):
        self.assertEqual(settings.CELERY_BROKER_URL, "memory://")
        self.assertEqual(celery_app.conf.broker_url, "memory://")
        self.assertFalse(celery_app.conf.task_always_eager)

    def test_unmocked_gemini_requests_are_blocked(self):
        from google.genai.models import Models

        with self.assertRaisesRegex(AssertionError, "Mock Gemini"):
            Models.generate_content(object(), model="test", contents="test")

    def test_unmocked_openai_moderation_is_blocked(self):
        from openai.resources.moderations import Moderations

        with self.assertRaisesRegex(AssertionError, "Mock OpenAI"):
            Moderations.create(object(), input="test")

    def test_network_broker_connection_is_blocked(self):
        from kombu import Connection

        with self.assertRaisesRegex(AssertionError, "isolated memory broker"):
            Connection("amqp://guest:guest@localhost:5672//").connect()
