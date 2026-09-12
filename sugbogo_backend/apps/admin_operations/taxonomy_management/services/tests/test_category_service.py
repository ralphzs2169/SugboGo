from django.http import Http404
from django.test import TestCase

from apps.admin_operations.taxonomy_management.services.category_service import (
    CategoryService,
)
from apps.business.models import Category, Cluster


class CategoryServiceTests(TestCase):
    def setUp(self):
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food & Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        self.other_cluster = Cluster.objects.create(
            CLUS_NAME="Adventure",
            CLUS_DESCRIPTION="Adventure businesses",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve food",
            CLUS_ID=self.cluster,
        )

        self.other_category = Category.objects.create(
            CTGRY_NAME="Cafes",
            CTGRY_DESCRIPTION="Coffee and light meals",
            CLUS_ID=self.cluster,
        )

        self.adventure_category = Category.objects.create(
            CTGRY_NAME="Hiking",
            CTGRY_DESCRIPTION="Outdoor hiking activities",
            CLUS_ID=self.other_cluster,
        )

    def test_list_categories_returns_all_categories(self):
        categories = CategoryService.list_categories()

        self.assertEqual(categories.count(), 3)

    def test_list_categories_filters_by_name(self):
        categories = CategoryService.list_categories(
            search="restaurant",
        )

        self.assertEqual(categories.count(), 1)
        self.assertEqual(
            categories.first().CTGRY_NAME,
            "Restaurants",
        )

    def test_list_categories_filters_by_description(self):
        categories = CategoryService.list_categories(
            search="coffee",
        )

        self.assertEqual(categories.count(), 1)
        self.assertEqual(
            categories.first().CTGRY_NAME,
            "Cafes",
        )

    def test_list_categories_filters_by_cluster(self):
        categories = CategoryService.list_categories(
            cluster_id=self.cluster.CLUS_ID,
        )

        self.assertEqual(categories.count(), 2)

        self.assertNotIn(
            self.adventure_category.CTGRY_ID,
            categories.values_list("CTGRY_ID", flat=True),
        )

    def test_list_categories_filters_by_search_and_cluster(self):
        categories = CategoryService.list_categories(
            search="coffee",
            cluster_id=self.cluster.CLUS_ID,
        )

        self.assertEqual(categories.count(), 1)
        self.assertEqual(
            categories.first().CTGRY_NAME,
            "Cafes",
        )

    def test_list_categories_defaults_to_name_ordering(self):
        categories = CategoryService.list_categories()

        self.assertEqual(
            list(categories.values_list("CTGRY_NAME", flat=True)),
            [
                "Cafes",
                "Hiking",
                "Restaurants",
            ],
        )

    def test_list_categories_orders_by_name_descending(self):
        categories = CategoryService.list_categories(
            ordering="-name",
        )

        self.assertEqual(
            list(categories.values_list("CTGRY_NAME", flat=True)),
            [
                "Restaurants",
                "Hiking",
                "Cafes",
            ],
        )

    def test_list_categories_orders_by_created_at(self):
        categories = CategoryService.list_categories(
            ordering="created_at",
        )

        self.assertEqual(
            list(categories.values_list("CTGRY_ID", flat=True)),
            [
                self.category.CTGRY_ID,
                self.other_category.CTGRY_ID,
                self.adventure_category.CTGRY_ID,
            ],
        )

    def test_list_categories_orders_by_created_at_descending(self):
        categories = CategoryService.list_categories(
            ordering="-created_at",
        )

        self.assertEqual(
            list(categories.values_list("CTGRY_ID", flat=True)),
            [
                self.adventure_category.CTGRY_ID,
                self.other_category.CTGRY_ID,
                self.category.CTGRY_ID,
            ],
        )

    def test_list_categories_orders_by_updated_at(self):
        categories = CategoryService.list_categories(
            ordering="updated_at",
        )

        self.assertEqual(
            list(categories.values_list("CTGRY_ID", flat=True)),
            [
                self.category.CTGRY_ID,
                self.other_category.CTGRY_ID,
                self.adventure_category.CTGRY_ID,
            ],
        )

    def test_list_categories_orders_by_updated_at_descending(self):
        categories = CategoryService.list_categories(
            ordering="-updated_at",
        )

        self.assertEqual(
            list(categories.values_list("CTGRY_ID", flat=True)),
            [
                self.adventure_category.CTGRY_ID,
                self.other_category.CTGRY_ID,
                self.category.CTGRY_ID,
            ],
        )

    def test_list_categories_uses_name_ordering_for_invalid_ordering(self):
        categories = CategoryService.list_categories(
            ordering="invalid",
        )

        self.assertEqual(
            list(categories.values_list("CTGRY_NAME", flat=True)),
            [
                "Cafes",
                "Hiking",
                "Restaurants",
            ],
        )

    def test_get_category_returns_category(self):
        category = CategoryService.get_category(
            self.category.CTGRY_ID,
        )

        self.assertEqual(
            category.CTGRY_ID,
            self.category.CTGRY_ID,
        )

        self.assertEqual(
            category.CLUS_ID,
            self.cluster,
        )

    def test_get_category_raises_404_when_not_found(self):
        with self.assertRaises(Http404):
            CategoryService.get_category(9999)

    def test_create_category_strips_name(self):
        category = CategoryService.create_category(
            {
                "CTGRY_NAME": "  Beaches  ",
                "CTGRY_DESCRIPTION": "Beach destinations",
                "CLUS_ID": self.cluster,
            }
        )

        self.assertEqual(
            category.CTGRY_NAME,
            "Beaches",
        )

        self.assertEqual(
            category.CTGRY_DESCRIPTION,
            "Beach destinations",
        )

        self.assertEqual(
            category.CLUS_ID,
            self.cluster,
        )

    def test_update_category_updates_provided_fields(self):
        CategoryService.update_category(
            self.category,
            {
                "CTGRY_NAME": "  Fine Dining  ",
                "CTGRY_DESCRIPTION": "Upscale restaurants",
            },
        )

        self.category.refresh_from_db()

        self.assertEqual(
            self.category.CTGRY_NAME,
            "Fine Dining",
        )

        self.assertEqual(
            self.category.CTGRY_DESCRIPTION,
            "Upscale restaurants",
        )

    def test_update_category_updates_cluster(self):
        CategoryService.update_category(
            self.category,
            {
                "CLUS_ID": self.other_cluster,
            },
        )

        self.category.refresh_from_db()

        self.assertEqual(
            self.category.CLUS_ID,
            self.other_cluster,
        )

    def test_delete_category_deletes_category(self):
        category_id = self.category.CTGRY_ID

        CategoryService.delete_category(self.category)

        self.assertFalse(
            Category.objects.filter(
                CTGRY_ID=category_id,
            ).exists()
        )