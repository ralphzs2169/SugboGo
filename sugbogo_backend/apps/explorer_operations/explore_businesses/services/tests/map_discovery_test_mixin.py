from decimal import Decimal

from django.contrib.gis.geos import Point
from django.utils import timezone

from apps.business.models import (
    Business,
    Category,
    Cluster,
    DiscoveryScore,
    Location,
)
from apps.users.models import User


class MapDiscoveryTestMixin:
    """Share geographic fixtures following the existing Explore collection setup."""

    bounds = {
        "north": 10.4,
        "south": 10.2,
        "east": 124.0,
        "west": 123.8,
    }

    def setUp(self):
        super().setUp()
        self.explorer = User.objects.create_user(
            email="map-explorer@example.com",
            password=None,
            USER_FNAME="Map",
            USER_LNAME="Explorer",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.cluster = Cluster.objects.create(
            CLUS_NAME="Map Food",
            CLUS_ICON=Cluster.ClusterIcon.COFFEE,
        )
        self.category = Category.objects.create(
            CTGRY_NAME="Map Cafe",
            CLUS_ID=self.cluster,
        )
        self.business_number = 0

    def create_business(
        self,
        *,
        latitude=10.3,
        longitude=123.9,
        score=None,
        status_value=Business.BusinessStatus.ACTIVE,
    ):
        """Create a business with its registered point and optional persisted score."""
        self.business_number += 1
        owner = User.objects.create_user(
            email=f"map-owner-{self.business_number}@example.com",
            password=None,
            USER_FNAME="Map",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                longitude,
                latitude,
                srid=4326,
            ),
            LOCT_ADDRESS="Map Street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        business = Business.objects.create(
            BUSN_NAME=f"Map Business {self.business_number}",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status_value,
            USER_ID=owner,
            CTGRY_ID=self.category,
            LOCT_ID=location,
        )

        if score is not None:
            DiscoveryScore.objects.create(
                BUSN_ID=business,
                DSC_S_SCORE=Decimal("0.50000"),
                DSC_V_SCORE=Decimal("0.50000"),
                DSC_D_SCORE=Decimal(score),
                DSC_COMPUTED_AT=timezone.now(),
            )

        return business
