from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from apps.explorer_operations.explore_businesses.services.explore_specialty_tag_service import (
    ExploreSpecialtyService,
)
from django.test import SimpleTestCase


class ExploreSpecialtyServiceTests(SimpleTestCase):
    """Tests rotating Specialty Tag selection for Explorer discovery."""

    def make_specialty(self, tag_id, business_count):
        return SimpleNamespace(
            TAG_ID=tag_id,
            business_count=business_count,
        )

    def configure_specialties(self, mock_annotate, specialties):
        queryset = mock_annotate.return_value
        queryset.filter.return_value = specialties

        return queryset

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_returns_empty_list_when_no_specialties_have_businesses(
        self,
        mock_annotate,
        mock_localdate,
    ):
        self.configure_specialties(
            mock_annotate,
            [],
        )

        result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(result, [])

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_requests_only_specialties_with_at_least_one_business(
        self,
        mock_annotate,
        mock_localdate,
    ):
        queryset = self.configure_specialties(
            mock_annotate,
            [],
        )

        ExploreSpecialtyService.list_specialties()

        queryset.filter.assert_called_once_with(
            business_count__gte=1,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_returns_all_available_specialties_when_fewer_than_limit_exist(
        self,
        mock_annotate,
        mock_localdate,
    ):
        specialties = [
            self.make_specialty(1, 2),
            self.make_specialty(2, 1),
            self.make_specialty(3, 1),
        ]

        self.configure_specialties(
            mock_annotate,
            specialties,
        )

        result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(
            [specialty.TAG_ID for specialty in result],
            [1, 2, 3],
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_prefers_tags_with_at_least_three_businesses(
        self,
        mock_annotate,
        mock_localdate,
    ):
        preferred = [
            self.make_specialty(tag_id, 3)
            for tag_id in range(1, 7)
        ]

        fallback = [
            self.make_specialty(7, 2),
            self.make_specialty(8, 1),
        ]

        self.configure_specialties(
            mock_annotate,
            [*preferred, *fallback],
        )

        result = ExploreSpecialtyService.list_specialties()

        result_ids = {
            specialty.TAG_ID
            for specialty in result
        }

        self.assertEqual(len(result), 6)

        self.assertEqual(
            result_ids,
            {1, 2, 3, 4, 5, 6},
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_fallback_tags_fill_remaining_slots(
        self,
        mock_annotate,
        mock_localdate,
    ):
        specialties = [
            self.make_specialty(1, 5),
            self.make_specialty(2, 4),
            self.make_specialty(3, 3),
            self.make_specialty(4, 2),
            self.make_specialty(5, 2),
            self.make_specialty(6, 1),
        ]

        self.configure_specialties(
            mock_annotate,
            specialties,
        )

        result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(len(result), 6)

        self.assertEqual(
            {specialty.TAG_ID for specialty in result},
            {1, 2, 3, 4, 5, 6},
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_never_returns_more_than_display_limit(
        self,
        mock_annotate,
        mock_localdate,
    ):
        specialties = [
            self.make_specialty(tag_id, 5)
            for tag_id in range(1, 11)
        ]

        self.configure_specialties(
            mock_annotate,
            specialties,
        )

        result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(
            len(result),
            ExploreSpecialtyService.DISPLAY_LIMIT,
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_final_selection_is_sorted_by_business_count_descending(
        self,
        mock_annotate,
        mock_localdate,
    ):
        specialties = [
            self.make_specialty(1, 3),
            self.make_specialty(2, 8),
            self.make_specialty(3, 4),
            self.make_specialty(4, 7),
            self.make_specialty(5, 5),
            self.make_specialty(6, 6),
        ]

        self.configure_specialties(
            mock_annotate,
            specialties,
        )

        result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(
            [specialty.business_count for specialty in result],
            [8, 7, 6, 5, 4, 3],
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_equal_business_counts_are_sorted_by_tag_id(
        self,
        mock_annotate,
        mock_localdate,
    ):
        specialties = [
            self.make_specialty(5, 4),
            self.make_specialty(2, 4),
            self.make_specialty(8, 4),
        ]

        self.configure_specialties(
            mock_annotate,
            specialties,
        )

        result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(
            [specialty.TAG_ID for specialty in result],
            [2, 5, 8],
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_selection_is_stable_during_same_day(
        self,
        mock_annotate,
        mock_localdate,
    ):
        specialties = [
            self.make_specialty(tag_id, 3)
            for tag_id in range(1, 10)
        ]

        self.configure_specialties(
            mock_annotate,
            specialties,
        )

        first_result = ExploreSpecialtyService.list_specialties()
        second_result = ExploreSpecialtyService.list_specialties()

        self.assertEqual(
            [specialty.TAG_ID for specialty in first_result],
            [specialty.TAG_ID for specialty in second_result],
        )

    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.timezone.localdate",
        return_value=date(2026, 9, 11),
    )
    @patch(
        "apps.explorer_operations.explore_businesses.services."
        "explore_specialty_tag_service.SpecialtyTag.objects.annotate",
    )
    def test_fallback_tags_do_not_replace_preferred_tags(
        self,
        mock_annotate,
        mock_localdate,
    ):
        preferred = [
            self.make_specialty(1, 3),
            self.make_specialty(2, 3),
            self.make_specialty(3, 3),
            self.make_specialty(4, 3),
            self.make_specialty(5, 3),
        ]

        fallback = [
            self.make_specialty(6, 2),
            self.make_specialty(7, 2),
            self.make_specialty(8, 1),
        ]

        self.configure_specialties(
            mock_annotate,
            [*preferred, *fallback],
        )

        result = ExploreSpecialtyService.list_specialties()

        result_ids = {
            specialty.TAG_ID
            for specialty in result
        }

        for specialty in preferred:
            self.assertIn(
                specialty.TAG_ID,
                result_ids,
            )

        fallback_count = sum(
            specialty.TAG_ID in {6, 7, 8}
            for specialty in result
        )

        self.assertEqual(fallback_count, 1)