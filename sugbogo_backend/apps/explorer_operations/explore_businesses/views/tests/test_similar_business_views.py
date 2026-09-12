from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.users.models import User


class SimilarBusinessViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.explorer = User.objects.create_user(
            email="similar-view-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Similar",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.explorer)
        cluster = Cluster.objects.create(
            CLUS_NAME="Similar View Cluster",
        )
        category = Category.objects.create(
            CTGRY_NAME="Similar View Category",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="View Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        tag = SpecialtyTag.objects.create(
            TAG_NAME="Similar View Tag",
        )
        self.current = self._create_business(
            "Current View Business",
            category,
            location,
        )
        self.similar = self._create_business(
            "Similar View Business",
            category,
            location,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.current,
            TAG_ID=tag,
        )
        BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.similar,
            TAG_ID=tag,
        )

    @staticmethod
    def _create_business(
        name,
        category,
        location,
    ):
        owner = User.objects.create_user(
            email=f"{name.lower().replace(' ', '-')}@example.com",
            password="StrongPassword123!",
            USER_FNAME="Business",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_DESCRIPTION="Similar view test.",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    def test_returns_compact_business_data_without_internal_ranking_signals(self):
        response = self.client.get(
            f"/api/explorer/explore/businesses/{self.current.BUSN_ID}/similar/",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]), 1)
        item = response.data["data"][0]
        self.assertEqual(item["id"], self.similar.BUSN_ID)
        self.assertIn("cluster", item)
        self.assertIn("category", item)
        self.assertIn("specialty_tags", item)
        self.assertIn("location", item)
        self.assertNotIn("similarity", item)
        self.assertNotIn("discovery_score", item)
        self.assertNotIn("ranking_position", item)

    def test_missing_business_returns_controlled_not_found(self):
        response = self.client.get(
            "/api/explorer/explore/businesses/999999/similar/",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            response.data["message"],
            "The business could not be found.",
        )
