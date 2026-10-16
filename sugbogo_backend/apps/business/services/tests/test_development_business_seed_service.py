import json
from io import StringIO
from unittest.mock import patch

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry, Point
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from apps.admin_operations.system_configuration.models import (
    DiscoveryAlgorithmConfiguration,
)
from apps.business.models import (
    Business,
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
    BusinessPocket,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
    ServiceableBoundary,
    SpecialtyTag,
)
from apps.business.services.development_business_seed_service import (
    BUSINESS_LISTINGS,
    CATEGORIES,
    CLUSTERS,
    SEED_MARKER,
    DevelopmentBusinessSeedService,
)
from apps.merchant_application.models import MerchantApplication
from apps.reviews.models import Review
from apps.shared.serializers.operating_hours_serializers import (
    OperatingHoursWeekSerializer,
)
from apps.users.models import (
    ReputationEvent,
    User,
    UserCategoryInterest,
    UserSpecialtyTagInterest,
)


class DevelopmentSeedTestMixin:
    @classmethod
    def prepare_seed_prerequisites(cls):
        with open(
            settings.BASE_DIR / "apps/business/data/cebu_city_boundary.json",
            encoding="utf-16",
        ) as boundary_file:
            geometry = json.load(boundary_file)["geometry"]
        cls.boundary = ServiceableBoundary.objects.create(
            SBND_NAME="Cebu City",
            SBND_PSGC_CODE="072217000",
            SBND_BOUNDARY=GEOSGeometry(json.dumps(geometry), srid=4326),
        )
        cls.configuration, _ = DiscoveryAlgorithmConfiguration.objects.get_or_create(
            DAC_ID=1,
        )

    @staticmethod
    def seed():
        output = StringIO()
        call_command("seed_development_businesses", stdout=output)
        return output.getvalue()

    @staticmethod
    def create_user(name, role=User.UserRole.EXPLORER):
        return User.objects.create_user(
            email=f"{name}@example.com",
            password=None,
            USER_FNAME="Seed Test",
            USER_LNAME=name,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )

    def create_unrelated_business(self, name="Unrelated Existing Business"):
        owner = self.create_user("existing-owner", User.UserRole.MERCHANT)
        cluster = Cluster.objects.create(CLUS_NAME="Existing Taxonomy")
        category = Category.objects.create(
            CTGRY_NAME="Existing Category", CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.89, 10.31, srid=4326),
            LOCT_ADDRESS="Existing address",
        )
        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_DESCRIPTION="Existing unrelated listing.",
            BUSN_CONTACT_NUMBER="09000000999",
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    @staticmethod
    def record_counts():
        return {
            model.__name__: model.objects.count()
            for model in (
                User, Cluster, Category, SpecialtyTag, Location, Business,
                BusinessSpecialtyTag, BusinessOperatingHours, ServiceableBoundary,
                DiscoveryAlgorithmConfiguration, BusinessVouch, BusinessPocket,
                Review, MerchantApplication, BusinessPhoto, BusinessLandmark,
                DiscoveryScore, UserCategoryInterest, UserSpecialtyTagInterest,
                ReputationEvent,
            )
        }


@override_settings(DEBUG=True)
class DevelopmentBusinessSeederTests(DevelopmentSeedTestMixin, TestCase):
    """Verify real ORM inserts, safe repeat runs, guards and transactional failure."""

    @classmethod
    def setUpTestData(cls):
        cls.prepare_seed_prerequisites()

    def test_creates_exactly_fifteen_businesses_and_minimum_taxonomy(self):
        self.assertEqual(Business.objects.count(), 0)
        self.assertIn("15 created, 0 reused", self.seed())
        self.assertEqual(Business.objects.count(), 15)
        self.assertEqual(Cluster.objects.count(), 3)
        self.assertEqual(Category.objects.count(), 6)
        self.assertEqual(SpecialtyTag.objects.count(), 18)
        self.assertEqual(Location.objects.count(), 15)
        self.assertEqual(BusinessOperatingHours.objects.count(), 105)
        self.assertEqual(BusinessSpecialtyTag.objects.count(), 45)
        self.assertSetEqual(
            set(Business.objects.values_list("BUSN_NAME", flat=True)),
            {item[0] for item in BUSINESS_LISTINGS},
        )

    def test_rerun_keeps_record_ids_counts_and_updated_timestamps(self):
        self.seed()
        models = (
            User, Business, Cluster, Category, SpecialtyTag, Location,
            BusinessSpecialtyTag, BusinessOperatingHours,
        )
        before = {
            model: list(model.objects.order_by("pk").values(*(
                [field.attname for field in model._meta.concrete_fields if field.name != "password"]
            )))
            for model in models
        }
        self.assertIn("0 created, 15 reused", self.seed())
        for model in models:
            self.assertEqual(before[model], list(model.objects.order_by("pk").values(*(
                [field.attname for field in model._meta.concrete_fields if field.name != "password"]
            ))))

    def test_locations_are_valid_cebu_points_with_srid_4326(self):
        self.seed()
        for name, _, latitude, longitude in BUSINESS_LISTINGS:
            business = Business.objects.select_related("LOCT_ID").get(BUSN_NAME=name)
            point = business.LOCT_ID.LOCT_POINT
            self.assertEqual(point.geom_type, "Point")
            self.assertEqual(point.srid, 4326)
            self.assertEqual(point.x, longitude)
            self.assertEqual(point.y, latitude)
            self.assertTrue(self.boundary.SBND_BOUNDARY.covers(point))
            business.LOCT_ID.full_clean()

    def test_specialties_are_three_distinct_relevant_active_assignments(self):
        self.seed()
        for name, category_key, _, _ in BUSINESS_LISTINGS:
            business = Business.objects.get(BUSN_NAME=name)
            links = business.specialty_tag_links.select_related("TAG_ID")
            self.assertEqual(links.count(), 3)
            self.assertSetEqual(
                {link.TAG_ID.TAG_NAME for link in links},
                {tag[0] for tag in CATEGORIES[category_key][3]},
            )
            for link in links:
                self.assertTrue(link.BST_IS_ACTIVE)
                self.assertIsNotNone(link.BST_ACTIVATED_AT)
                self.assertEqual(link.BST_VOUCH_COUNT, 0)
                self.assertEqual(link.BST_TAG_SCORE, 0)
                link.full_clean()

    def test_businesses_have_unique_active_synthetic_merchant_owners(self):
        self.seed()
        self.assertEqual(
            User.objects.filter(USER_EMAIL__endswith="@sugbogo.invalid").count(), 15,
        )
        self.assertEqual(Business.objects.values("USER_ID").distinct().count(), 15)
        for business in Business.objects.select_related("USER_ID", "CTGRY_ID__CLUS_ID"):
            self.assertEqual(business.BUSN_STATUS, Business.BusinessStatus.ACTIVE)
            self.assertFalse(business.BUSN_IS_VERIFIED)
            self.assertTrue(business.BUSN_DESCRIPTION.startswith(SEED_MARKER))
            self.assertEqual(business.USER_ID.USER_ROLE, User.UserRole.MERCHANT)
            self.assertEqual(business.USER_ID.USER_STATUS, User.UserStatus.ACTIVE)
            self.assertFalse(business.USER_ID.has_usable_password())
            self.assertFalse(business.USER_ID.is_staff)
            self.assertFalse(business.USER_ID.is_superuser)
            self.assertEqual(
                business.USER_ID.USER_REPUTATION,
                self.configuration.DAC_REPUTATION_BASELINE,
            )
            business.full_clean()
            business.USER_ID.full_clean()

    def test_every_schedule_passes_existing_week_validation(self):
        self.seed()
        for business in Business.objects.all():
            hours = [{
                "day": day.BOHR_DAY,
                "is_open": day.BOHR_IS_OPEN,
                "is_24_hours": day.BOHR_IS_24_HOURS,
                "open_time": day.BOHR_OPEN_TIME,
                "close_time": day.BOHR_CLOSE_TIME,
            } for day in business.operating_hours.all()]
            self.assertEqual(len(hours), 7)
            serializer = OperatingHoursWeekSerializer(data={"hours": hours})
            self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_no_engagement_applications_photos_landmarks_or_scores_are_created(self):
        before = self.record_counts()
        self.seed()
        after = self.record_counts()
        for name in (
            "BusinessVouch", "BusinessPocket", "Review", "MerchantApplication",
            "BusinessPhoto", "BusinessLandmark", "DiscoveryScore",
            "UserCategoryInterest", "UserSpecialtyTagInterest",
            "ReputationEvent",
            "DiscoveryAlgorithmConfiguration", "ServiceableBoundary",
        ):
            self.assertEqual(after[name], before[name], name)
        for business in Business.objects.all():
            self.assertEqual(business.BUSN_VOUCH_COUNT, 0)
            self.assertEqual(business.BUSN_REVIEW_COUNT, 0)
            self.assertEqual(business.BUSN_POCKET_COUNT, 0)
            self.assertIsNone(business.BUSN_COVER_PHOTO_URL)
            self.assertIsNone(business.BUSN_COVER_PHOTO_PUBLIC_ID)

    def test_existing_unrelated_business_user_and_taxonomy_are_unchanged(self):
        business = self.create_unrelated_business()
        owner = business.USER_ID
        before_business = Business.objects.filter(pk=business.pk).values().get()
        owner_fields = (
            "USER_ROLE", "USER_STATUS", "USER_REPUTATION", "USER_UPDATED_AT",
            "EMAIL_VERIFIED", "is_staff", "is_superuser",
        )
        before_owner = User.objects.filter(pk=owner.pk).values(*owner_fields).get()
        before_category = Category.objects.filter(pk=business.CTGRY_ID_id).values().get()
        self.seed()
        self.assertEqual(Business.objects.count(), 16)
        self.assertEqual(before_business, Business.objects.filter(pk=business.pk).values().get())
        self.assertEqual(before_owner, User.objects.filter(pk=owner.pk).values(*owner_fields).get())
        self.assertEqual(before_category, Category.objects.filter(pk=business.CTGRY_ID_id).values().get())

    def test_existing_owner_identity_collision_does_not_modify_account(self):
        owner = User.objects.create_user(
            email="dev-listings-owner-01@sugbogo.invalid",
            password=None,
            USER_FNAME="Existing", USER_LNAME="Account",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "owner identity conflicts"):
            self.seed()
        self.assertEqual(before, self.record_counts())
        owner.refresh_from_db()
        self.assertEqual(owner.USER_ROLE, User.UserRole.EXPLORER)
        self.assertEqual(owner.USER_FNAME, "Existing")

    def test_existing_business_name_collision_is_preserved_and_rolls_back(self):
        business = self.create_unrelated_business(BUSINESS_LISTINGS[0][0])
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "belongs to another owner"):
            self.seed()
        self.assertEqual(before, self.record_counts())
        business.refresh_from_db()
        self.assertEqual(business.BUSN_DESCRIPTION, "Existing unrelated listing.")

    def test_unrelated_cluster_with_reserved_name_is_not_overwritten(self):
        cluster = Cluster.objects.create(CLUS_NAME=CLUSTERS["culinary"][0])
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "taxonomy name conflicts"):
            self.seed()
        self.assertEqual(before, self.record_counts())
        cluster.refresh_from_db()
        self.assertIsNone(cluster.CLUS_DESCRIPTION)

    def test_changed_specialty_definition_is_not_overwritten(self):
        name, icon, _ = CATEGORIES["cafes"][3][0]
        tag = SpecialtyTag.objects.create(TAG_NAME=name, TAG_ICON=icon, TAG_COLOR="red")
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "taxonomy name conflicts"):
            self.seed()
        self.assertEqual(before, self.record_counts())
        tag.refresh_from_db()
        self.assertEqual(tag.TAG_COLOR, "red")

    def test_ambiguous_category_collision_is_not_silently_reused(self):
        self.seed()
        category = Category.objects.get(CTGRY_NAME=CATEGORIES["cafes"][0])
        Category.objects.create(
            CTGRY_NAME=category.CTGRY_NAME,
            CTGRY_DESCRIPTION=category.CTGRY_DESCRIPTION,
            CLUS_ID=category.CLUS_ID,
        )
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "taxonomy name conflicts"):
            self.seed()
        self.assertEqual(before, self.record_counts())

    def test_seed_owner_with_an_unmarked_business_is_not_reassigned(self):
        self.seed()
        business = Business.objects.get(BUSN_NAME=BUSINESS_LISTINGS[0][0])
        Business.objects.filter(pk=business.pk).update(
            BUSN_DESCRIPTION="An existing business without the seed marker.",
        )
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "owns an unrelated business"):
            self.seed()
        self.assertEqual(before, self.record_counts())
        business.refresh_from_db()
        self.assertEqual(
            business.BUSN_DESCRIPTION,
            "An existing business without the seed marker.",
        )

    def test_requires_an_active_boundary_without_loading_it_implicitly(self):
        self.boundary.SBND_IS_ACTIVE = False
        self.boundary.save(update_fields=["SBND_IS_ACTIVE"])
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "load_cebu_boundary first"):
            self.seed()
        self.assertEqual(before, self.record_counts())
        self.boundary.refresh_from_db()
        self.assertFalse(self.boundary.SBND_IS_ACTIVE)

    def test_rejects_coordinates_outside_the_active_boundary(self):
        invalid = (BUSINESS_LISTINGS[0][0], "cafes", 0, 0)
        before = self.record_counts()
        with patch(
            "apps.business.services.development_business_seed_service.BUSINESS_LISTINGS",
            (invalid,) + BUSINESS_LISTINGS[1:],
        ), self.assertRaises(CommandError):
            self.seed()
        self.assertEqual(before, self.record_counts())

    def test_missing_reputation_configuration_is_not_created_by_seeder(self):
        DiscoveryAlgorithmConfiguration.objects.all().delete()
        before = self.record_counts()
        with self.assertRaisesMessage(CommandError, "reputation configuration"):
            self.seed()
        self.assertEqual(before, self.record_counts())

    @override_settings(DEBUG=False)
    def test_command_refuses_production_settings(self):
        before = self.record_counts()
        with self.assertNumQueries(0), self.assertRaisesMessage(
            CommandError, "refuses production settings",
        ):
            self.seed()
        self.assertEqual(before, self.record_counts())

    @override_settings(DEBUG=False)
    def test_service_cannot_bypass_the_development_guard(self):
        with self.assertRaises(PermissionDenied):
            DevelopmentBusinessSeedService.seed()
        self.assertEqual(Business.objects.count(), 0)

    def test_late_model_validation_failure_rolls_back_all_seed_records(self):
        self.create_unrelated_business()
        before = self.record_counts()
        _, key, latitude, longitude = BUSINESS_LISTINGS[-1]
        invalid = ("X" * 151, key, latitude, longitude)
        with patch(
            "apps.business.services.development_business_seed_service.BUSINESS_LISTINGS",
            BUSINESS_LISTINGS[:-1] + (invalid,),
        ), self.assertRaisesMessage(CommandError, "no records were saved"):
            self.seed()
        self.assertEqual(before, self.record_counts())


@override_settings(DEBUG=True)
class DevelopmentBusinessSeederAPITests(DevelopmentSeedTestMixin, APITestCase):
    """Exercise unchanged Explorer APIs against the real seeded records."""

    @classmethod
    def setUpTestData(cls):
        cls.prepare_seed_prerequisites()
        cls.seed()
        cls.explorer = cls.create_user("development-seed-explorer")

    def setUp(self):
        self.client.force_authenticate(self.explorer)

    def test_discovery_and_new_business_collections_return_all_seed_listings(self):
        expected_ids = set(Business.objects.values_list("pk", flat=True))
        for url in (
            "/api/explorer/explore/discovery/",
            "/api/explorer/explore/new-businesses/",
            "/api/explorer/explore/collections/hidden-gems/",
            "/api/explorer/explore/collections/new-businesses/",
        ):
            with self.subTest(url=url):
                response = self.client.get(url, {"page_size": 100})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["data"]["pagination"]["total_items"], 15)
                self.assertSetEqual(
                    {item["id"] for item in response.data["data"]["items"]},
                    expected_ids,
                )

    def test_discovery_pagination_counts_unique_seed_businesses(self):
        ids = []
        for page in (1, 2, 3):
            response = self.client.get(
                "/api/explorer/explore/discovery/",
                {"page_size": 5, "page": page},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["pagination"]["total_items"], 15)
            ids.extend(item["id"] for item in response.data["data"]["items"])
        self.assertEqual(len(ids), 15)
        self.assertEqual(len(set(ids)), 15)

    def test_every_seed_business_profile_has_three_specialties_and_valid_hours(self):
        for business in Business.objects.all():
            with self.subTest(business=business.BUSN_NAME):
                response = self.client.get(
                    f"/api/explorer/explore/businesses/{business.pk}/",
                )
                self.assertEqual(response.status_code, 200)
                data = response.data["data"]
                self.assertEqual(data["business_name"], business.BUSN_NAME)
                self.assertEqual(len(data["specialty_tags"]), 3)
                self.assertTrue(all(not tag["is_vouched"] for tag in data["specialty_tags"]))
                self.assertTrue(all(tag["vouch_count"] == 0 for tag in data["specialty_tags"]))
                self.assertEqual(len(data["operating_hours"]), 7)
                self.assertIsNone(data["cover_photo_url"])
                self.assertEqual(data["photos"], [])

    def test_seeding_does_not_create_vouch_history_for_the_explorer(self):
        response = self.client.get(reverse("vouch-history"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["summary"], {
            "total_businesses": 0, "total_specialty_vouches": 0,
        })
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)

    def test_multi_vouch_history_removal_and_revouch_use_existing_api_contract(self):
        business = Business.objects.order_by("pk").first()
        tag_a, tag_b, _ = business.specialty_tag_links.order_by("pk")
        url = reverse("business-vouch", kwargs={"business_id": business.pk})
        first = self.client.post(url, {"tag_id": tag_a.TAG_ID_id}, format="json")
        self.assertEqual(first.status_code, 200)
        original_id = first.data["data"]["id"]
        for vouches in (1, 2):
            if vouches == 2:
                added = self.client.post(url, {"tag_id": tag_b.TAG_ID_id}, format="json")
                self.assertEqual(added.status_code, 200)
            history = self.client.get(reverse("vouch-history")).data["data"]
            self.assertEqual(history["summary"], {
                "total_businesses": 1, "total_specialty_vouches": vouches,
            })
            self.assertEqual(history["pagination"]["total_items"], 1)
            self.assertEqual(len(history["items"]), 1)
            self.assertEqual(history["items"][0]["business_id"], business.pk)
            self.assertEqual(len(history["items"][0]["vouches"]), vouches)
        self.assertEqual(
            self.client.post(url, {"tag_id": tag_a.TAG_ID_id}, format="json").status_code,
            400,
        )
        for tag, remaining in ((tag_a, 1), (tag_b, 0)):
            removed = self.client.delete(url, {"tag_id": tag.TAG_ID_id}, format="json")
            self.assertEqual(removed.status_code, 200)
            history = self.client.get(reverse("vouch-history")).data["data"]
            self.assertEqual(history["summary"], {
                "total_businesses": int(remaining > 0),
                "total_specialty_vouches": remaining,
            })
            self.assertEqual(len(history["items"]), int(remaining > 0))
        revouched = self.client.post(url, {"tag_id": tag_a.TAG_ID_id}, format="json")
        self.assertEqual(revouched.status_code, 200)
        self.assertNotEqual(revouched.data["data"]["id"], original_id)
        history = self.client.get(reverse("vouch-history")).data["data"]
        self.assertEqual(history["summary"], {
            "total_businesses": 1, "total_specialty_vouches": 1,
        })

    def test_seed_owner_cannot_vouch_for_own_business(self):
        business = Business.objects.select_related("USER_ID").first()
        self.client.force_authenticate(business.USER_ID)
        response = self.client.post(
            reverse("business-vouch", kwargs={"business_id": business.pk}),
            {"tag_id": business.specialty_tag_links.first().TAG_ID_id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(BusinessVouch.objects.count(), 0)

    def test_rerun_preserves_manual_vouches_counters_and_business_edits(self):
        business = Business.objects.first()
        tag = business.specialty_tag_links.first()
        response = self.client.post(
            reverse("business-vouch", kwargs={"business_id": business.pk}),
            {"tag_id": tag.TAG_ID_id}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        Business.objects.filter(pk=business.pk).update(
            BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
            BUSN_COVER_PHOTO_URL="https://example.com/development-cover.jpg",
        )
        before_business = Business.objects.filter(pk=business.pk).values().get()
        before_tag = BusinessSpecialtyTag.objects.filter(pk=tag.pk).values().get()
        before_vouch = BusinessVouch.objects.values().get()
        self.seed()
        self.assertEqual(before_business, Business.objects.filter(pk=business.pk).values().get())
        self.assertEqual(before_tag, BusinessSpecialtyTag.objects.filter(pk=tag.pk).values().get())
        self.assertEqual(before_vouch, BusinessVouch.objects.values().get())
