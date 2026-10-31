"""Attention populations, current evidence and server-owned pilot selection."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.admin_operations.analytics import constants
from apps.admin_operations.system_configuration.services.analytics_policy_service import AnalyticsPolicyService
from apps.admin_operations.analytics.services.business_attention_service import BusinessAttentionService
from apps.business.models import Business, BusinessSpecialtyTag, BusinessVouch, Category, Cluster, Location, SpecialtyTag
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityTrackingUnavailable
from apps.shared.analytics.date_ranges import resolve_period
from apps.users.models import User


class AttentionFixtures:
    NOW = datetime(2026, 10, 12, 4, 30, tzinfo=UTC)

    @classmethod
    def setUpTestData(cls):
        cls.period = resolve_period(now=cls.NOW)
        cls.cluster_a = Cluster.objects.create(CLUS_NAME="Cluster A")
        cls.cluster_b = Cluster.objects.create(CLUS_NAME="Cluster B")
        cls.empty_cluster = Cluster.objects.create(CLUS_NAME="Empty cluster")
        cls.category_a = Category.objects.create(CTGRY_NAME="Category A", CLUS_ID=cls.cluster_a)
        cls.category_b = Category.objects.create(CTGRY_NAME="Category B", CLUS_ID=cls.cluster_b)
        cls.empty_category = Category.objects.create(CTGRY_NAME="Empty category", CLUS_ID=cls.empty_cluster)
        location = Location.objects.create(LOCT_POINT=Point(123.88, 10.31, srid=4326), LOCT_ADDRESS="Cebu City")
        cls.businesses = []
        for index in range(5):
            owner = cls.user(f"owner-{index}", User.UserRole.MERCHANT)
            business = Business.objects.create(
                BUSN_NAME=f"Business {index}", BUSN_CONTACT_NUMBER="09170000000",
                BUSN_STATUS=Business.BusinessStatus.ACTIVE if index < 4 else Business.BusinessStatus.SUSPENDED,
                BUSN_VOUCH_COUNT=999, USER_ID=owner, LOCT_ID=location,
                CTGRY_ID=cls.category_b if index == 3 else cls.category_a,
            )
            Business.objects.filter(pk=business.pk).update(BUSN_CREATED_AT=cls.NOW - timedelta(days=60))
            cls.businesses.append(business)
        tags = [SpecialtyTag.objects.create(TAG_NAME=f"Specialty {index}") for index in range(3)]
        cls.supporters = [cls.user(f"supporter-{index}") for index in range(8)]
        for business in cls.businesses:
            for index, tag in enumerate(tags):
                BusinessSpecialtyTag.objects.create(
                    BUSN_ID=business, TAG_ID=tag, BST_IS_ACTIVE=index < 2, BST_VOUCH_COUNT=999,
                )
        for index, number in ((0, 5), (1, 4), (2, 6)):
            for supporter in cls.supporters[:number]:
                cls.vouch(cls.businesses[index], tags[0], supporter)
                if index == 0:
                    cls.vouch(cls.businesses[index], tags[1], supporter)
        cls.vouch(cls.businesses[0], tags[0], cls.supporters[6], valid=False)
        cls.vouch(cls.businesses[0], tags[2], cls.supporters[7])
        BusinessVouch.objects.filter(BUSN_ID=cls.businesses[0], USER_ID=cls.supporters[0]).update(VOUCH_FLAG_SUSPICIOUS=True)
        cls.metrics = {
            business.pk: {"profile_visits": visits, "saves": saves, "distinct_savers": savers}
            for business, visits, saves, savers in zip(cls.businesses[:4], [4, 5, 0, 1], [3, 1, 0, 4], [2, 1, 0, 3])
        }

    @staticmethod
    def user(name, role=User.UserRole.EXPLORER):
        return User.objects.create_user(
            email=f"attention-{name}@example.com", password=None, USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE, USER_REPUTATION=Decimal("0.20"),
            USER_FNAME="Attention", USER_LNAME=name,
        )

    @staticmethod
    def vouch(business, tag, supporter, valid=True):
        return BusinessVouch.objects.create(
            BUSN_ID=business, TAG_ID=tag, USER_ID=supporter,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20"), VOUCH_EVIDENCE_IS_VALID=valid,
        )

    def mongo_metrics(self, *, business_ids, start_time, end_time):
        return {key: self.metrics[key] for key in business_ids}


class BusinessAttentionServiceTests(AttentionFixtures, TestCase):
    def test_metric_maxima_use_the_filtered_readable_population(self):
        report = self.report(attention_mode="discovery")
        self.assertEqual(
            report["metric_maxima"],
            {"profile_visits": 5, "saves": 4, "distinct_savers": 3},
        )
        filtered = self.report(
            attention_mode="discovery",
            category=self.category_a.pk,
        )
        self.assertEqual(
            filtered["metric_maxima"],
            {"profile_visits": 5, "saves": 3, "distinct_savers": 2},
        )
        zero = self.report(
            attention_mode="discovery",
            category=self.category_a.pk,
        )
        self.assertEqual(zero["items"][0]["profile_visits"], 0)
        empty = self.report(category=self.empty_category.pk)
        self.assertTrue(
            all(value is None for value in empty["metric_maxima"].values()),
        )

    def test_unavailable_discovery_does_not_create_zero_maxima_in_either_mode(self):
        with patch.object(
            VisibilityEventService,
            "get_business_attention_metrics",
            side_effect=VisibilityTrackingUnavailable(),
        ):
            discovery = BusinessAttentionService.get_report(
                self.period,
                attention_mode="discovery",
            )
            support = BusinessAttentionService.get_report(
                self.period,
                attention_mode="support",
            )
        self.assertIsNone(discovery["items"])
        self.assertEqual(len(support["items"]), 4)
        for report in (discovery, support):
            self.assertEqual(
                report["metric_maxima"],
                {"profile_visits": None, "saves": None, "distinct_savers": None},
            )

    def test_recorded_zero_observations_have_zero_maxima(self):
        observations = {
            business_id: {
                "profile_visits": 0,
                "saves": 0,
                "distinct_savers": 0,
            }
            for business_id in self.metrics
        }
        with patch.object(self, "metrics", observations):
            report = self.report(attention_mode="discovery")
        self.assertEqual(
            report["metric_maxima"],
            {"profile_visits": 0, "saves": 0, "distinct_savers": 0},
        )

    def report(self, **options):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=self.mongo_metrics):
            return BusinessAttentionService.get_report(self.period, **options)

    def test_valid_support_counts_active_evidence_not_cached_totals_or_people_per_tag(self):
        report = self.report()
        first = next(row for row in report["items"] if row["business_id"] == self.businesses[0].pk)
        self.assertEqual(first["valid_vouches"], 10)
        self.assertEqual(first["distinct_supporters"], 5)
        self.assertEqual(len(report["items"]), 4)
        self.assertNotIn("discovery_score", first)

    def test_full_population_ordering_retains_zero_visit_rows_and_stable_ties(self):
        report = self.report()
        self.assertEqual([row["business_id"] for row in report["items"]],
                         [self.businesses[index].pk for index in (1, 0, 3, 2)])
        self.metrics[self.businesses[1].pk]["profile_visits"] = 4
        tied = self.report(ordering="-profile_visits")
        self.assertEqual([row["business_id"] for row in tied["items"][:2]],
                         [self.businesses[index].pk for index in (0, 1)])

    def test_filters_and_inconsistent_classification_are_validated(self):
        self.assertEqual(len(self.report(cluster=self.cluster_b.pk)["items"]), 1)
        self.assertEqual(len(self.report(category=self.category_a.pk)["items"]), 3)
        self.assertEqual(self.report(category=self.empty_category.pk)["items"], [])
        for options in ({"cluster": 999999}, {"category": 999999},
                        {"cluster": self.cluster_a.pk, "category": self.category_b.pk}, {"ordering": "discovery_score"}):
            with self.subTest(options=options), self.assertRaises(ValidationError):
                self.report(**options)

    def test_fixed_window_excludes_today_and_cannot_use_selected_period(self):
        short = resolve_period(preset="7", now=self.NOW)
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=self.mongo_metrics) as read:
            report = BusinessAttentionService.get_report(short, low_exposure=True, ordering="profile_visits")
        self.assertEqual(read.call_args.kwargs["start_time"], datetime(2026, 9, 11, 16, tzinfo=UTC))
        self.assertEqual(read.call_args.kwargs["end_time"], datetime(2026, 10, 11, 16, tzinfo=UTC))
        self.assertEqual([row["business_id"] for row in report["items"]],
                         [self.businesses[index].pk for index in (2, 0)])
        self.assertEqual(report["thresholds"]["window_days"], 30)
        self.assertEqual(report["selection_status"], "provisional")

    def test_configuration_is_consumed_from_admin_policy_and_reflected_in_response(self):
        admin = self.user("policy-admin", User.UserRole.SUPER_ADMIN)
        AnalyticsPolicyService.update(
            actor=admin, expected_version=1, reason="Test configurable visit limit",
            values={"low_exposure_max_profile_visits": 5},
        )
        report = self.report(low_exposure=True)
        self.assertEqual(len(report["items"]), 2)
        self.assertEqual(report["thresholds"]["window_days"], 30)
        self.assertEqual(report["thresholds"]["max_profile_visits"], 5)
        self.assertEqual(report["thresholds"]["min_distinct_supporters"], 5)
        self.assertEqual(report["thresholds"]["policy_version"], 2)

    def test_visit_and_support_cutoffs_are_independently_inclusive(self):
        target = self.businesses[0].pk
        self.assertIn(target, [row["business_id"] for row in self.report(low_exposure=True)["items"]])
        self.metrics[target]["profile_visits"] = 5
        self.assertNotIn(target, [row["business_id"] for row in self.report(low_exposure=True)["items"]])
        self.metrics[target]["profile_visits"] = 4
        BusinessVouch.objects.filter(BUSN_ID=target, USER_ID=self.supporters[4]).update(VOUCH_EVIDENCE_IS_VALID=False)
        self.assertNotIn(target, [row["business_id"] for row in self.report(low_exposure=True)["items"]])

    def test_new_business_history_is_disclosed_and_no_observation_business_is_excluded(self):
        Business.objects.filter(pk=self.businesses[0].pk).update(BUSN_CREATED_AT=self.NOW - timedelta(days=5))
        report = self.report(low_exposure=True)
        first = next(row for row in report["items"] if row["business_id"] == self.businesses[0].pk)
        self.assertFalse(first["has_full_business_window"])
        self.assertLess(first["business_window_days"], 30)
        Business.objects.filter(pk=self.businesses[0].pk).update(BUSN_CREATED_AT=self.NOW)
        self.assertNotIn(self.businesses[0].pk, [row["business_id"] for row in self.report(low_exposure=True)["items"]])

    def test_failed_tracking_does_not_classify_low_attention_or_fake_visibility_order(self):
        with patch.object(VisibilityEventService, "get_business_attention_metrics", side_effect=VisibilityTrackingUnavailable()):
            low = BusinessAttentionService.get_report(self.period, low_exposure=True)
            attention = BusinessAttentionService.get_report(self.period)
            sql_order = BusinessAttentionService.get_report(self.period, ordering="-distinct_supporters")
        self.assertIsNone(low["items"])
        self.assertEqual(low["selection_status"], "unavailable")
        self.assertIsNone(attention["items"])
        self.assertEqual(len(sql_order["items"]), 4)
        self.assertIsNone(sql_order["items"][0]["profile_visits"])
        self.assertEqual(sql_order["items"][0]["distinct_supporters"], 6)

    def test_readable_unverified_discovery_ranks_even_small_populations(self):
        report = self.report(attention_mode="discovery")
        self.assertEqual(
            [row["business_id"] for row in report["items"]],
            [self.businesses[index].pk for index in (2, 3, 0, 1)],
        )
        self.assertEqual(report["selection_status"], "provisional")
        self.assertFalse(report["meta"]["coverage_verified"])
        narrow = self.report(category=self.category_b.pk, attention_mode="discovery")
        self.assertEqual(len(narrow["items"]), 1)

    def test_discovery_missing_or_failed_observations_remain_unavailable(self):
        target = self.businesses[0].pk
        observations = [None, {}, {**self.metrics, target: None}]
        for signal in ("profile_visits", "saves", "distinct_savers"):
            observations.append({
                **self.metrics,
                target: {**self.metrics[target], signal: None},
            })
        for metrics in observations:
            with self.subTest(metrics=metrics), patch.object(
                BusinessAttentionService,
                "read_visibility",
                return_value=(metrics, {"availability": "available", "coverage_verified": False}),
            ):
                report = BusinessAttentionService.get_report(
                    self.period,
                    attention_mode="discovery",
                    ordering="profile_visits",
                )
                self.assertIsNone(report["items"])
                self.assertEqual(report["selection_status"], "unavailable")
                self.assertEqual(report["meta"]["availability"], "unavailable")
        with patch.object(
            VisibilityEventService,
            "get_business_attention_metrics",
            side_effect=VisibilityTrackingUnavailable(),
        ):
            report = BusinessAttentionService.get_report(
                self.period,
                attention_mode="discovery",
            )
        self.assertIsNone(report["items"])

    def test_support_ranks_positive_and_zero_evidence(self):
        report = self.report(attention_mode="support")
        self.assertEqual(
            [row["business_id"] for row in report["items"]],
            [self.businesses[index].pk for index in (3, 1, 2, 0)],
        )
        self.assertEqual(report["items"][0]["attention_reason"], "No valid specialty endorsements")

    def test_discovery_uses_all_tie_breakers_and_retains_high_activity_and_new_businesses(self):
        observations = {
            self.businesses[0].pk: {"profile_visits": 3, "saves": 2, "distinct_savers": 2},
            self.businesses[1].pk: {"profile_visits": 3, "saves": 2, "distinct_savers": 1},
            self.businesses[2].pk: {"profile_visits": 3, "saves": 1, "distinct_savers": 1},
            self.businesses[3].pk: {"profile_visits": 73, "saves": 11, "distinct_savers": 8},
        }
        Business.objects.filter(pk=self.businesses[3].pk).update(BUSN_CREATED_AT=self.NOW)
        with patch.object(BusinessAttentionService, "read_visibility", return_value=(
            observations, {"availability": "available", "coverage_verified": False},
        )):
            report = BusinessAttentionService.get_report(self.period, attention_mode="discovery")
        self.assertEqual(
            [row["business_id"] for row in report["items"]],
            [self.businesses[index].pk for index in (2, 1, 0, 3)],
        )
        self.assertFalse(report["items"][-1]["has_full_business_window"])
        self.assertEqual(report["items"][-1]["attention_reason"], "Ranked by recorded discovery activity")
        observations[self.businesses[0].pk] = observations[self.businesses[1].pk].copy()
        with patch.object(BusinessAttentionService, "read_visibility", return_value=(
            observations, {"availability": "available", "coverage_verified": True},
        )):
            tied = BusinessAttentionService.get_report(self.period, attention_mode="discovery")
        self.assertEqual(
            [row["business_id"] for row in tied["items"]],
            [self.businesses[index].pk for index in (2, 0, 1, 3)],
        )

    def test_support_uses_supporter_then_identity_ties_without_discovery(self):
        support = {
            self.businesses[0].pk: {"valid_vouches": 2, "distinct_supporters": 2},
            self.businesses[1].pk: {"valid_vouches": 2, "distinct_supporters": 1},
            self.businesses[2].pk: {"valid_vouches": 2, "distinct_supporters": 1},
            self.businesses[3].pk: {"valid_vouches": 0, "distinct_supporters": 0},
        }
        with patch.object(BusinessAttentionService, "specialty_support", return_value=support), patch.object(
            BusinessAttentionService,
            "read_visibility",
            return_value=(None, {"availability": "unavailable"}),
        ):
            report = BusinessAttentionService.get_report(self.period, attention_mode="support")
        self.assertEqual(
            [row["business_id"] for row in report["items"]],
            [self.businesses[index].pk for index in (3, 1, 2, 0)],
        )
        self.assertIsNone(report["items"][0]["profile_visits"])
