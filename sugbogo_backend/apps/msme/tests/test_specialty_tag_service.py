from django.http import Http404
from django.test import TestCase

from apps.msme.models import SpecialtyTag
from apps.msme.services.specialty_tag_service import SpecialtyTagService


class SpecialtyTagServiceTests(TestCase):
    def setUp(self):
        self.tag = SpecialtyTag.objects.create(
            TAG_NAME="Eco Friendly",
        )

        self.other_tag = SpecialtyTag.objects.create(
            TAG_NAME="White Sand",
        )

        self.third_tag = SpecialtyTag.objects.create(
            TAG_NAME="Heritage",
        )

    def test_list_specialty_tags_returns_all_tags(self):
        tags = SpecialtyTagService.list_specialty_tags()

        self.assertEqual(tags.count(), 3)

    def test_list_specialty_tags_filters_by_name(self):
        tags = SpecialtyTagService.list_specialty_tags(
            search="eco",
        )

        self.assertEqual(tags.count(), 1)
        self.assertEqual(
            tags.first().TAG_NAME,
            "Eco Friendly",
        )

    def test_list_specialty_tags_defaults_to_name_ordering(self):
        tags = SpecialtyTagService.list_specialty_tags()

        self.assertEqual(
            list(tags.values_list("TAG_NAME", flat=True)),
            [
                "Eco Friendly",
                "Heritage",
                "White Sand",
            ],
        )

    def test_list_specialty_tags_orders_by_name_descending(self):
        tags = SpecialtyTagService.list_specialty_tags(
            ordering="-name",
        )

        self.assertEqual(
            list(tags.values_list("TAG_NAME", flat=True)),
            [
                "White Sand",
                "Heritage",
                "Eco Friendly",
            ],
        )

    def test_list_specialty_tags_orders_by_created_at(self):
        tags = SpecialtyTagService.list_specialty_tags(
            ordering="created_at",
        )

        self.assertEqual(
            list(tags.values_list("TAG_ID", flat=True)),
            [
                self.tag.TAG_ID,
                self.other_tag.TAG_ID,
                self.third_tag.TAG_ID,
            ],
        )

    def test_list_specialty_tags_orders_by_created_at_descending(self):
        tags = SpecialtyTagService.list_specialty_tags(
            ordering="-created_at",
        )

        self.assertEqual(
            list(tags.values_list("TAG_ID", flat=True)),
            [
                self.third_tag.TAG_ID,
                self.other_tag.TAG_ID,
                self.tag.TAG_ID,
            ],
        )

    def test_list_specialty_tags_orders_by_updated_at(self):
        tags = SpecialtyTagService.list_specialty_tags(
            ordering="updated_at",
        )

        self.assertEqual(
            list(tags.values_list("TAG_ID", flat=True)),
            [
                self.tag.TAG_ID,
                self.other_tag.TAG_ID,
                self.third_tag.TAG_ID,
            ],
        )

    def test_list_specialty_tags_orders_by_updated_at_descending(self):
        tags = SpecialtyTagService.list_specialty_tags(
            ordering="-updated_at",
        )

        self.assertEqual(
            list(tags.values_list("TAG_ID", flat=True)),
            [
                self.third_tag.TAG_ID,
                self.other_tag.TAG_ID,
                self.tag.TAG_ID,
            ],
        )

    def test_list_specialty_tags_uses_name_ordering_for_invalid_ordering(self):
        tags = SpecialtyTagService.list_specialty_tags(
            ordering="invalid",
        )

        self.assertEqual(
            list(tags.values_list("TAG_NAME", flat=True)),
            [
                "Eco Friendly",
                "Heritage",
                "White Sand",
            ],
        )

    def test_get_specialty_tag_returns_tag(self):
        tag = SpecialtyTagService.get_specialty_tag(
            self.tag.TAG_ID,
        )

        self.assertEqual(
            tag.TAG_ID,
            self.tag.TAG_ID,
        )

        self.assertEqual(
            tag.TAG_NAME,
            "Eco Friendly",
        )

    def test_get_specialty_tag_raises_404_when_not_found(self):
        with self.assertRaises(Http404):
            SpecialtyTagService.get_specialty_tag(9999)

    def test_create_specialty_tag_strips_name(self):
        tag = SpecialtyTagService.create_specialty_tag(
            {
                "TAG_NAME": "  Mountain View  ",
            }
        )

        self.assertEqual(
            tag.TAG_NAME,
            "Mountain View",
        )

    def test_create_specialty_tag_creates_tag(self):
        tag = SpecialtyTagService.create_specialty_tag(
            {
                "TAG_NAME": "Local Crafts",
            }
        )

        self.assertTrue(
            SpecialtyTag.objects.filter(
                TAG_ID=tag.TAG_ID,
            ).exists()
        )

        self.assertEqual(
            tag.TAG_NAME,
            "Local Crafts",
        )

    def test_update_specialty_tag_strips_name(self):
        SpecialtyTagService.update_specialty_tag(
            self.tag,
            {
                "TAG_NAME": "  Sustainable  ",
            },
        )

        self.tag.refresh_from_db()

        self.assertEqual(
            self.tag.TAG_NAME,
            "Sustainable",
        )

    def test_update_specialty_tag_updates_name(self):
        SpecialtyTagService.update_specialty_tag(
            self.tag,
            {
                "TAG_NAME": "Nature Friendly",
            },
        )

        self.tag.refresh_from_db()

        self.assertEqual(
            self.tag.TAG_NAME,
            "Nature Friendly",
        )

    def test_delete_specialty_tag_deletes_tag(self):
        tag_id = self.tag.TAG_ID

        SpecialtyTagService.delete_specialty_tag(
            self.tag,
        )

        self.assertFalse(
            SpecialtyTag.objects.filter(
                TAG_ID=tag_id,
            ).exists()
        )