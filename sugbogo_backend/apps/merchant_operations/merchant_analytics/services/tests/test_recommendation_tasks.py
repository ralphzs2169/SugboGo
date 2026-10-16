"""Verify bounded Celery retries without broker access or generated-content writes."""

from unittest.mock import patch

from celery.exceptions import Retry
from django.test import SimpleTestCase

from apps.shared.services.gemini_structured_service import TransientGenerationError

from ...tasks import generate_merchant_recommendations
from ..recommendation_service import RecommendationService


class RecommendationTaskTests(SimpleTestCase):
    def test_transient_retry_uses_bounded_backoff(self):
        task = generate_merchant_recommendations
        for retries, countdown in ((0, 60), (1, 120), (2, 240)):
            task.push_request(retries=retries)
            try:
                with patch.object(RecommendationService, "generate", side_effect=TransientGenerationError()), \
                     patch.object(task, "retry", side_effect=Retry()) as retry:
                    with self.assertRaises(Retry):
                        task.run("synthetic-job")
                self.assertEqual(retry.call_args.kwargs["countdown"], countdown)
            finally:
                task.pop_request()

    def test_lock_contention_retries_and_exhaustion_finishes_job(self):
        task = generate_merchant_recommendations
        task.push_request(retries=task.max_retries)
        try:
            with patch.object(RecommendationService, "generate", return_value="busy"), \
                 patch.object(RecommendationService, "_finish") as finish, patch.object(task, "retry") as retry:
                self.assertEqual(task.run("synthetic-job"), "failed")
            finish.assert_called_once_with("synthetic-job", "failed", "retry_exhausted")
            retry.assert_not_called()
        finally:
            task.pop_request()

    def test_terminal_result_is_returned_without_retry(self):
        task = generate_merchant_recommendations
        with patch.object(RecommendationService, "generate", return_value="unchanged"), patch.object(task, "retry") as retry:
            self.assertEqual(task.run("synthetic-job"), "unchanged")
        retry.assert_not_called()
