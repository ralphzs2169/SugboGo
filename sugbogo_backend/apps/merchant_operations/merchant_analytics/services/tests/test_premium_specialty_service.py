from datetime import timedelta

from django.test import TestCase

from apps.business.models import BusinessVouch

from ..premium_specialty_service import PremiumSpecialtyService
from .fixtures import MerchantAnalyticsFixtures


class PremiumSpecialtyServiceTests(MerchantAnalyticsFixtures, TestCase):
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
