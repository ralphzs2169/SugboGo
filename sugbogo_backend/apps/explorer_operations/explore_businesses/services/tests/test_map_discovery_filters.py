from datetime import datetime, time, timezone as datetime_timezone
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.models import (
    BusinessOperatingHours,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    SpecialtyTag,
)

from .map_discovery_test_mixin import MapDiscoveryTestMixin


class MapDiscoveryFilterTests(MapDiscoveryTestMixin, APITestCase):
    """Verify taxonomy, global gems, compact selection, and Cebu weekly hours."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.explorer)
        self.url = reverse("map-discovery")

    def result_ids(
        self,
        **filters,
    ):
        response = self.client.get(
            self.url,
            {
                **self.bounds,
                **filters,
            },
        )
        self.assertEqual(response.status_code, 200)
        return [
            item["id"]
            for item in response.data["data"]["items"]
        ]

    def test_shared_taxonomy_semantics_and_active_specialty_assignments(self):
        matching = self.create_business()
        wrong_category = self.create_business()
        other_cluster = Cluster.objects.create(
            CLUS_NAME="Other Map Cluster",
        )
        other_category = Category.objects.create(
            CTGRY_NAME="Other Map Category",
            CLUS_ID=other_cluster,
        )
        wrong_category.CTGRY_ID = other_category
        wrong_category.save()
        inactive_specialty = self.create_business()
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Map Specialty Filter",
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=matching,
            TAG_ID=tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=inactive_specialty,
            TAG_ID=tag,
            BST_IS_ACTIVE=False,
        )
        self.assertEqual(
            self.result_ids(
                cluster=self.cluster.CLUS_ID,
                category=[self.category.CTGRY_ID, other_category.CTGRY_ID],
                specialty_tag=tag.TAG_ID,
            ),
            [matching.BUSN_ID],
        )
        self.assertCountEqual(
            self.result_ids(
                category=[self.category.CTGRY_ID, other_category.CTGRY_ID],
            ),
            [matching.BUSN_ID, wrong_category.BUSN_ID, inactive_specialty.BUSN_ID],
        )

    def test_filters_do_not_promote_an_outsider_into_global_gems(self):
        for _ in range(10):
            self.create_business(
                longitude=125,
                score="1.00000",
            )
        outsider = self.create_business(
            score="0.10000",
        )
        self.assertEqual(
            self.result_ids(
                cluster=self.cluster.CLUS_ID,
                hidden_gems=True,
            ),
            [],
        )
        self.assertEqual(
            self.result_ids(
                cluster=self.cluster.CLUS_ID,
                hidden_gems=False,
            ),
            [outsider.BUSN_ID],
        )

    @override_settings(MAP_DISCOVERY_MAX_MARKERS=1)
    def test_compact_business_lookup_is_not_lost_to_the_marker_page_limit(self):
        self.create_business()
        selected = self.create_business()
        self.assertEqual(
            self.result_ids(
                business=selected.BUSN_ID,
            ),
            [selected.BUSN_ID],
        )
        self.assertEqual(
            self.result_ids(
                business=999999,
            ),
            [],
        )

    def test_new_filter_values_follow_existing_validation_envelope(self):
        for field, value in (
            ("cluster", "bad"),
            ("category", [0]),
            ("specialty_tag", -1),
            ("hidden_gems", "bad"),
            ("open_now", "bad"),
            ("business", 0),
        ):
            with self.subTest(field=field):
                response = self.client.get(
                    self.url,
                    {
                        **self.bounds,
                        field: value,
                    },
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertIn(field, response.data["errors"])

    def scheduled_business(
        self,
        day,
        opening=None,
        closing=None,
        all_day=False,
        is_open=True,
    ):
        business = self.create_business()
        BusinessOperatingHours.objects.create(
            BUSN_ID=business,
            BOHR_DAY=day,
            BOHR_IS_OPEN=is_open,
            BOHR_IS_24_HOURS=all_day,
            BOHR_OPEN_TIME=opening,
            BOHR_CLOSE_TIME=closing,
        )
        return business

    def test_open_now_uses_manila_day_and_previous_sunday_overnight(self):
        overnight = self.scheduled_business(
            "sunday",
            time(22),
            time(2),
        )
        all_day = self.scheduled_business(
            "monday",
            all_day=True,
        )
        self.scheduled_business(
            "sunday",
            all_day=True,
        )
        self.scheduled_business(
            "monday",
            time(8),
            time(17),
        )
        self.scheduled_business(
            "monday",
            is_open=False,
        )
        self.scheduled_business(
            "monday",
        )
        self.create_business()
        # 17:00 Sunday UTC is 01:00 Monday in Cebu.
        with patch(
            "apps.explorer_operations.explore_businesses.services.operating_hours_filter_service.timezone.now",
            return_value=datetime(2026, 10, 11, 17, tzinfo=datetime_timezone.utc),
        ):
            self.assertCountEqual(
                self.result_ids(
                    open_now=True,
                ),
                [overnight.BUSN_ID, all_day.BUSN_ID],
            )

    def test_opening_is_inclusive_closing_is_exclusive_and_overnight_starts_today(self):
        daytime = self.scheduled_business(
            "monday",
            time(8),
            time(17),
        )
        overnight = self.scheduled_business(
            "monday",
            time(22),
            time(2),
        )
        for utc_hour, expected in (
            (0, [daytime.BUSN_ID]),
            (9, []),
            (14, [overnight.BUSN_ID]),
        ):
            with self.subTest(utc_hour=utc_hour):
                with patch(
                    "apps.explorer_operations.explore_businesses.services.operating_hours_filter_service.timezone.now",
                    return_value=datetime(2026, 10, 12, utc_hour, tzinfo=datetime_timezone.utc),
                ):
                    self.assertEqual(
                        self.result_ids(
                            open_now=True,
                        ),
                        expected,
                    )
