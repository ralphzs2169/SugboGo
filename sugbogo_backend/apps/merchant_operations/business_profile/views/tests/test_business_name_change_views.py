from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import IntegrityError, close_old_connections, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationIdentity,
)
from apps.merchant_operations.business_profile.models import (
    BusinessNameChangeRequest,
)
from apps.merchant_operations.business_profile.services.business_name_change_service import (
    BusinessNameChangeService,
)
from apps.users.models import User


class BusinessNameChangeViewTests(TestCase):
    """Exercise merchant and Admin name-change lifecycle contracts."""

    @classmethod
    def setUpTestData(cls):
        """Create two owned businesses and retained application evidence."""
        cls.merchant = User.objects.create_user(
            email="name-merchant@example.com",
            password="StrongPassword123!",
            USER_FNAME="Name",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.other_merchant = User.objects.create_user(
            email="name-other@example.com",
            password="StrongPassword123!",
            USER_FNAME="Other",
            USER_LNAME="Merchant",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.admin = User.objects.create_user(
            email="name-admin@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.super_admin = User.objects.create_user(
            email="name-super@example.com",
            password="StrongPassword123!",
            USER_FNAME="Super",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.SUPER_ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.explorer = User.objects.create_user(
            email="name-explorer@example.com",
            password="StrongPassword123!",
            USER_FNAME="Explorer",
            USER_LNAME="Visitor",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cls.cluster = Cluster.objects.create(CLUS_NAME="Food and Dining")
        cls.category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=cls.cluster,
        )
        cls.business = cls._create_business(
            cls.merchant,
            "Sugbo Bistro",
        )
        cls.other_business = cls._create_business(
            cls.other_merchant,
            "Other Bistro",
        )
        cls.application = MerchantApplication.objects.create(
            USER_ID=cls.merchant,
            BUSN_ID=cls.business,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )
        cls.identity = MerchantApplicationIdentity.objects.create(
            MAPP_ID=cls.application,
            MIDN_BUSINESS_NAME="Sugbo Bistro",
            MIDN_BUSINESS_DESCRIPTION="Original business description",
            MIDN_CONTACT_NUMBER="09171234567",
            MIDN_REPRESENTATIVE_NAME="Name Merchant",
            MIDN_REPRESENTATIVE_ROLE="owner",
            CLUS_ID=cls.cluster,
            CTGRY_ID=cls.category,
        )

    @classmethod
    def _create_business(cls, owner, name):
        """Build a valid live business for a merchant account."""
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
        )
        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=cls.category,
            LOCT_ID=location,
        )

    def setUp(self):
        """Start each API test as the owning merchant."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.merchant)
        self.submit_url = (
            "/api/merchant/business-profile/update-requests/business-name/"
        )
        self.merchant_list_url = "/api/merchant/business-profile/update-requests/"
        self.admin_list_url = "/api/admin/businesses/update-requests/"

    def _submit(self, name="Sugbo Heritage Bistro"):
        """Submit a request through the merchant API."""
        return self.client.post(
            self.submit_url,
            {"proposed_business_name": name},
            format="json",
        )

    def _merchant_detail_url(self, request_id):
        """Build an owner-scoped request detail URL."""
        return f"{self.merchant_list_url}{request_id}/"

    def _admin_detail_url(self, request_id):
        """Build an Admin request detail URL."""
        return f"{self.admin_list_url}{request_id}/"

    def test_submission_preserves_live_business_and_application(self):
        """Persist a pending proposal and captured baseline only."""
        response = self._submit("  Sugbo Heritage Bistro  ")

        self.assertEqual(response.status_code, 201)
        request = BusinessNameChangeRequest.objects.get()
        self.assertEqual(request.BNCR_PREVIOUS_BUSINESS_NAME, "Sugbo Bistro")
        self.assertEqual(request.BNCR_PROPOSED_BUSINESS_NAME, "Sugbo Heritage Bistro")
        self.assertEqual(request.BNCR_STATUS, "pending")
        self.assertIsNotNone(request.BNCR_SUBMITTED_AT)
        self.business.refresh_from_db()
        self.identity.refresh_from_db()
        self.application.refresh_from_db()
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Bistro")
        self.assertEqual(self.identity.MIDN_BUSINESS_NAME, "Sugbo Bistro")
        self.assertEqual(self.application.MAPP_STATUS, "approved")
        self.assertEqual(response.data["data"]["request_type"], "business_name")
        self.assertNotIn("reviewer", response.data["data"])

    def test_submission_rejects_invalid_unchanged_and_second_pending_name(self):
        """Return controlled validation failures without changing the name."""
        self.assertEqual(self._submit("A").status_code, 400)
        self.assertEqual(self._submit("  Sugbo Bistro  ").status_code, 400)
        self.assertEqual(self._submit().status_code, 201)
        duplicate = self._submit("Another Name")
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.data["code"], "VALIDATION_ERROR")
        self.assertEqual(BusinessNameChangeRequest.objects.count(), 1)

    def test_pending_uniqueness_is_enforced_by_database(self):
        """Block duplicate pending rows even outside the service."""
        self._submit()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BusinessNameChangeRequest.objects.create(
                    BUSN_ID=self.business,
                    USER_ID=self.merchant,
                    BNCR_PREVIOUS_BUSINESS_NAME="Sugbo Bistro",
                    BNCR_PROPOSED_BUSINESS_NAME="Different Name",
                    BNCR_SUBMITTED_AT=BusinessNameChangeRequest.objects.get().BNCR_SUBMITTED_AT,
                )

    def test_active_approval_cooldown_blocks_submission_and_is_exposed(self):
        """Return seven-day name eligibility and reject a new submission."""
        resolved_at = timezone.now()
        approved = BusinessNameChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            BNCR_PREVIOUS_BUSINESS_NAME="Previous Bistro",
            BNCR_PROPOSED_BUSINESS_NAME=self.business.BUSN_NAME,
            BNCR_STATUS=BusinessNameChangeRequest.Status.APPROVED,
            BNCR_SUBMITTED_AT=resolved_at - timedelta(days=1),
            BNCR_RESOLVED_AT=resolved_at,
        )

        eligibility = self.client.get(
            self.merchant_list_url,
        ).data["data"]["eligibility"]
        blocked = self._submit("Another Bistro")

        self.assertFalse(eligibility["can_submit"])
        self.assertEqual(eligibility["reason"], "cooldown")
        self.assertEqual(eligibility["cooldown_duration_hours"], 168)
        self.assertEqual(
            eligibility["last_approved_request_id"],
            approved.pk,
        )
        self.assertIsNone(eligibility["pending_request_id"])
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.data["errors"]["reason"], ["cooldown"])
        self.assertEqual(BusinessNameChangeRequest.objects.count(), 1)

    def test_missing_and_suspended_business_cannot_submit(self):
        """Honor the established owner lookup and active-status guard."""
        unowned_merchant = User.objects.create_user(
            email="no-business@example.com",
            password="StrongPassword123!",
            USER_FNAME="No",
            USER_LNAME="Business",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.client.force_authenticate(user=unowned_merchant)
        missing = self._submit()
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.data["message"], "Your business could not be found.")

        self.client.force_authenticate(user=self.merchant)
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])
        self.assertEqual(self._submit().status_code, 403)

    def test_merchant_history_detail_and_foreign_request_protection(self):
        """Expose own terminal history without revealing another owner's IDs."""
        first = self._submit()
        first_id = first.data["data"]["id"]
        withdraw = self.client.post(
            f"{self._merchant_detail_url(first_id)}withdraw/",
        )
        self.assertEqual(withdraw.status_code, 200)
        second = self._submit("Sugbo New Bistro")
        second_id = second.data["data"]["id"]
        self.assertEqual(second.status_code, 201)

        history = self.client.get(self.merchant_list_url)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(
            [item["id"] for item in history.data["data"]["items"]],
            [second_id, first_id],
        )
        self.assertEqual(
            self.client.get(self._merchant_detail_url(first_id)).data["data"]["status"],
            "withdrawn",
        )

        self.client.force_authenticate(user=self.other_merchant)
        self.assertEqual(self.client.get(self._merchant_detail_url(first_id)).status_code, 404)
        self.assertEqual(
            self.client.post(f"{self._merchant_detail_url(second_id)}withdraw/").status_code,
            404,
        )
        self.assertEqual(self.client.get(self.merchant_list_url).data["data"]["items"], [])

    def test_withdrawal_is_pending_only_and_does_not_change_business(self):
        """Keep withdrawn requests as terminal history."""
        request_id = self._submit().data["data"]["id"]
        url = f"{self._merchant_detail_url(request_id)}withdraw/"
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 400)
        request = BusinessNameChangeRequest.objects.get(pk=request_id)
        self.assertEqual(request.BNCR_STATUS, "withdrawn")
        self.assertIsNotNone(request.BNCR_RESOLVED_AT)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Bistro")
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(
            self.client.post(f"{self._admin_detail_url(request_id)}approve/").status_code,
            400,
        )

    def test_admin_queue_detail_permissions_and_resolution_fields(self):
        """Provide review context to Admin and Super Admin only."""
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/name-cover.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])
        request_id = self._submit().data["data"]["id"]
        self.client.force_authenticate(user=self.explorer)
        self.assertEqual(self.client.get(self.admin_list_url).status_code, 403)
        self.client.force_authenticate(user=self.merchant)
        self.assertEqual(self.client.get(self.admin_list_url).status_code, 403)
        self.client.force_authenticate(user=self.admin)
        queue = self.client.get(self.admin_list_url)
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(queue.data["data"]["items"][0]["id"], request_id)
        self.assertEqual(
            queue.data["data"]["items"][0]["cover_photo_url"],
            "https://example.com/name-cover.jpg",
        )
        detail = self.client.get(self._admin_detail_url(request_id))
        self.assertEqual(detail.data["data"]["current_business_name"], "Sugbo Bistro")
        self.assertEqual(
            detail.data["data"]["cover_photo_url"],
            "https://example.com/name-cover.jpg",
        )
        self.assertEqual(detail.data["data"]["previous_business_name"], "Sugbo Bistro")
        self.assertEqual(detail.data["data"]["proposed_business_name"], "Sugbo Heritage Bistro")
        self.assertEqual(detail.data["data"]["merchant"]["email"], self.merchant.USER_EMAIL)
        self.client.force_authenticate(user=self.super_admin)
        self.assertEqual(self.client.get(self.admin_list_url).status_code, 200)

    def test_approval_updates_live_name_and_is_terminal(self):
        """Apply and record a decision together while retaining onboarding name."""
        request_id = self._submit().data["data"]["id"]
        self.client.force_authenticate(user=self.admin)
        url = f"{self._admin_detail_url(request_id)}approve/"
        approved = self.client.post(url)
        self.assertEqual(approved.status_code, 200)
        self.business.refresh_from_db()
        self.identity.refresh_from_db()
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Heritage Bistro")
        self.assertEqual(self.identity.MIDN_BUSINESS_NAME, "Sugbo Bistro")
        self.assertEqual(approved.data["data"]["status"], "approved")
        self.assertEqual(approved.data["data"]["reviewer"]["email"], self.admin.USER_EMAIL)
        self.assertIsNotNone(approved.data["data"]["resolved_at"])
        self.assertEqual(self.client.post(url).status_code, 400)
        self.assertEqual(
            self.client.post(
                f"{self._admin_detail_url(request_id)}reject/",
                {"rejection_reason": "Already reviewed."},
                format="json",
            ).status_code,
            400,
        )
        self.client.force_authenticate(user=self.merchant)
        self.assertEqual(
            self.client.post(
                f"{self._merchant_detail_url(request_id)}withdraw/"
            ).status_code,
            400,
        )

    def test_stale_approval_preserves_current_name_and_pending_request(self):
        """Do not apply a proposal based on an outdated live name."""
        request_id = self._submit().data["data"]["id"]
        self.business.BUSN_NAME = "Another Current Name"
        self.business.save(update_fields=["BUSN_NAME"])
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"{self._admin_detail_url(request_id)}approve/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("outdated", response.data["message"])
        self.business.refresh_from_db()
        request = BusinessNameChangeRequest.objects.get(pk=request_id)
        self.assertEqual(self.business.BUSN_NAME, "Another Current Name")
        self.assertEqual(request.BNCR_STATUS, "pending")
        self.assertIsNone(request.REVIEWER_ID)
        self.assertIsNone(request.BNCR_RESOLVED_AT)

    def test_approval_rolls_back_live_name_if_decision_save_fails(self):
        """A failed decision write cannot leave a partially applied name."""
        request_id = self._submit().data["data"]["id"]

        with patch.object(
            BusinessNameChangeRequest,
            "save",
            side_effect=RuntimeError("decision persistence failed"),
        ):
            with self.assertRaises(RuntimeError):
                BusinessNameChangeService.approve(request_id, self.admin)

        self.business.refresh_from_db()
        change_request = BusinessNameChangeRequest.objects.get(pk=request_id)
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Bistro")
        self.assertEqual(change_request.BNCR_STATUS, "pending")
        self.assertIsNone(change_request.REVIEWER_ID)

    def test_admin_pending_filter_and_missing_request(self):
        """The queue filters by status and missing detail is controlled."""
        request_id = self._submit().data["data"]["id"]
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(
            self.client.get(f"{self.admin_list_url}?status=pending")
            .data["data"]["items"][0]["id"],
            request_id,
        )
        self.assertEqual(
            self.client.get(f"{self.admin_list_url}?status=unknown").status_code,
            400,
        )
        self.assertEqual(self.client.get(self._admin_detail_url(99999)).status_code, 404)

    def test_suspended_business_cannot_receive_approval(self):
        """Revalidate business eligibility when Admin decides."""
        request_id = self._submit().data["data"]["id"]
        self.business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.business.save(update_fields=["BUSN_STATUS"])
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"{self._admin_detail_url(request_id)}approve/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            BusinessNameChangeRequest.objects.get(pk=request_id).BNCR_STATUS,
            "pending",
        )

    def test_approval_revalidates_stored_proposed_name(self):
        """An invalid stored proposal cannot bypass approval validation."""
        request_id = self._submit().data["data"]["id"]
        BusinessNameChangeRequest.objects.filter(pk=request_id).update(
            BNCR_PROPOSED_BUSINESS_NAME="A",
        )
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(
            self.client.post(
                f"{self._admin_detail_url(request_id)}approve/"
            ).status_code,
            400,
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Bistro")

    def test_rejection_requires_reason_and_preserves_name(self):
        """Store a reviewer-visible decision and merchant-facing reason."""
        request_id = self._submit().data["data"]["id"]
        self.client.force_authenticate(user=self.admin)
        url = f"{self._admin_detail_url(request_id)}reject/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        self.assertEqual(
            self.client.post(
                url,
                {"rejection_reason": "   "},
                format="json",
            ).status_code,
            400,
        )
        rejected = self.client.post(
            url,
            {"rejection_reason": "The submitted name needs clarification."},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["data"]["status"], "rejected")
        self.assertEqual(rejected.data["data"]["reviewer"]["email"], self.admin.USER_EMAIL)
        self.assertIsNotNone(rejected.data["data"]["resolved_at"])
        self.assertEqual(self.client.post(url, {"rejection_reason": "Again"}).status_code, 400)
        self.business.refresh_from_db()
        self.assertEqual(self.business.BUSN_NAME, "Sugbo Bistro")
        self.client.force_authenticate(user=self.merchant)
        detail = self.client.get(self._merchant_detail_url(request_id))
        self.assertEqual(
            detail.data["data"]["rejection_reason"],
            "The submitted name needs clarification.",
        )

    def test_authentication_is_required_for_both_surfaces(self):
        """Reject anonymous access to merchant and Admin request APIs."""
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.merchant_list_url).status_code, (401, 403))
        self.assertIn(self.client.get(self.admin_list_url).status_code, (401, 403))


class BusinessNameChangeSubmissionConcurrencyTests(TransactionTestCase):
    """Verify simultaneous submissions cannot create two pending requests."""

    def setUp(self):
        """Create committed rows visible to separate database connections."""
        self.merchant = User.objects.create_user(
            email="concurrent-name-owner@example.com",
            password="StrongPassword123!",
            USER_FNAME="Concurrent",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Concurrent Food")
        category = Category.objects.create(
            CTGRY_NAME="Concurrent Cafe",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Concurrent address",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Concurrent Cafe",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )

    def test_parallel_submissions_create_only_one_pending_request(self):
        """Serialize submissions through the locked business row."""
        barrier = Barrier(2)

        def submit(name):
            """Submit from a separate connection after a simultaneous start."""
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                try:
                    BusinessNameChangeService.submit(
                        self.merchant,
                        name,
                    )
                    return "created"
                except ValidationError:
                    return "blocked"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = [
                future.result(timeout=20)
                for future in (
                    executor.submit(submit, "Concurrent Cafe One"),
                    executor.submit(submit, "Concurrent Cafe Two"),
                )
            ]

        self.assertCountEqual(results, ["created", "blocked"])
        self.assertEqual(
            BusinessNameChangeRequest.objects.filter(
                BUSN_ID=self.business,
                BNCR_STATUS=BusinessNameChangeRequest.Status.PENDING,
            ).count(),
            1,
        )
