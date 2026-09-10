import inspect
import json
from datetime import UTC, datetime
from unittest.mock import patch

from celery.exceptions import Retry
from django.test import SimpleTestCase

from apps.business.services.discovery_score_service import (
    DiscoveryScoreBatchResult,
    DiscoveryScoreBusinessFailure,
)
from apps.business.services.visibility_event_service import (
    VisibilityTrackingUnavailable,
)
from apps.business.tasks import (
    TRANSIENT_RETRY_LIMIT,
    recompute_discovery_scores,
)


class DiscoveryScoreTaskTests(SimpleTestCase):
    """Tests the thin daily Discovery Score Celery task."""

    REFERENCE_TIME = datetime(
        2026,
        9,
        10,
        2,
        0,
        tzinfo=UTC,
    )

    def _batch_result(
        self,
        updated_count: int = 0,
        stale_count: int = 0,
        failed_business_ids: tuple[int, ...] = (),
    ) -> DiscoveryScoreBatchResult:
        """Builds a small batch result for task orchestration tests."""

        failures = tuple(
            DiscoveryScoreBusinessFailure(
                business_id=business_id,
                error_type="NotFound",
                detail="The active business could not be found.",
            )
            for business_id in failed_business_ids
        )

        return DiscoveryScoreBatchResult(
            reference_time=self.REFERENCE_TIME,
            considered_count=(
                updated_count
                + stale_count
                + len(
                    failures,
                )
            ),
            updated_results=tuple(
                object()
                for _ in range(
                    updated_count,
                )
            ),
            stale_results=tuple(
                object()
                for _ in range(
                    stale_count,
                )
            ),
            failures=failures,
        )

    def test_task_calls_score_service_with_one_reference_time(self):
        """Passes one resolved timestamp to the existing scoring service."""

        batch_result = self._batch_result(
            updated_count=3,
            stale_count=1,
        )

        with patch(
            "apps.business.tasks.timezone.now",
            return_value=self.REFERENCE_TIME,
        ) as now_mock, patch(
            "apps.business.tasks.DiscoveryScoreService."
            "recompute_business_scores",
            return_value=batch_result,
        ) as service_mock:
            summary = recompute_discovery_scores.run()

        now_mock.assert_called_once_with()
        service_mock.assert_called_once_with(
            reference_time=self.REFERENCE_TIME,
        )
        self.assertEqual(
            summary,
            {
                "reference_time": self.REFERENCE_TIME.isoformat(),
                "considered": 4,
                "updated": 3,
                "skipped_stale": 1,
                "failed": 0,
                "failed_business_ids": [],
            },
        )

    def test_task_summary_is_json_serializable_and_reports_failures(self):
        """Returns only small JSON-safe run counts and failed business IDs."""

        batch_result = self._batch_result(
            updated_count=2,
            stale_count=1,
            failed_business_ids=(
                7,
                9,
            ),
        )

        with patch(
            "apps.business.tasks.timezone.now",
            return_value=self.REFERENCE_TIME,
        ), patch(
            "apps.business.tasks.DiscoveryScoreService."
            "recompute_business_scores",
            return_value=batch_result,
        ), patch(
            "apps.business.tasks.logger.warning",
        ) as warning_mock:
            summary = recompute_discovery_scores.run()

        serialized_summary = json.dumps(
            summary,
        )

        self.assertIn(
            '"failed": 2',
            serialized_summary,
        )
        self.assertEqual(
            summary["failed_business_ids"],
            [
                7,
                9,
            ],
        )
        warning_mock.assert_called_once()

    def test_task_keeps_scoring_formulas_in_the_service_layer(self):
        """Contains orchestration calls without SC, VG, or DS formula code."""

        task_source = inspect.getsource(
            recompute_discovery_scores.run,
        )

        self.assertIn(
            "DiscoveryScoreService.recompute_business_scores",
            task_source,
        )
        self.assertNotIn(
            "SpecialtyScoreService",
            task_source,
        )
        self.assertNotIn(
            "VisibilityGapService",
            task_source,
        )
        self.assertNotIn(
            "calculate_discovery_score",
            task_source,
        )

    def test_transient_visibility_failure_uses_bounded_retry(self):
        """Retries a temporary Mongo visibility failure with modest backoff."""

        retry_signal = Retry(
            "retry visibility",
        )

        with patch(
            "apps.business.tasks.timezone.now",
            return_value=self.REFERENCE_TIME,
        ), patch(
            "apps.business.tasks.DiscoveryScoreService."
            "recompute_business_scores",
            side_effect=VisibilityTrackingUnavailable(),
        ), patch.object(
            recompute_discovery_scores,
            "retry",
            return_value=retry_signal,
        ) as retry_mock, patch(
            "apps.business.tasks.logger.warning",
        ) as warning_mock, self.assertRaises(Retry):
            recompute_discovery_scores.run()

        self.assertEqual(
            recompute_discovery_scores.max_retries,
            TRANSIENT_RETRY_LIMIT,
        )
        retry_kwargs = retry_mock.call_args.kwargs
        self.assertEqual(
            retry_kwargs["countdown"],
            60,
        )
        self.assertEqual(
            retry_kwargs["kwargs"],
            {
                "reference_time_iso": (
                    self.REFERENCE_TIME.isoformat()
                ),
            },
        )
        warning_mock.assert_called_once()

    def test_retry_reuses_the_original_reference_time(self):
        """Uses the original run timestamp when a Celery retry executes."""

        batch_result = self._batch_result(
            updated_count=1,
        )
        later_time = datetime(
            2026,
            9,
            10,
            2,
            5,
            tzinfo=UTC,
        )

        with patch(
            "apps.business.tasks.timezone.now",
            return_value=later_time,
        ) as now_mock, patch(
            "apps.business.tasks.DiscoveryScoreService."
            "recompute_business_scores",
            return_value=batch_result,
        ) as service_mock:
            summary = recompute_discovery_scores.run(
                reference_time_iso=(
                    self.REFERENCE_TIME.isoformat()
                ),
            )

        now_mock.assert_not_called()
        service_mock.assert_called_once_with(
            reference_time=self.REFERENCE_TIME,
        )
        self.assertEqual(
            summary["reference_time"],
            self.REFERENCE_TIME.isoformat(),
        )

    def test_permanent_error_is_logged_and_not_retried(self):
        """Leaves programming errors visible without an automatic retry loop."""

        with patch(
            "apps.business.tasks.timezone.now",
            return_value=self.REFERENCE_TIME,
        ), patch(
            "apps.business.tasks.DiscoveryScoreService."
            "recompute_business_scores",
            side_effect=RuntimeError(
                "unexpected scoring defect",
            ),
        ), patch.object(
            recompute_discovery_scores,
            "retry",
        ) as retry_mock, patch(
            "apps.business.tasks.logger.exception",
        ) as exception_mock, self.assertRaisesRegex(
            RuntimeError,
            "unexpected scoring defect",
        ):
            recompute_discovery_scores.run()

        retry_mock.assert_not_called()
        exception_mock.assert_called_once()
