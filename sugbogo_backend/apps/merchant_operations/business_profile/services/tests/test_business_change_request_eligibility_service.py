from datetime import timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.merchant_operations.business_profile.services.business_change_request_eligibility_service import (
    BusinessChangeRequestEligibilityService,
)
from apps.merchant_operations.business_profile.services.business_change_pending_status_service import (
    BusinessChangePendingStatusService,
)
from apps.users.models import User


class BusinessChangeRequestEligibilityServiceTests(TestCase):
    """Verify independent pending and approval cooldown rules."""

    @classmethod
    def setUpTestData(cls):
        """Create one active merchant business for eligibility checks."""
        cls.merchant = User.objects.create_user(
            email="cooldown-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Cooldown",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Food")
        cls.category = Category.objects.create(
            CTGRY_NAME="Cafe",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
        )
        cls.business = Business.objects.create(
            BUSN_NAME="Cooldown Cafe",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=cls.merchant,
            CTGRY_ID=cls.category,
            LOCT_ID=location,
        )

    def _name_request(self, status, resolved_at=None):
        """Create one name request with the requested terminal state."""
        return BusinessNameChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            BNCR_PREVIOUS_BUSINESS_NAME="Cooldown Cafe",
            BNCR_PROPOSED_BUSINESS_NAME="Renamed Cafe",
            BNCR_STATUS=status,
            BNCR_SUBMITTED_AT=timezone.now() - timedelta(days=10),
            BNCR_RESOLVED_AT=resolved_at,
        )

    def _classification_request(self, status, resolved_at=None):
        """Create one classification request without unrelated snapshots."""
        return BusinessClassificationChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            PREVIOUS_CTGRY_ID=self.category,
            PROPOSED_CTGRY_ID=self.category,
            BCCR_PREVIOUS_CATEGORY_NAME=self.category.CTGRY_NAME,
            BCCR_PREVIOUS_CLUSTER_ID=self.category.CLUS_ID_id,
            BCCR_PREVIOUS_CLUSTER_NAME=self.category.CLUS_ID.CLUS_NAME,
            BCCR_PROPOSED_CATEGORY_NAME=self.category.CTGRY_NAME,
            BCCR_PROPOSED_CLUSTER_ID=self.category.CLUS_ID_id,
            BCCR_PROPOSED_CLUSTER_NAME=self.category.CLUS_ID.CLUS_NAME,
            BCCR_STATUS=status,
            BCCR_SUBMITTED_AT=timezone.now() - timedelta(days=10),
            BCCR_RESOLVED_AT=resolved_at,
        )

    def _location_request(self, status, resolved_at=None):
        """Create one location request without unrelated landmarks."""
        return BusinessLocationChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            BLCR_PREVIOUS_LOCT_ID=self.business.LOCT_ID_id,
            BLCR_PREVIOUS_POINT=Point(123.8854, 10.3157, srid=4326),
            BLCR_PREVIOUS_ADDRESS="Gorordo Avenue",
            BLCR_PREVIOUS_CITY="Cebu City",
            BLCR_PREVIOUS_PROVINCE="Cebu",
            BLCR_PROPOSED_POINT=Point(123.891, 10.321, srid=4326),
            BLCR_PROPOSED_ADDRESS="Osmena Boulevard",
            BLCR_PROPOSED_CITY="Cebu City",
            BLCR_PROPOSED_PROVINCE="Cebu",
            BLCR_STATUS=status,
            BLCR_SUBMITTED_AT=timezone.now() - timedelta(days=10),
            BLCR_RESOLVED_AT=resolved_at,
        )

    def test_pending_status_summary_checks_only_current_pending_requests(self):
        """Report independent pending flags without loading request histories."""
        with self.assertNumQueries(4):
            empty = BusinessChangePendingStatusService.for_merchant(
                self.merchant,
            )
        self.assertEqual(empty, {
            "business_name": False,
            "classification": False,
            "location": False,
        })

        name_request = self._name_request(BusinessNameChangeRequest.Status.PENDING)
        self._classification_request(
            BusinessClassificationChangeRequest.Status.REJECTED,
        )
        self._location_request(BusinessLocationChangeRequest.Status.PENDING)
        self.assertEqual(
            BusinessChangePendingStatusService.for_merchant(self.merchant),
            {
                "business_name": True,
                "classification": False,
                "location": True,
            },
        )

        self._classification_request(
            BusinessClassificationChangeRequest.Status.PENDING,
        )
        name_request.BNCR_STATUS = BusinessNameChangeRequest.Status.WITHDRAWN
        name_request.save(update_fields=["BNCR_STATUS"])
        self.assertEqual(
            BusinessChangePendingStatusService.for_merchant(self.merchant),
            {
                "business_name": False,
                "classification": True,
                "location": True,
            },
        )

    def test_pending_status_endpoint_allows_suspended_merchant(self):
        """Expose only the merchant's own pending flags while suspended."""
        self._name_request(BusinessNameChangeRequest.Status.PENDING)
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])

        client = APIClient()
        client.force_authenticate(user=self.merchant)
        response = client.get(
            "/api/merchant/business-profile/update-requests/pending-status/",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], {
            "business_name": True,
            "classification": False,
            "location": False,
        })

    def test_business_without_requests_is_eligible(self):
        """Allow all request types when no prior request exists."""
        for eligibility in (
            BusinessChangeRequestEligibilityService.for_business_name(
                self.business,
            ),
            BusinessChangeRequestEligibilityService.for_classification(
                self.business,
            ),
            BusinessChangeRequestEligibilityService.for_location(
                self.business,
            ),
        ):
            self.assertTrue(eligibility["can_submit"])
            self.assertIsNone(eligibility["reason"])
            self.assertIsNone(eligibility["pending_request_id"])
            self.assertIsNone(eligibility["last_approved_request_id"])

    def test_cooldowns_begin_at_approval_and_expire_at_exact_boundary(self):
        """Apply seven-day and 72-hour windows from resolution timestamps."""
        now = timezone.now()
        name_request = self._name_request(
            BusinessNameChangeRequest.Status.APPROVED,
            now,
        )
        classification_request = self._classification_request(
            BusinessClassificationChangeRequest.Status.APPROVED,
            now,
        )
        location_request = self._location_request(
            BusinessLocationChangeRequest.Status.APPROVED,
            now,
        )

        name = BusinessChangeRequestEligibilityService.for_business_name(
            self.business,
            now=now,
        )
        classification = (
            BusinessChangeRequestEligibilityService.for_classification(
                self.business,
                now=now,
            )
        )
        location = BusinessChangeRequestEligibilityService.for_location(
            self.business,
            now=now,
        )

        self.assertEqual(name["reason"], "cooldown")
        self.assertEqual(name["cooldown_duration_hours"], 168)
        self.assertEqual(
            name["last_approved_request_id"],
            name_request.pk,
        )
        self.assertEqual(classification["reason"], "cooldown")
        self.assertEqual(classification["cooldown_duration_hours"], 168)
        self.assertEqual(
            classification["last_approved_request_id"],
            classification_request.pk,
        )
        self.assertEqual(location["reason"], "cooldown")
        self.assertEqual(location["cooldown_duration_hours"], 72)
        self.assertEqual(
            location["last_approved_request_id"],
            location_request.pk,
        )

        self.assertTrue(
            BusinessChangeRequestEligibilityService.for_business_name(
                self.business,
                now=now + timedelta(days=7),
            )["can_submit"],
        )
        self.assertTrue(
            BusinessChangeRequestEligibilityService.for_classification(
                self.business,
                now=now + timedelta(days=7),
            )["can_submit"],
        )
        self.assertTrue(
            BusinessChangeRequestEligibilityService.for_location(
                self.business,
                now=now + timedelta(hours=72),
            )["can_submit"],
        )

    def test_pending_request_takes_precedence_over_active_cooldown(self):
        """Expose the pending request even when an earlier cooldown is active."""
        now = timezone.now()
        self._name_request(
            BusinessNameChangeRequest.Status.APPROVED,
            now - timedelta(days=1),
        )
        pending = self._name_request(
            BusinessNameChangeRequest.Status.PENDING,
        )

        eligibility = (
            BusinessChangeRequestEligibilityService.for_business_name(
                self.business,
                now=now,
            )
        )

        self.assertFalse(eligibility["can_submit"])
        self.assertEqual(eligibility["reason"], "pending")
        self.assertEqual(eligibility["pending_request_id"], pending.pk)
        self.assertIsNotNone(eligibility["last_approved_request_id"])

    def test_rejected_and_withdrawn_requests_do_not_reset_approval_cooldown(self):
        """Keep the latest approved request authoritative for cooldown timing."""
        now = timezone.now()
        approved = self._name_request(
            BusinessNameChangeRequest.Status.APPROVED,
            now - timedelta(days=2),
        )
        self._name_request(
            BusinessNameChangeRequest.Status.REJECTED,
            now - timedelta(days=1),
        )
        self._name_request(
            BusinessNameChangeRequest.Status.WITHDRAWN,
            now,
        )

        eligibility = (
            BusinessChangeRequestEligibilityService.for_business_name(
                self.business,
                now=now,
            )
        )

        self.assertEqual(eligibility["reason"], "cooldown")
        self.assertEqual(
            eligibility["last_approved_request_id"],
            approved.pk,
        )
        self.assertEqual(
            eligibility["cooldown_until"],
            approved.BNCR_RESOLVED_AT + timedelta(days=7),
        )

    def test_request_type_cooldowns_are_independent(self):
        """A name approval does not block classification or location requests."""
        now = timezone.now()
        self._name_request(
            BusinessNameChangeRequest.Status.APPROVED,
            now,
        )

        self.assertEqual(
            BusinessChangeRequestEligibilityService.for_business_name(
                self.business,
                now=now,
            )["reason"],
            "cooldown",
        )
        self.assertTrue(
            BusinessChangeRequestEligibilityService.for_classification(
                self.business,
                now=now,
            )["can_submit"],
        )
        self.assertTrue(
            BusinessChangeRequestEligibilityService.for_location(
                self.business,
                now=now,
            )["can_submit"],
        )
