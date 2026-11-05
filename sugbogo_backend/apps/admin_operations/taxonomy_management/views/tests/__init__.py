from django.contrib.gis.geos import Point

from apps.business.models import Business, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationIdentity,
)
from apps.users.models import User


class TaxonomyUsageFixtures:
    """Create permanent businesses and independent application references for list tests."""

    def create_usage_user(
        self,
        status=User.UserStatus.ACTIVE,
    ):
        """Create a merchant without invoking approval or scoring workflows."""
        sequence = User.objects.count() + 1
        return User.objects.create_user(
            email=f"taxonomy-usage-{sequence}@example.com",
            password=None,
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=status,
            USER_FNAME="Taxonomy",
            USER_LNAME="Merchant",
        )

    def create_usage_business(
        self,
        category,
        status=Business.BusinessStatus.ACTIVE,
        owner_status=User.UserStatus.ACTIVE,
    ):
        """Create a business whose current classification is independent of applications."""
        owner = self.create_usage_user(
            status=owner_status,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(
                123.8854,
                10.3157,
                srid=4326,
            ),
            LOCT_ADDRESS="Cebu City",
        )
        return Business.objects.create(
            BUSN_NAME=f"Taxonomy Business {owner.pk}",
            BUSN_CONTACT_NUMBER="09171234567",
            BUSN_STATUS=status,
            USER_ID=owner,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    def create_application_reference(
        self,
        category,
        status=MerchantApplication.ApplicationStatus.DRAFT,
        tags=(),
    ):
        """Create one retained application identity with its own classification references."""
        application = MerchantApplication.objects.create(
            USER_ID=self.create_usage_user(),
            MAPP_STATUS=status,
        )
        identity = MerchantApplicationIdentity.objects.create(
            MAPP_ID=application,
            CLUS_ID=category.CLUS_ID,
            CTGRY_ID=category,
            MIDN_BUSINESS_NAME="Application Business",
            MIDN_CONTACT_NUMBER="09171234567",
            MIDN_REPRESENTATIVE_NAME="Merchant",
            MIDN_REPRESENTATIVE_ROLE=(
                MerchantApplicationIdentity.RepresentativeRole.OWNER
            ),
        )
        identity.specialty_tags.set(tags)
        return identity
