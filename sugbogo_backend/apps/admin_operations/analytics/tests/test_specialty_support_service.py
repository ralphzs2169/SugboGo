"""Valid current evidence and global supporter deduplication across specialty tags."""

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase

from apps.admin_operations.analytics.services.specialty_support_service import SpecialtySupportService
from apps.business.models import BusinessSpecialtyTag, BusinessVouch, SpecialtyTag

from .reporting_fixtures import ReportingFixtures


class SpecialtySupportServiceTests(ReportingFixtures, TestCase):
    def tag(
        self,
        business,
        name,
        active=True,
    ):
        tag = SpecialtyTag.objects.create(TAG_NAME=name)
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=business,
            TAG_ID=tag,
            BST_IS_ACTIVE=active,
        )
        return tag

    def vouch(
        self,
        business,
        tag,
        supporter,
        **fields,
    ):
        return BusinessVouch.objects.create(
            BUSN_ID=business,
            TAG_ID=tag,
            USER_ID=supporter,
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.20"),
            **fields,
        )

    def test_empty_support_is_current_and_has_no_comparison(self):
        report = SpecialtySupportService.get_report(self.period)
        self.assertEqual(
            report["summary"]["valid_vouches"],
            0,
        )
        self.assertEqual(
            report["specialties"],
            [],
        )
        self.assertFalse(report["selected_period_applies"])
        self.assertNotIn(
            "previous_value",
            report,
        )

    def test_one_supporter_across_two_tags_is_two_endorsements_but_one_person(self):
        business = self.make_business()
        supporter = self.make_user()
        first = self.tag(
            business,
            "First",
        )
        second = self.tag(
            business,
            "Second",
        )
        self.vouch(
            business,
            first,
            supporter,
        )
        self.vouch(
            business,
            second,
            supporter,
        )
        with self.assertNumQueries(2):
            report = SpecialtySupportService.get_report(self.period)
        self.assertEqual(report["summary"], {
            "valid_vouches": 2,
            "distinct_supporters": 1,
            "supported_businesses": 1,
            "supported_specialties": 2,
        })
        self.assertEqual(
            sum(row["distinct_supporters"] for row in report["specialties"]),
            2,
        )
        self.assertEqual(
            report["top_supported_specialties"],
            report["specialties"],
        )

    def test_withdrawn_invalid_inactive_and_unassigned_evidence_are_excluded(self):
        business = self.make_business()
        active = self.tag(
            business,
            "Active",
        )
        inactive = self.tag(
            business,
            "Inactive",
            active=False,
        )
        unassigned = SpecialtyTag.objects.create(TAG_NAME="Unassigned")
        self.vouch(
            business,
            active,
            self.make_user(),
            VOUCH_WITHDRAWN_AT=self.NOW,
        )
        self.vouch(
            business,
            active,
            self.make_user(),
            VOUCH_EVIDENCE_IS_VALID=False,
        )
        self.vouch(
            business,
            inactive,
            self.make_user(),
        )
        self.vouch(
            business,
            unassigned,
            self.make_user(),
        )
        self.vouch(
            business,
            active,
            self.make_user(),
            VOUCH_FLAG_SUSPICIOUS=True,
        )
        report = SpecialtySupportService.get_report(self.period)
        self.assertEqual(
            report["summary"]["valid_vouches"],
            1,
        )
        self.assertEqual(
            report["summary"]["supported_specialties"],
            1,
        )
        self.assertEqual(
            report["specialties"][0]["name"],
            "Active",
        )

    def test_global_businesses_and_people_are_distinct_across_business_tag_groups(self):
        business = self.make_business()
        other = self.make_business(status="suspended")
        tag = self.tag(
            business,
            "Shared",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=other,
            TAG_ID=tag,
        )
        supporter = self.make_user()
        self.vouch(
            business,
            tag,
            supporter,
        )
        self.vouch(
            other,
            tag,
            supporter,
        )
        report = SpecialtySupportService.get_report(self.period)
        self.assertEqual(
            report["summary"]["valid_vouches"],
            2,
        )
        self.assertEqual(
            report["summary"]["distinct_supporters"],
            1,
        )
        self.assertEqual(
            report["summary"]["supported_businesses"],
            2,
        )
        self.assertEqual(
            report["specialties"][0]["supported_businesses"],
            2,
        )

    def test_future_evidence_and_future_assignments_do_not_enter_snapshot(self):
        business = self.make_business()
        tag = self.tag(
            business,
            "Future",
        )
        vouch = self.vouch(
            business,
            tag,
            self.make_user(),
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(VOUCH_CREATED_AT=self.NOW + timedelta(days=1))
        self.assertEqual(
            SpecialtySupportService.get_report(self.period)["summary"]["valid_vouches"],
            0,
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(VOUCH_CREATED_AT=self.NOW)
        BusinessSpecialtyTag.objects.filter(BUSN_ID=business).update(
            BST_CREATED_AT=self.NOW + timedelta(days=1),
        )
        self.assertEqual(
            SpecialtySupportService.get_report(self.period)["summary"]["valid_vouches"],
            0,
        )

    def test_top_supported_specialties_use_evidence_order_and_stable_ties(self):
        business = self.make_business()
        first = self.tag(
            business,
            "First",
        )
        second = self.tag(
            business,
            "Second",
        )
        supporter = self.make_user()
        self.vouch(
            business,
            first,
            supporter,
        )
        self.vouch(
            business,
            second,
            supporter,
        )
        self.vouch(
            business,
            second,
            self.make_user(),
        )
        report = SpecialtySupportService.get_report(self.period)
        self.assertEqual(
            [row["specialty_id"] for row in report["top_supported_specialties"]],
            [second.pk, first.pk],
        )
        self.assertEqual(
            report["top_limit"],
            10,
        )
