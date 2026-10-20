from datetime import UTC, datetime
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_event_service import (
    VisibilityEventService,
    VisibilityTrackingUnavailable,
)


class RecentSaveActivityTests(SimpleTestCase):
    """Verify anonymous save-source boundaries and Mongo timestamp normalization."""

    NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)

    def test_read_is_save_only_owned_bounded_and_anonymous(self):
        # Mongo returns naive UTC dates; the API must not interpret them as Manila time.
        rows = [{
            "_id": "2026-10-20",
            "count": 2,
            "occurred_at": self.NOW.replace(tzinfo=None),
            "explorer_id": 999,
        }]
        with patch.object(
            VisibilityEventService,
            "_read_analytics",
            return_value=rows,
        ) as read:
            result = VisibilityEventService.get_recent_save_days(
                business_id=42,
                as_of=self.NOW,
                limit=5,
            )
        match = read.call_args.args[0][0]["$match"]
        self.assertEqual(match["business_id"], {"$in": [42]})
        self.assertEqual(match["event_type"], "SAVE")
        self.assertEqual(match["occurred_at"], {"$lte": self.NOW})
        self.assertEqual(result, [{
            "date": "2026-10-20",
            "count": 2,
            "occurred_at": self.NOW,
        }])

    def test_unavailable_source_is_not_converted_to_an_empty_result(self):
        with patch.object(
            VisibilityEventService,
            "_read_analytics",
            side_effect=VisibilityTrackingUnavailable(),
        ):
            with self.assertRaises(VisibilityTrackingUnavailable):
                VisibilityEventService.get_recent_save_days(
                    business_id=42,
                    as_of=self.NOW,
                    limit=5,
                )

    def test_rejects_unbounded_limits_and_naive_cutoffs_before_reading(self):
        with patch.object(VisibilityEventService, "_read_analytics") as read:
            for limit in (0, 6, True):
                with self.assertRaises(ValidationError):
                    VisibilityEventService.get_recent_save_days(
                        business_id=42,
                        as_of=self.NOW,
                        limit=limit,
                    )
            with self.assertRaises(ValidationError):
                VisibilityEventService.get_recent_save_days(
                    business_id=42,
                    as_of=self.NOW.replace(tzinfo=None),
                    limit=5,
                )
        read.assert_not_called()
