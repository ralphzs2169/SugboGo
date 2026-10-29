"""Transportation aggregation and API semantics without external stores."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from pymongo.errors import AutoReconnect
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.admin_operations.analytics.reporting_views import TransportationPlanningView
from apps.admin_operations.analytics.services.transportation_planning_service import TransportationPlanningService
from apps.business.services.route_planning_event_service import RoutePlanningEventService
from apps.business.services.tests.discovery_source_fixtures import DiscoverySourceCollection
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class PlanningCollection(DiscoverySourceCollection):
    """Evaluate only the read pipeline operators used by platform reporting."""

    def find_one(
        self,
        query,
    ):
        """Read the retained tracking singleton without initialization."""
        if self.error:
            raise self.error
        return self.state

    @staticmethod
    def matches(
        row,
        query,
    ):
        """Apply date, identity and metadata exclusion predicates."""
        for field, condition in query.items():
            if field == "$nor":
                if any(PlanningCollection.matches(row, item) for item in condition):
                    return False
                continue
            value = row.get(field)
            for operator, expected in condition.items():
                if operator == "$exists" and (field in row) != expected:
                    return False
                if operator == "$type" and type(value) not in (int, float):
                    return False
                if operator == "$gt" and (value is None or value <= expected):
                    return False
                if operator == "$gte" and (value is None or value < expected):
                    return False
                if operator == "$lt" and (value is None or value >= expected):
                    return False
        return True

    def expression(
        self,
        row,
        expression,
    ):
        """Support conditional destination method counters."""
        if isinstance(expression, dict) and "$eq" in expression:
            left, right = expression["$eq"]
            return self.expression(row, left) == self.expression(row, right)
        return super().expression(row, expression)

    def aggregate(
        self,
        pipeline,
    ):
        """Execute facets through the existing grouping evaluator without writes."""
        if self.error:
            raise self.error
        self.calls.append(pipeline)
        rows = list(self.documents)
        for stage in pipeline:
            if "$match" in stage:
                rows = [row for row in rows if self.matches(row, stage["$match"])]
            elif "$set" in stage:
                rows = [
                    {**row, **{
                        field: self.expression(row, value)
                        for field, value in stage["$set"].items()
                    }}
                    for row in rows
                ]
            elif "$facet" in stage:
                facets = {}
                for field, stages in stage["$facet"].items():
                    child = PlanningCollection()
                    child.documents = rows
                    facets[field] = list(child.aggregate(stages))
                rows = [facets]
            elif "$sort" in stage:
                for field, direction in reversed(list(stage["$sort"].items())):
                    rows.sort(
                        key=lambda row: self.expression(row, "$" + field),
                        reverse=direction < 0,
                    )
            elif "$limit" in stage:
                rows = rows[:stage["$limit"]]
            else:
                child = DiscoverySourceCollection()
                child.documents = rows
                rows = list(child.aggregate([stage]))
        return iter(rows)


class TransportationPlanningTests(SimpleTestCase):
    """Verify real pipeline boundaries, pooled identities and nullable observations."""

    def setUp(self):
        """Provide bounded event fixtures and public names without database access."""
        self.period = resolve_period(
            preset="custom",
            start_date="2026-10-05",
            end_date="2026-10-12",
            now=datetime(2026, 10, 15, tzinfo=UTC),
        )
        self.collection = PlanningCollection()
        self.collection.database = SimpleNamespace(
            list_collection_names=lambda **kwargs: [RoutePlanningEventService.COLLECTION_NAME] if self.collection.exists else [],
        )
        self.collection.state = {"started_at": self.period.start}
        source = patch.object(RoutePlanningEventService, "_get_collection", return_value=self.collection)
        source.start()
        self.addCleanup(source.stop)
        names = patch("apps.admin_operations.analytics.services.transportation_planning_service.Business.objects.filter")
        self.names = names.start()
        self.names.return_value.values_list.return_value = [(1, "Public business")]
        self.addCleanup(names.stop)

    def event(
        self,
        method="ROAD_ROUTE",
        account=1,
        business=1,
        at=None,
    ):
        """Append an already deduplicated recorded intent."""
        self.collection.documents.append({
            "navigation_method": method,
            "explorer_id": account,
            "business_id": business,
            "occurred_at": at or self.period.start,
        })

    def test_reconciles_methods_unknowns_destinations_and_global_distinct_accounts(self):
        """One account across businesses, days and methods is one period account."""
        self.event()
        self.event(method="JEEPNEY", business=2)
        self.event(at=self.period.start + timedelta(days=1))
        self.event(method="legacy", account=2)
        self.event(method="JEEPNEY", account=None)
        report = TransportationPlanningService.get_report(self.period)
        self.assertEqual(report["total_requests"], 5)
        self.assertEqual(report["distinct_requesting_accounts"], 2)
        self.assertEqual(report["requests_without_account_identity"], 1)
        self.assertEqual([row["count"] for row in report["methods"]], [2, 2, 1])
        self.assertEqual([row["share_percent"] for row in report["methods"]], [40, 40, 20])
        self.assertEqual(sum(row["count"] for row in report["destinations"]), 5)
        self.assertEqual(report["unavailable_destinations_in_ranking"], 1)
        self.assertEqual(len(self.collection.calls), 1)
        self.assertEqual(self.collection.index_calls, [])
        self.names.assert_called_once_with(pk__in=[1, 2])

    def test_period_and_tracking_start_clip_manila_buckets(self):
        """Exclude the exact end and all events preceding the tracking boundary."""
        boundary = self.period.start + timedelta(hours=12)
        self.collection.state = {"started_at": boundary}
        self.event(at=self.period.start)
        self.event(at=boundary)
        self.event(at=self.period.end)
        report = TransportationPlanningService.get_report(self.period, interval="daily")
        self.assertEqual(report["total_requests"], 1)
        self.assertEqual(report["series"][0]["observation_start"], boundary)
        self.assertEqual(report["series"][0]["road_route"], 1)
        self.assertIsNone(report["series"][1]["road_route"])
        self.assertIn("tracking_started_during_period", report["meta"]["partial_reasons"])
        self.assertIsNone(report["meta"]["data_through"])
        self.assertFalse(report["meta"]["coverage_verified"])

    def test_zero_pretracking_missing_and_failed_sources(self):
        """Healthy zeros differ from absent history and storage failures."""
        report = TransportationPlanningService.get_report(self.period)
        self.assertEqual(report["total_requests"], 0)
        self.assertTrue(all(row["share_percent"] is None for row in report["methods"]))
        self.collection.state = {"started_at": self.period.end}
        report = TransportationPlanningService.get_report(self.period)
        self.assertIsNone(report["total_requests"])
        self.assertIn("tracking_not_started_in_period", report["meta"]["partial_reasons"])
        self.collection.state = None
        self.collection.exists = False
        report = TransportationPlanningService.get_report(self.period)
        self.assertIn("route_intent_collection_missing", report["meta"]["partial_reasons"])
        self.collection.error = AutoReconnect("fixture")
        report = TransportationPlanningService.get_report(self.period)
        self.assertEqual(report["meta"]["availability"], "unavailable")
        self.assertIsNone(report["methods"])

    def test_ranking_is_bounded_and_api_authorization_and_validation_are_shared(self):
        """Only active administrators may read bounded aggregate results."""
        for business in range(1, 14):
            self.event(business=business)
        report = TransportationPlanningService.get_report(self.period)
        self.assertEqual(len(report["destinations"]), 10)
        self.assertEqual(report["total_requests"], 13)
        factory = APIRequestFactory()
        for role in User.UserRole.values:
            request = factory.get("/", {"period": "30", "interval": "weekly"})
            force_authenticate(
                request,
                user=User(USER_ID=1, USER_ROLE=role, USER_STATUS=User.UserStatus.ACTIVE),
            )
            response = TransportationPlanningView.as_view()(request)
            expected = 200 if role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN) else 403
            self.assertEqual(response.status_code, expected)
        request = factory.get("/", {"interval": "monthly"})
        force_authenticate(
            request,
            user=User(USER_ID=1, USER_ROLE=User.UserRole.ADMIN, USER_STATUS=User.UserStatus.ACTIVE),
        )
        self.assertEqual(TransportationPlanningView.as_view()(request).status_code, 400)

    def test_pretracking_buckets_and_unknown_initialization_remain_unavailable(self):
        """No observed count is invented before a mid-period tracking start."""
        self.collection.state = {"started_at": self.period.start + timedelta(days=2)}
        report = TransportationPlanningService.get_report(self.period, interval="daily")
        self.assertFalse(report["series"][0]["tracking_started"])
        self.assertIsNone(report["series"][0]["observation_start"])
        self.assertIsNone(report["series"][0]["road_route"])
        self.assertTrue(report["series"][2]["tracking_started"])
        self.collection.state = {"started_at": "invalid"}
        report = TransportationPlanningService.get_report(self.period)
        self.assertIsNone(report["total_requests"])
        self.assertIn("route_tracking_not_initialized", report["meta"]["partial_reasons"])
        factory = APIRequestFactory()
        self.assertIn(TransportationPlanningView.as_view()(factory.get("/")).status_code, (401, 403))
        request = factory.get("/")
        force_authenticate(
            request,
            user=User(
                USER_ID=1,
                USER_ROLE=User.UserRole.ADMIN,
                USER_STATUS=User.UserStatus.SUSPENDED,
            ),
        )
        self.assertEqual(TransportationPlanningView.as_view()(request).status_code, 403)
