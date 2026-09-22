from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.business.models import (
    Business,
    BusinessLandmark,
    BusinessOperatingHours,
    BusinessPhoto,
    BusinessSpecialtyTag,
    Cluster,
    DiscoveryScore,
)
from apps.business.services.discovery_score_service import DiscoveryScoreService
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationReview,
    MerchantApplicationSubmission,
)
from apps.merchant_application.tests.test_services import MerchantApplicationServiceMixin
from apps.users.models import User


class AdmissionDiscoveryTests(MerchantApplicationServiceMixin, APITestCase):
    """Exercise both admission endpoints through the public Discovery feed."""

    def setUp(self):
        super().setUp()
        cache.clear()
        self.user.USER_ROLE = User.UserRole.EXPLORER
        self.user.save(update_fields=["USER_ROLE"])
        self.admin = User.objects.create_user(
            email="admission-admin@example.com",
            password=None,
            USER_FNAME="Admission",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.application = self._build_complete_application()
        self.client.force_authenticate(self.user)
        self.feed_url = reverse("discovery-feed")
        self.submit_url = reverse("application-submit")
        self.review_url = reverse("application-review", args=[self.application.pk])
        self.approve_url = reverse(
            "merchant-application-approve",
            args=[self.application.pk],
        )

    def _submit(self):
        """Submit the saved application through the merchant API."""
        self.client.force_authenticate(self.user)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200, response.data)
        self.application.refresh_from_db()

    def _assert_approval_reaches_feed(self, legacy):
        """Check copied business data and immediate eligibility without a score."""
        self._submit()
        self.assertEqual(self.client.get(self.feed_url).data["data"]["items"], [])
        self.client.force_authenticate(self.admin)

        with patch.object(DiscoveryScoreService, "recompute_business_scores") as batch:
            with patch.object(DiscoveryScoreService, "recompute_business_score") as score:
                response = (
                    self.client.patch(self.review_url, {"action": "approve"}, format="json")
                    if legacy
                    else self.client.post(self.approve_url)
                )
                self.assertEqual(response.status_code, 200, response.data)
                batch.assert_not_called()
                score.assert_not_called()

        self.application.refresh_from_db()
        self.user.refresh_from_db()
        business = self.application.BUSN_ID
        self.assertIsNotNone(business)
        self.assertEqual(self.application.MAPP_STATUS, MerchantApplication.ApplicationStatus.APPROVED)
        self.assertEqual(self.user.USER_ROLE, User.UserRole.MERCHANT)
        self.assertEqual(business.BUSN_STATUS, Business.BusinessStatus.ACTIVE)
        self.assertEqual(business.LOCT_ID.LOCT_POINT, self.application.location.MLOC_POINT)
        self.assertEqual(BusinessPhoto.objects.filter(BUSN_ID=business).count(), 1)
        self.assertEqual(BusinessOperatingHours.objects.filter(BUSN_ID=business).count(), 7)
        self.assertEqual(BusinessLandmark.objects.filter(LOCT_ID=business.LOCT_ID).count(), 2)
        self.assertEqual(BusinessSpecialtyTag.objects.filter(BUSN_ID=business).count(), 3)
        self.assertFalse(DiscoveryScore.objects.filter(BUSN_ID=business).exists())
        review = MerchantApplicationReview.objects.get(MAPP_ID=self.application)
        self.assertEqual(review.USER_ID_id, self.admin.pk)
        self.assertEqual(review.MASUB_ID.MASUB_SUBMISSION_NUMBER, 1)

        self.client.force_authenticate(self.user)
        profile = self.client.get(reverse("me"))
        self.assertEqual(profile.data["data"]["role"], User.UserRole.MERCHANT)
        acknowledged = self.client.patch(reverse("acknowledge-merchant-mode"))
        self.assertEqual(acknowledged.status_code, 200, acknowledged.data)
        response = self.client.get(self.feed_url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(business.pk, [item["id"] for item in response.data["data"]["items"]])
        # The admin URLconf also declares the business-detail name.
        detail = self.client.get(
            f"/api/explorer/explore/businesses/{business.pk}/",
        )
        self.assertEqual(detail.status_code, 200, detail.data)

        self.client.force_authenticate(self.admin)
        duplicate = self.client.post(self.approve_url)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(Business.objects.filter(USER_ID=self.user).count(), 1)
        self.assertEqual(MerchantApplicationReview.objects.filter(MAPP_ID=self.application).count(), 1)

    def test_admin_approval_publishes_business_before_first_score_run(self):
        self._assert_approval_reaches_feed(legacy=False)

    def test_legacy_approval_uses_the_same_publication_flow(self):
        self._assert_approval_reaches_feed(legacy=True)

    def test_legacy_rejection_records_reviewer_and_feedback_without_publication(self):
        self._submit()
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            self.review_url,
            {
                "action": "reject",
                "rejection_reason": "Category does not match the business.",
                "feedback": [{"section": "identity", "message": "Correct the category."}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.application.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, MerchantApplication.ApplicationStatus.REJECTED)
        self.assertEqual(self.user.USER_ROLE, User.UserRole.EXPLORER)
        self.assertIsNone(self.application.BUSN_ID_id)
        review = MerchantApplicationReview.objects.get(MAPP_ID=self.application)
        self.assertEqual(review.USER_ID_id, self.admin.pk)
        self.assertEqual(review.feedback.get().MAPF_MESSAGE, "Correct the category.")
        self.assertEqual(response.data["data"]["latest_review"]["decision"], "rejected")
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(self.feed_url).data["data"]["items"], [])

    def test_legacy_review_requires_admin_and_an_existing_submitted_application(self):
        response = self.client.patch(self.review_url, {"action": "approve"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.patch(self.review_url, {"action": "approve"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.patch(
            reverse("application-review", args=[self.application.pk + 1000]),
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_submission_rejects_preexisting_category_cluster_mismatch(self):
        self._mismatch_cluster()
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("business_category_id", response.data["errors"])
        self.application.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, MerchantApplication.ApplicationStatus.DRAFT)
        self.assertFalse(MerchantApplicationSubmission.objects.filter(MAPP_ID=self.application).exists())

    def test_approval_rechecks_category_alignment_before_publishing(self):
        self._submit()
        self._mismatch_cluster()
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.approve_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn("business_category_id", response.data["errors"])
        self.application.refresh_from_db()
        self.assertEqual(self.application.MAPP_STATUS, MerchantApplication.ApplicationStatus.SUBMITTED)
        self.assertFalse(Business.objects.filter(USER_ID=self.user).exists())
        self.assertFalse(MerchantApplicationReview.objects.filter(MAPP_ID=self.application).exists())

    def _mismatch_cluster(self):
        """Represent a legacy inconsistent identity that bypassed input validation."""
        identity = self.application.identity
        identity.CLUS_ID = Cluster.objects.create(CLUS_NAME="Mismatched Cluster")
        identity.save(update_fields=["CLUS_ID"])
