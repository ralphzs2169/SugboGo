from datetime import datetime, time, timezone as datetime_timezone
from decimal import Decimal

from django.test import TestCase

from apps.business.models import Business, BusinessOperatingHours, DiscoveryScore

from ..open_now_businesses_service import OpenNowBusinessesService
from .map_discovery_test_mixin import MapDiscoveryTestMixin


class OpenNowBusinessesTestMixin(MapDiscoveryTestMixin):
    """Provide nearby businesses with deterministic weekly opening hours."""

    reference_time = datetime(
        2026,
        10,
        25,
        17,
        tzinfo=datetime_timezone.utc,
    )

    def create_open_business(
        self,
        latitude=10.303,
        gap=None,
        **kwargs,
    ):
        business = self.create_business(
            latitude=latitude,
            longitude=123.9,
            **kwargs,
        )
        BusinessOperatingHours.objects.bulk_create(
            [
                BusinessOperatingHours(
                    BUSN_ID=business,
                    BOHR_DAY=day,
                    BOHR_IS_OPEN=True,
                    BOHR_IS_24_HOURS=True,
                )
                for day in BusinessOperatingHours.Day.values
            ],
        )

        if gap is not None:
            DiscoveryScore.objects.create(
                BUSN_ID=business,
                DSC_S_SCORE=Decimal("0.5"),
                DSC_D_SCORE=Decimal("0.5"),
                DSC_V_SCORE=Decimal(gap),
                DSC_COMPUTED_AT=self.reference_time,
            )

        return business

    def preview_ids(self):
        return list(
            OpenNowBusinessesService.list_open_now_businesses(
                user=self.explorer,
                latitude=10.3,
                longitude=123.9,
                at=self.reference_time,
            ).values_list(
                "BUSN_ID",
                flat=True,
            ),
        )


class OpenNowBusinessesServiceTests(OpenNowBusinessesTestMixin, TestCase):
    """Verify eligibility, geographic ordering, measured gaps, and the preview cap."""

    def test_excludes_closed_unknown_suspended_and_outside_radius(self):
        eligible = self.create_open_business()
        self.create_business()
        closed = self.create_open_business()
        closed.operating_hours.update(BOHR_IS_OPEN=False)
        incomplete = self.create_open_business()
        incomplete.operating_hours.update(BOHR_IS_24_HOURS=False)
        self.create_open_business(
            status_value=Business.BusinessStatus.SUSPENDED,
        )
        self.create_open_business(latitude=10.34)

        self.assertEqual(
            self.preview_ids(),
            [eligible.BUSN_ID],
        )

    def test_distance_bands_precede_gap_then_exact_distance_and_id(self):
        far = self.create_open_business(latitude=10.323, gap="1")
        middle = self.create_open_business(latitude=10.314, gap="1")
        near_low_gap = self.create_open_business(latitude=10.301, gap="0")
        near_high_gap = self.create_open_business(latitude=10.307, gap="0.9")
        near_high_gap_tie = self.create_open_business(latitude=10.307, gap="0.9")
        nearer_high_gap = self.create_open_business(latitude=10.305, gap="0.9")

        self.assertEqual(
            self.preview_ids(),
            [
                nearer_high_gap.BUSN_ID,
                near_high_gap.BUSN_ID,
                near_high_gap_tie.BUSN_ID,
                near_low_gap.BUSN_ID,
                middle.BUSN_ID,
                far.BUSN_ID,
            ],
        )

    def test_missing_provisional_and_uncomputed_scores_use_neutral_gap(self):
        measured_high = self.create_open_business(gap="0.8")
        missing = self.create_open_business()
        provisional = self.create_open_business(gap="1")
        DiscoveryScore.objects.filter(BUSN_ID=provisional).update(
            DSC_IS_PROVISIONAL=True,
        )
        uncomputed = self.create_open_business(gap="1")
        DiscoveryScore.objects.filter(BUSN_ID=uncomputed).update(
            DSC_COMPUTED_AT=None,
        )
        measured_low = self.create_open_business(gap="0.2")

        self.assertEqual(
            self.preview_ids(),
            [
                measured_high.BUSN_ID,
                missing.BUSN_ID,
                provisional.BUSN_ID,
                uncomputed.BUSN_ID,
                measured_low.BUSN_ID,
            ],
        )

    def test_ranks_the_full_candidate_set_before_limiting_to_six(self):
        for _ in range(8):
            self.create_open_business(gap="0.2")
        winner = self.create_open_business(gap="1")

        ids = self.preview_ids()

        self.assertEqual(len(ids), 6)
        self.assertEqual(ids[0], winner.BUSN_ID)

    def test_previous_sunday_overnight_schedule_uses_philippine_time(self):
        business = self.create_business()
        BusinessOperatingHours.objects.create(
            BUSN_ID=business,
            BOHR_DAY=BusinessOperatingHours.Day.SUNDAY,
            BOHR_IS_OPEN=True,
            BOHR_OPEN_TIME=time(23),
            BOHR_CLOSE_TIME=time(2),
        )

        self.assertEqual(self.preview_ids(), [business.BUSN_ID])
        self.reference_time = self.reference_time.replace(hour=18)
        self.assertEqual(self.preview_ids(), [])

    def test_changing_coordinates_changes_the_eligible_businesses(self):
        self.create_open_business()
        remote = self.create_open_business(latitude=10.34)
        businesses = OpenNowBusinessesService.list_open_now_businesses(
            user=self.explorer,
            latitude=10.34,
            longitude=123.9,
            at=self.reference_time,
        )

        self.assertEqual(
            [business.BUSN_ID for business in businesses],
            [remote.BUSN_ID],
        )
