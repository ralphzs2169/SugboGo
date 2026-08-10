# isort: skip_file
from datetime import time
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

from apps.merchant_application.models import (
    MerchantApplicationIdentity,
    MerchantApplicationLandmark,
    MerchantApplicationOperatingHours,
)
from apps.merchant_application.services.document_service import DocumentService
from apps.merchant_application.services.identity_service import IdentityService
from apps.merchant_application.services.location_service import LocationService
from apps.merchant_application.services.operating_hours_service import (
    OperatingHoursService,
)
from apps.merchant_application.services.photo_service import PhotoService
from apps.business.models import Category, Cluster, SpecialtyTag
from apps.users.models import User


class MerchantApplicationServiceMixin:
    def setUp(self):
        super().setUp()

        self.user = User.objects.create_user(
            email="merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Merchant",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.cluster = Cluster.objects.create(
            CLUS_NAME="Food and Dining",
            CLUS_DESCRIPTION="Food businesses",
        )

        self.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CTGRY_DESCRIPTION="Places that serve meals",
            CLUS_ID=self.cluster,
        )

        self.tags = [
            SpecialtyTag.objects.create(TAG_NAME=f"Tag {index}")
            for index in range(1, 4)
        ]

    def _identity_payload(self):
        return {
            "MIDN_BUSINESS_NAME": "Sugbo Bistro",
            "MIDN_BUSINESS_DESCRIPTION": "A Cebu-based local restaurant.",
            "MIDN_CONTACT_NUMBER": "09123456789",
            "MIDN_BUSINESS_EMAIL": "hello@sugbobistro.com",
            "MIDN_WEBSITE": "https://sugbobistro.example.com",
            "MIDN_REPRESENTATIVE_NAME": "Jane Owner",
            "MIDN_REPRESENTATIVE_ROLE": MerchantApplicationIdentity.RepresentativeRole.OWNER,
            "CLUS_ID": self.cluster,
            "CTGRY_ID": self.category,
            "specialty_tags": self.tags,
        }

    def _location_payload(self):
        return {
            "MLOC_PROVINCE": "Cebu",
            "MLOC_CITY": "Cebu City",
            "MLOC_BARANGAY": "Lahug",
            "MLOC_STREET_ADDRESS": "Gorordo Avenue",
            "MLOC_UNIT": "Unit 4B",
            "latitude": 10.3157,
            "longitude": 123.8854,
            "landmarks": [
                {
                    "MLMK_NAME": "Ayala Center Cebu",
                    "MLMK_ADDRESS": "Cebu Business Park, Cebu City",
                    "latitude": 10.3150,
                    "longitude": 123.9056,
                    "MLMK_SOURCE": MerchantApplicationLandmark.LandmarkSource.GOOGLE,
                    "MLMK_PLACE_ID": "ChIJ123",
                },
                {
                    "MLMK_NAME": "Cebu IT Park",
                    "MLMK_ADDRESS": "Apas, Cebu City",
                    "latitude": 10.3300,
                    "longitude": 123.9100,
                    "MLMK_SOURCE": MerchantApplicationLandmark.LandmarkSource.CUSTOM,
                    "MLMK_PLACE_ID": None,
                },
            ],
        }

    def _hours_payload(self):
        return [
            {
                "day": MerchantApplicationOperatingHours.Day.MONDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(9, 0),
                "close_time": time(18, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.TUESDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(9, 0),
                "close_time": time(18, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.WEDNESDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(9, 0),
                "close_time": time(18, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.THURSDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(9, 0),
                "close_time": time(18, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.FRIDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(9, 0),
                "close_time": time(18, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.SATURDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(10, 0),
                "close_time": time(20, 0),
            },
            {
                "day": MerchantApplicationOperatingHours.Day.SUNDAY,
                "is_open": True,
                "is_24_hours": False,
                "open_time": time(10, 0),
                "close_time": time(18, 0),
            },
        ]

    def _storefront_file(self, name="storefront.jpg"):
        return SimpleUploadedFile(
            name,
            b"storefront-image-bytes",
            content_type="image/jpeg",
        )

    def _pdf_file(self, name="document.pdf"):
        return SimpleUploadedFile(
            name,
            b"document-bytes",
            content_type="application/pdf",
        )

    def _create_identity(self):
        application, _identity = IdentityService.save_identity(
            self.user,
            self._identity_payload(),
        )

        application.refresh_from_db()
        _identity.refresh_from_db()

        return application, _identity

    def _create_location(self, application):
        location = LocationService.save_location(
            application,
            self._location_payload(),
        )

        application.refresh_from_db()
        location.refresh_from_db()

        return location

    def _create_hours(self, application):
        hours = OperatingHoursService.save_hours(
            application,
            self._hours_payload(),
        )

        application.refresh_from_db()

        return hours

    def _build_application_to_step_three(self):
        application, _ = self._create_identity()
        self._create_location(application)
        self._create_hours(application)
        application.refresh_from_db()
        return application

    def _build_application_to_step_four(self):
        application = self._build_application_to_step_three()

        with patch(
            "apps.merchant_application.services.photo_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/storefront.jpg",
                "public_id": "merchant_application_photos/storefront",
            }

            PhotoService.save_photos(
                application,
                {
                    "storefront": [self._storefront_file()],
                },
            )

        application.refresh_from_db()
        return application

    def _build_complete_application(self):
        application = self._build_application_to_step_four()

        with patch(
            "apps.merchant_application.services.document_service.CloudinaryService.upload_image"
        ) as mock_upload:
            mock_upload.return_value = {
                "secure_url": "https://cloudinary.com/business-registration.pdf",
                "public_id": "merchant_application_documents/business-registration",
            }

            DocumentService.save_documents(
                application,
                {
                    "business_registration": self._pdf_file(
                        "business-registration.pdf"
                    ),
                },
            )

        application.refresh_from_db()
        return application
