from datetime import timedelta

from django.test import TestCase

from apps.business.models import BusinessVouch
from apps.shared.analytics.date_ranges import resolve_period

from ..premium_specialty_service import PremiumSpecialtyService
from ..standard_analytics_service import StandardAnalyticsService
from .fixtures import MerchantAnalyticsFixtures


class PremiumSpecialtyServiceTests(MerchantAnalyticsFixtures, TestCase):
    def test_presets_select_retained_additions_without_changing_current_support(self):
        """Honor each selected period while current support remains a separate snapshot."""
        self.vouch(
            self.tags[0],
            self.supporter_a,
            self.NOW - timedelta(days=2),
        )
        self.vouch(
            self.tags[1],
            self.supporter_b,
            self.NOW - timedelta(days=20),
        )
        for preset, expected, expected_change in (
            ("7", 1, 1),
            ("30", 2, 2),
            ("90", 2, 2),
        ):
            with self.subTest(period=preset):
                period = resolve_period(
                    preset=preset,
                    now=self.NOW,
                )
                standard = StandardAnalyticsService.get_report(
                    self.merchant_a,
                    period,
                )
                plus = PremiumSpecialtyService.get_report(
                    self.merchant_a,
                    period,
                )
                self.assertEqual(standard["vouches_added_and_still_valid"], expected)
                self.assertEqual(standard["current_valid_vouches"], 2)
                self.assertEqual(plus["vouches_added_change"]["value"], expected_change)

    def test_retained_additions_compare_adjacent_periods_and_match_standard(self):
        """Use one current eligibility scope with inclusive starts and exclusive ends."""
        self.vouch(
            self.tags[0],
            self.supporter_a,
            self.period.previous_start,
        )
        self.vouch(
            self.tags[1],
            self.supporter_a,
            self.period.start,
        )
        self.vouch(
            self.tags[0],
            self.supporter_b,
            self.period.end - timedelta(microseconds=1),
        )
        self.vouch(
            self.tags[1],
            self.supporter_b,
            self.period.end,
        )
        self.vouch(
            self.tags[2],
            self.supporter_b,
            self.period.start,
        )
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        standard = StandardAnalyticsService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["vouches_added_and_still_valid"], 2)
        self.assertEqual(report["previous_vouches_added_and_still_valid"], 1)
        self.assertEqual(standard["vouches_added_and_still_valid"], 2)
        self.assertEqual(
            report["vouches_added_change"],
            {
                "value": 1,
                "direction": "up",
                "unit": "count",
                "reason": None,
            },
        )

    def test_removal_invalidation_and_recreation_revise_retained_cohorts(self):
        """Never count deleted or invalid evidence as immutable historical additions."""
        removed = self.vouch(
            self.tags[0],
            self.supporter_a,
            self.period.previous_start,
        )
        invalid = self.vouch(
            self.tags[1],
            self.supporter_b,
            self.period.start,
        )
        removed.delete()
        BusinessVouch.objects.filter(
            pk=invalid.pk,
        ).update(
            VOUCH_EVIDENCE_IS_VALID=False,
        )
        self.vouch(
            self.tags[0],
            self.supporter_a,
            self.period.start,
        )
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["vouches_added_and_still_valid"], 1)
        self.assertEqual(report["previous_vouches_added_and_still_valid"], 0)
        self.assertEqual(report["vouches_added_change"]["value"], 1)
        self.business_a.specialty_tag_links.filter(
            TAG_ID=self.tags[0],
        ).update(
            BST_IS_ACTIVE=False,
        )
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["vouches_added_and_still_valid"], 0)
        self.assertEqual(report["vouches_added_change"]["value"], 0)

    def test_empty_retained_cohorts_have_a_defined_zero_count_change(self):
        """Allow zero baselines without inventing percentage growth."""
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["vouches_added_change"]["value"], 0)
        self.assertEqual(report["vouches_added_change"]["direction"], "unchanged")

    def vouch(self, tag, user, timestamp, *, valid=True, business=None):
        row = BusinessVouch.objects.create(
            BUSN_ID=business or self.business_a, TAG_ID=tag, USER_ID=user,
            VOUCH_REPUTATION_SNAPSHOT=user.USER_REPUTATION, VOUCH_EVIDENCE_IS_VALID=valid,
            VOUCH_FLAG_SUSPICIOUS=True,
        )
        BusinessVouch.objects.filter(pk=row.pk).update(VOUCH_CREATED_AT=timestamp)
        return row

    def test_only_current_active_specialties_and_valid_period_rows_are_included(self):
        self.vouch(self.tags[0], self.supporter_a, self.period.start)
        self.vouch(self.tags[0], self.supporter_b, self.period.start, valid=False)
        self.vouch(self.tags[1], self.supporter_a, self.period.start - timedelta(seconds=1))
        self.vouch(self.tags[1], self.supporter_b, self.period.end)
        self.vouch(self.tags[2], self.supporter_b, self.period.start)
        self.vouch(self.tags[0], self.supporter_a, self.period.start, business=self.business_b)
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["label"], "Added and still valid")
        self.assertEqual([(row["added_and_still_valid"], row["distinct_supporters"]) for row in report["specialties"]], [(1, 1), (0, 0)])
        self.assertIn("vouch_removal_history_unavailable", report["meta"]["partial_reasons"])

    def test_unvouch_disappears_instead_of_becoming_a_negative_history_event(self):
        row = self.vouch(self.tags[0], self.supporter_a, self.NOW - timedelta(days=1))
        self.assertEqual(PremiumSpecialtyService.get_report(self.merchant_a, self.period)["specialties"][0]["added_and_still_valid"], 1)
        row.delete()
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        self.assertEqual(report["specialties"][0]["added_and_still_valid"], 0)
        self.assertTrue(all(bucket["added_and_still_valid"] == 0 for bucket in report["specialties"][0]["series"]))

    def test_supporters_are_distinct_per_specialty_and_not_pooled_across_tags(self):
        for tag in self.tags[:2]:
            self.vouch(tag, self.supporter_a, self.NOW - timedelta(days=1))
        report = PremiumSpecialtyService.get_report(self.merchant_a, self.period)
        self.assertTrue(all(row["distinct_supporters"] == 1 for row in report["specialties"]))
        for row in report["specialties"]:
            nonempty = [bucket for bucket in row["series"] if bucket["added_and_still_valid"]]
            self.assertEqual(nonempty[0]["date"], "2026-10-12")
