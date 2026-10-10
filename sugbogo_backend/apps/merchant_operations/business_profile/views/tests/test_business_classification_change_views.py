from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.db import IntegrityError, close_old_connections, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    Category,
    Cluster,
    Location,
    SpecialtyTag,
)
from apps.business.services.vouch_service import VouchService
from apps.merchant_application.models import MerchantApplication
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessClassificationSpecialtySnapshot,
    BusinessNameChangeRequest,
)
from apps.merchant_operations.business_profile.services.business_classification_change_service import (
    BusinessClassificationChangeService,
)
from apps.users.models import User


class BusinessClassificationChangeViewTests(TestCase):
    """Exercise owner and Admin classification request lifecycle contracts."""

    @classmethod
    def setUpTestData(cls):
        """Create two owned businesses and a taxonomy with reusable tags."""
        cls.merchant = cls._user("classification-owner@example.com", User.UserRole.MERCHANT)
        cls.other_merchant = cls._user(
            "classification-other@example.com",
            User.UserRole.MERCHANT,
        )
        cls.admin = cls._user("classification-admin@example.com", User.UserRole.ADMIN)
        cls.super_admin = cls._user(
            "classification-super@example.com",
            User.UserRole.SUPER_ADMIN,
        )
        cls.explorer = cls._user(
            "classification-explorer@example.com",
            User.UserRole.EXPLORER,
        )
        cls.old_cluster = Cluster.objects.create(CLUS_NAME="Food")
        cls.new_cluster = Cluster.objects.create(CLUS_NAME="Crafts")
        cls.old_category = Category.objects.create(
            CTGRY_NAME="Restaurants",
            CLUS_ID=cls.old_cluster,
        )
        cls.new_category = Category.objects.create(
            CTGRY_NAME="Workshops",
            CLUS_ID=cls.new_cluster,
        )
        cls.business = cls._business(cls.merchant, "Owner Business")
        cls.other_business = cls._business(cls.other_merchant, "Other Business")
        cls.tags = [
            SpecialtyTag.objects.create(TAG_NAME=f"Specialty {index}")
            for index in range(1, 6)
        ]
        cls.links = [
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=cls.business,
                TAG_ID=tag,
            )
            for tag in cls.tags[:3]
        ]
        cls.application = MerchantApplication.objects.create(
            USER_ID=cls.merchant,
            BUSN_ID=cls.business,
            MAPP_STATUS=MerchantApplication.ApplicationStatus.APPROVED,
        )

    @staticmethod
    def _user(email, role):
        """Create an active user with the required role."""
        return User.objects.create_user(
            email=email,
            password="StrongPassword123!",
            USER_FNAME="Test",
            USER_LNAME="User",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

    @classmethod
    def _business(cls, owner, name):
        """Create an active business with a valid location."""
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
        )
        return Business.objects.create(
            BUSN_NAME=name,
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=owner,
            CTGRY_ID=cls.old_category,
            LOCT_ID=location,
        )

    def setUp(self):
        """Authenticate as the owner for each independent test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.merchant)
        self.merchant_url = (
            "/api/merchant/business-profile/update-requests/classification/"
        )
        self.admin_url = "/api/admin/businesses/update-requests/classification/"

    def _submit(self, category=None, tags=None):
        """Submit a complete category and tag proposal through the API."""
        if category is None:
            category = self.new_category
        if tags is None:
            tags = [self.tags[1], self.tags[2], self.tags[3]]
        return self.client.post(
            self.merchant_url,
            {
                "proposed_category_id": category.CTGRY_ID,
                "proposed_specialty_tag_ids": [tag.TAG_ID for tag in tags],
                "reason": "Our products and services have changed.",
            },
            format="json",
        )

    def _detail(self, request_id, admin=False):
        """Return the appropriate request detail URL."""
        root = self.admin_url if admin else self.merchant_url
        return f"{root}{request_id}/"

    def _approve(self, request_id, reviewer=None):
        """Post an Admin approval request."""
        self.client.force_authenticate(user=reviewer or self.admin)
        return self.client.post(f"{self._detail(request_id, admin=True)}approve/")

    def test_decision_notifications_reach_only_request_submitter(self):
        from apps.notifications.models import Notification

        for outcome in ("rejected", "approved"):
            response = self._submit()
            self.assertEqual(response.status_code, 201, response.data)
            request = BusinessClassificationChangeRequest.objects.order_by("-pk").first()
            self.assertEqual(Notification.objects.count(), int(outcome == "approved"))
            if outcome == "approved":
                BusinessClassificationChangeService.approve(request.pk, self.admin)
            else:
                BusinessClassificationChangeService.reject(request.pk, self.admin, "Private rejection reason.")
            notification = Notification.objects.get(
                NOTF_DEDUP_KEY=f"business_classification_change:{request.pk}:resolved",
            )
            self.assertEqual(notification.USER_ID_id, self.merchant.pk)
            self.assertEqual(notification.NOTF_TYPE, f"business_classification_change_{outcome}")
            self.assertEqual(notification.NOTF_TARGET_ID, request.pk)
            self.assertEqual(notification.NOTF_TARGET_TYPE, "business_classification_change")
            self.assertNotIn("Private rejection reason", notification.NOTF_BODY)
        self.assertEqual(Notification.objects.count(), 2)

    def test_notification_failure_rolls_back_both_request_decisions(self):
        from apps.notifications.models import Notification

        response = self._submit()
        self.assertEqual(response.status_code, 201, response.data)
        request = BusinessClassificationChangeRequest.objects.get()
        previous_business = dict(type(self.business).objects.values().get(pk=self.business.pk))
        for outcome in ("approved", "rejected"):
            with self.subTest(outcome=outcome):
                with patch(
                    "apps.notifications.services.notification_event_service.NotificationService.create",
                    side_effect=RuntimeError("Inbox storage unavailable"),
                ):
                    with self.assertRaises(RuntimeError):
                        if outcome == "approved":
                            BusinessClassificationChangeService.approve(request.pk, self.admin)
                        else:
                            BusinessClassificationChangeService.reject(request.pk, self.admin, "Private rejection reason.")
                request.refresh_from_db()
                self.assertEqual(request.BCCR_STATUS, "pending")
                self.assertIsNone(request.REVIEWER_ID_id)
                self.assertEqual(
                    dict(type(self.business).objects.values().get(pk=self.business.pk)),
                    previous_business,
                )
                self.assertFalse(Notification.objects.exists())

    def test_submission_captures_snapshots_without_changing_live_or_application(self):
        """Keep classification and historical application intact while pending."""
        response = self._submit()
        self.assertEqual(response.status_code, 201, response.data)
        request = BusinessClassificationChangeRequest.objects.get()
        self.assertEqual(request.BCCR_STATUS, "pending")
        self.assertEqual(request.BCCR_MERCHANT_REASON, "Our products and services have changed.")
        self.assertEqual(response.data["data"]["reason"], "Our products and services have changed.")
        self.assertEqual(request.PREVIOUS_CTGRY_ID_id, self.old_category.pk)
        self.assertEqual(request.PROPOSED_CTGRY_ID_id, self.new_category.pk)
        self.assertEqual(request.BCCR_PREVIOUS_CATEGORY_NAME, "Restaurants")
        self.assertEqual(request.BCCR_PREVIOUS_CLUSTER_ID, self.old_cluster.pk)
        self.assertEqual(request.BCCR_PREVIOUS_CLUSTER_NAME, "Food")
        self.assertEqual(request.BCCR_PROPOSED_CATEGORY_NAME, "Workshops")
        self.assertEqual(request.BCCR_PROPOSED_CLUSTER_ID, self.new_cluster.pk)
        self.assertEqual(request.BCCR_PROPOSED_CLUSTER_NAME, "Crafts")
        self.assertEqual(request.specialty_snapshots.count(), 6)
        self.assertEqual(
            {item["id"] for item in response.data["data"]["previous"]["specialty_tags"]},
            {tag.pk for tag in self.tags[:3]},
        )
        self.assertEqual(
            {item["id"] for item in response.data["data"]["proposed"]["specialty_tags"]},
            {tag.pk for tag in self.tags[1:4]},
        )
        self.assertEqual(response.data["data"]["request_type"], "classification")
        self.assertNotIn("reviewer", response.data["data"])
        self.business.refresh_from_db()
        self.application.refresh_from_db()
        self.assertEqual(self.business.CTGRY_ID_id, self.old_category.pk)
        self.assertEqual(
            set(BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
                BST_IS_ACTIVE=True,
            ).values_list("TAG_ID_id", flat=True)),
            {tag.pk for tag in self.tags[:3]},
        )
        self.assertEqual(self.application.MAPP_STATUS, "approved")

    def test_active_approval_cooldown_blocks_submission_and_is_exposed(self):
        """Return seven-day classification eligibility and reject submission."""
        resolved_at = timezone.now()
        approved = BusinessClassificationChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            PREVIOUS_CTGRY_ID=self.old_category,
            PROPOSED_CTGRY_ID=self.old_category,
            BCCR_PREVIOUS_CATEGORY_NAME=self.old_category.CTGRY_NAME,
            BCCR_PREVIOUS_CLUSTER_ID=self.old_cluster.pk,
            BCCR_PREVIOUS_CLUSTER_NAME=self.old_cluster.CLUS_NAME,
            BCCR_PROPOSED_CATEGORY_NAME=self.old_category.CTGRY_NAME,
            BCCR_PROPOSED_CLUSTER_ID=self.old_cluster.pk,
            BCCR_PROPOSED_CLUSTER_NAME=self.old_cluster.CLUS_NAME,
            BCCR_STATUS=BusinessClassificationChangeRequest.Status.APPROVED,
            BCCR_SUBMITTED_AT=resolved_at - timedelta(days=1),
            BCCR_RESOLVED_AT=resolved_at,
        )

        eligibility = self.client.get(
            self.merchant_url,
        ).data["data"]["eligibility"]
        blocked = self._submit()

        self.assertFalse(eligibility["can_submit"])
        self.assertEqual(eligibility["reason"], "cooldown")
        self.assertEqual(eligibility["cooldown_duration_hours"], 168)
        self.assertEqual(
            eligibility["last_approved_request_id"],
            approved.pk,
        )
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.data["errors"]["reason"], ["cooldown"])
        self.assertEqual(
            BusinessClassificationChangeRequest.objects.count(),
            1,
        )

    def test_submission_rejects_invalid_taxonomy_and_unchanged_sets(self):
        """Validate count, uniqueness, existence, and unordered no-op sets."""
        for ids in (
            [self.tags[0].pk, self.tags[1].pk],
            [self.tags[0].pk, self.tags[0].pk, self.tags[1].pk],
            [self.tags[0].pk, self.tags[1].pk, 999999],
        ):
            with self.subTest(ids=ids):
                response = self.client.post(
                    self.merchant_url,
                    {
                        "proposed_category_id": self.new_category.pk,
                        "proposed_specialty_tag_ids": ids,
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 400, response.data)

        missing_category = self.client.post(
            self.merchant_url,
            {
                "proposed_category_id": 999999,
                "proposed_specialty_tag_ids": [tag.pk for tag in self.tags[:3]],
            },
            format="json",
        )
        self.assertEqual(missing_category.status_code, 400)
        unchanged = self._submit(
            category=self.old_category,
            tags=[self.tags[2], self.tags[0], self.tags[1]],
        )
        self.assertEqual(unchanged.status_code, 400)
        independent_cluster = self.client.post(
            self.merchant_url,
            {
                "proposed_category_id": self.new_category.pk,
                "proposed_cluster_id": self.old_cluster.pk,
                "proposed_specialty_tag_ids": [tag.pk for tag in self.tags[1:4]],
            },
            format="json",
        )
        self.assertEqual(independent_cluster.status_code, 400)
        self.assertEqual(BusinessClassificationChangeRequest.objects.count(), 0)

    def test_snapshot_labels_survive_taxonomy_renames(self):
        """Show the submitted labels even when taxonomy names later change."""
        request_id = self._submit().data["data"]["id"]
        Category.objects.filter(pk=self.old_category.pk).update(
            CTGRY_NAME="Renamed Restaurants",
        )
        SpecialtyTag.objects.filter(pk=self.tags[3].pk).update(
            TAG_NAME="Renamed Specialty",
        )
        detail = self.client.get(self._detail(request_id))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(
            detail.data["data"]["previous"]["category"]["name"],
            "Restaurants",
        )
        self.assertIn(
            {"id": self.tags[3].pk, "name": "Specialty 4"},
            detail.data["data"]["proposed"]["specialty_tags"],
        )

    def test_access_pending_uniqueness_and_name_request_coexistence(self):
        """Scope owner access and enforce only classification pending uniqueness."""
        self.client.force_authenticate(user=None)
        self.assertEqual(self._submit().status_code, 401)
        self.client.force_authenticate(user=self.explorer)
        self.assertEqual(self._submit().status_code, 403)
        self.client.force_authenticate(user=self.other_merchant)
        self.other_business.BUSN_STATUS = Business.BusinessStatus.SUSPENDED
        self.other_business.save(update_fields=["BUSN_STATUS"])
        self.assertEqual(self._submit().status_code, 403)
        no_business = self._user("classification-empty@example.com", User.UserRole.MERCHANT)
        self.client.force_authenticate(user=no_business)
        self.assertEqual(self._submit().data["message"], "Your business could not be found.")
        self.client.force_authenticate(user=self.merchant)
        BusinessNameChangeRequest.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.merchant,
            BNCR_PREVIOUS_BUSINESS_NAME=self.business.BUSN_NAME,
            BNCR_PROPOSED_BUSINESS_NAME="New Name",
            BNCR_SUBMITTED_AT=timezone.now(),
        )
        self.assertEqual(self._submit().status_code, 201)
        self.assertEqual(self._submit().status_code, 400)
        request = BusinessClassificationChangeRequest.objects.get()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BusinessClassificationChangeRequest.objects.create(
                    BUSN_ID=self.business,
                    USER_ID=self.merchant,
                    PREVIOUS_CTGRY_ID=self.old_category,
                    PROPOSED_CTGRY_ID=self.new_category,
                    BCCR_PREVIOUS_CATEGORY_NAME="Restaurants",
                    BCCR_PREVIOUS_CLUSTER_ID=self.old_cluster.pk,
                    BCCR_PREVIOUS_CLUSTER_NAME="Food",
                    BCCR_PROPOSED_CATEGORY_NAME="Workshops",
                    BCCR_PROPOSED_CLUSTER_ID=self.new_cluster.pk,
                    BCCR_PROPOSED_CLUSTER_NAME="Crafts",
                    BCCR_SUBMITTED_AT=timezone.now(),
                )
        self.assertEqual(request.BCCR_STATUS, "pending")

    def test_history_ownership_withdrawal_and_terminal_visibility(self):
        """Retain owned terminal requests and hide foreign request IDs."""
        first = self._submit()
        first_id = first.data["data"]["id"]
        self.assertEqual(
            self.client.post(f"{self._detail(first_id)}withdraw/").status_code,
            200,
        )
        self.assertEqual(
            self.client.post(f"{self._detail(first_id)}withdraw/").status_code,
            400,
        )
        second = self._submit(category=self.old_category, tags=self.tags[1:4])
        second_id = second.data["data"]["id"]
        history = self.client.get(self.merchant_url)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(
            [item["id"] for item in history.data["data"]["items"]],
            [second_id, first_id],
        )
        self.assertEqual(self.client.get(self._detail(first_id)).status_code, 200)
        self.client.force_authenticate(user=self.other_merchant)
        self.assertEqual(self.client.get(self._detail(first_id)).status_code, 404)
        self.assertEqual(
            self.client.post(f"{self._detail(second_id)}withdraw/").status_code,
            404,
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.CTGRY_ID_id, self.old_category.pk)

    def test_approval_preserves_retained_removed_and_reactivated_rows(self):
        """Apply a diff without losing prior assignment or vouch state."""
        old_link = self.links[0]
        old_link.BST_VOUCH_COUNT = 1
        old_link.BST_TAG_SCORE = Decimal("0.42000")
        old_link.save(update_fields=["BST_VOUCH_COUNT", "BST_TAG_SCORE"])
        vouch = BusinessVouch.objects.create(
            BUSN_ID=self.business,
            USER_ID=self.explorer,
            TAG_ID=self.tags[0],
            VOUCH_REPUTATION_SNAPSHOT=Decimal("0.50000"),
        )
        historical = BusinessSpecialtyTag.objects.create(
            BUSN_ID=self.business,
            TAG_ID=self.tags[3],
            BST_IS_ACTIVE=False,
            BST_VOUCH_COUNT=2,
            BST_TAG_SCORE=Decimal("0.33000"),
            BST_DEACTIVATED_AT=timezone.now(),
        )
        retained_activation = [link.BST_ACTIVATED_AT for link in self.links[1:]]
        request_id = self._submit().data["data"]["id"]
        with patch(
            "apps.merchant_operations.business_profile.services."
            "business_classification_change_service.recompute_discovery_scores.delay"
        ) as dispatch:
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                response = self._approve(request_id)
            self.assertEqual(len(callbacks), 1)
            dispatch.assert_called_once_with()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data["data"]["reason"],
            "Our products and services have changed.",
        )
        self.business.refresh_from_db()
        self.assertEqual(self.business.CTGRY_ID_id, self.new_category.pk)
        self.assertEqual(self.business.CTGRY_ID.CLUS_ID_id, self.new_cluster.pk)
        old_link.refresh_from_db()
        historical.refresh_from_db()
        self.assertFalse(old_link.BST_IS_ACTIVE)
        self.assertIsNotNone(old_link.BST_DEACTIVATED_AT)
        self.assertEqual(old_link.BST_VOUCH_COUNT, 1)
        self.assertEqual(old_link.BST_TAG_SCORE, Decimal("0.42000"))
        self.assertTrue(BusinessVouch.objects.filter(pk=vouch.pk).exists())
        self.assertTrue(historical.BST_IS_ACTIVE)
        self.assertIsNone(historical.BST_DEACTIVATED_AT)
        self.assertEqual(historical.BST_VOUCH_COUNT, 2)
        self.assertEqual(historical.BST_TAG_SCORE, Decimal("0.33000"))
        for link, activation in zip(self.links[1:], retained_activation):
            link.refresh_from_db()
            self.assertEqual(link.BST_ACTIVATED_AT, activation)
        self.assertEqual(
            set(BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
                BST_IS_ACTIVE=True,
            ).values_list("TAG_ID_id", flat=True)),
            {tag.pk for tag in self.tags[1:4]},
        )
        request = BusinessClassificationChangeRequest.objects.get(pk=request_id)
        self.assertEqual(request.BCCR_STATUS, "approved")
        self.assertEqual(request.REVIEWER_ID_id, self.admin.pk)
        self.assertIsNotNone(request.BCCR_RESOLVED_AT)
        self.assertEqual(self._approve(request_id).status_code, 400)

    def test_new_assignment_and_one_part_changes(self):
        """Create only truly new tags and allow category-only or tag-only work."""
        category_only = self._submit(category=self.new_category, tags=self.tags[:3])
        self.assertEqual(category_only.status_code, 201)
        self.assertEqual(self._approve(category_only.data["data"]["id"]).status_code, 200)
        BusinessClassificationChangeRequest.objects.filter(
            pk=category_only.data["data"]["id"],
        ).update(
            BCCR_RESOLVED_AT=timezone.now() - timedelta(days=7),
        )
        self.client.force_authenticate(user=self.merchant)
        tag_only = self._submit(category=self.new_category, tags=self.tags[1:4])
        self.assertEqual(tag_only.status_code, 201)
        self.assertEqual(self._approve(tag_only.data["data"]["id"]).status_code, 200)
        created = BusinessSpecialtyTag.objects.get(
            BUSN_ID=self.business,
            TAG_ID=self.tags[3],
        )
        self.assertTrue(created.BST_IS_ACTIVE)
        self.assertEqual(created.BST_VOUCH_COUNT, 0)
        self.assertEqual(created.BST_TAG_SCORE, Decimal("0.00000"))

    def test_stale_baselines_and_proposed_taxonomy_are_blocked(self):
        """Reject stale category, cluster, specialty, and proposed taxonomy."""
        scenarios = ("category", "cluster", "specialty", "proposed_cluster")
        for scenario in scenarios:
            with self.subTest(scenario=scenario):
                response = self._submit()
                request_id = response.data["data"]["id"]
                if scenario == "category":
                    Business.objects.filter(pk=self.business.pk).update(
                        CTGRY_ID=self.new_category,
                    )
                elif scenario == "cluster":
                    Category.objects.filter(pk=self.old_category.pk).update(
                        CLUS_ID=self.new_cluster,
                    )
                elif scenario == "specialty":
                    BusinessSpecialtyTag.objects.filter(pk=self.links[0].pk).update(
                        BST_IS_ACTIVE=False,
                    )
                else:
                    Category.objects.filter(pk=self.new_category.pk).update(
                        CLUS_ID=self.old_cluster,
                    )
                with patch(
                    "apps.merchant_operations.business_profile.services."
                    "business_classification_change_service.recompute_discovery_scores.delay"
                ) as dispatch:
                    with self.captureOnCommitCallbacks(execute=True) as callbacks:
                        approval = self._approve(request_id)
                    dispatch.assert_not_called()
                    self.assertEqual(callbacks, [])
                self.assertEqual(approval.status_code, 400, approval.data)
                self.assertEqual(
                    BusinessClassificationChangeRequest.objects.get(
                        pk=request_id,
                    ).BCCR_STATUS,
                    "pending",
                )
                self.client.force_authenticate(user=self.merchant)
                self.client.post(f"{self._detail(request_id)}withdraw/")
                Business.objects.filter(pk=self.business.pk).update(
                    CTGRY_ID=self.old_category,
                )
                Category.objects.filter(pk=self.old_category.pk).update(
                    CLUS_ID=self.old_cluster,
                )
                Category.objects.filter(pk=self.new_category.pk).update(
                    CLUS_ID=self.new_cluster,
                )
                BusinessSpecialtyTag.objects.filter(pk=self.links[0].pk).update(
                    BST_IS_ACTIVE=True,
                )

    def test_rejection_and_admin_permissions(self):
        """Require Admin role and reason; never mutate live classification."""
        self.business.BUSN_COVER_PHOTO_URL = "https://example.com/classification-cover.jpg"
        self.business.save(update_fields=["BUSN_COVER_PHOTO_URL"])
        request_id = self._submit().data["data"]["id"]
        self.assertEqual(self.client.get(self.admin_url).status_code, 403)
        self.client.force_authenticate(user=self.admin)
        queue = self.client.get(f"{self.admin_url}?status=pending")
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(queue.data["data"]["items"][0]["id"], request_id)
        self.assertEqual(
            queue.data["data"]["items"][0]["cover_photo_url"],
            "https://example.com/classification-cover.jpg",
        )
        detail = self.client.get(self._detail(request_id, admin=True))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["data"]["current"]["category"]["id"], self.old_category.pk)
        self.assertEqual(detail.data["data"]["previous"]["category"]["id"], self.old_category.pk)
        self.assertEqual(detail.data["data"]["proposed"]["category"]["id"], self.new_category.pk)
        reject_url = f"{self._detail(request_id, admin=True)}reject/"
        self.assertEqual(self.client.post(reject_url, {}, format="json").status_code, 400)
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            rejected = self.client.post(
                reject_url,
                {"rejection_reason": "Choose a more accurate category."},
                format="json",
            )
        self.assertEqual(callbacks, [])
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["data"]["status"], "rejected")
        self.assertEqual(
            rejected.data["data"]["rejection_reason"],
            "Choose a more accurate category.",
        )
        self.assertEqual(self.client.post(reject_url, {
            "rejection_reason": "Again",
        }, format="json").status_code, 400)
        self.business.refresh_from_db()
        self.assertEqual(self.business.CTGRY_ID_id, self.old_category.pk)
        self.client.force_authenticate(user=self.super_admin)
        self.assertEqual(self.client.get(self.admin_url).status_code, 200)

    def test_approval_rolls_back_when_assignment_or_decision_fails(self):
        """Keep category, assignments, and request pending on write failure."""
        for failing_model in (
            BusinessSpecialtyTag,
            BusinessClassificationChangeRequest,
        ):
            with self.subTest(model=failing_model.__name__):
                request_id = self._submit().data["data"]["id"]
                with patch.object(
                    failing_model,
                    "save",
                    side_effect=RuntimeError("simulated persistence failure"),
                ):
                    with self.assertRaises(RuntimeError):
                        BusinessClassificationChangeService.approve(
                            request_id,
                            self.admin,
                        )
                self.business.refresh_from_db()
                self.assertEqual(self.business.CTGRY_ID_id, self.old_category.pk)
                self.assertEqual(
                    set(BusinessSpecialtyTag.objects.filter(
                        BUSN_ID=self.business,
                        BST_IS_ACTIVE=True,
                    ).values_list("TAG_ID_id", flat=True)),
                    {tag.pk for tag in self.tags[:3]},
                )
                self.assertEqual(
                    BusinessClassificationChangeRequest.objects.get(
                        pk=request_id,
                    ).BCCR_STATUS,
                    "pending",
                )
                self.client.post(f"{self._detail(request_id)}withdraw/")

    def test_final_active_set_failure_rolls_back_every_write(self):
        """Reject an incomplete final set after the diff without partial state."""
        request_id = self._submit().data["data"]["id"]
        with patch.object(BusinessSpecialtyTag.objects, "create", return_value=None):
            with self.assertRaisesMessage(
                ValidationError,
                "The final specialty selection is invalid.",
            ):
                BusinessClassificationChangeService.approve(
                    request_id,
                    self.admin,
                )
        self.business.refresh_from_db()
        self.assertEqual(self.business.CTGRY_ID_id, self.old_category.pk)
        self.assertEqual(
            set(BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
                BST_IS_ACTIVE=True,
            ).values_list("TAG_ID_id", flat=True)),
            {tag.pk for tag in self.tags[:3]},
        )
        self.assertEqual(
            BusinessClassificationChangeRequest.objects.get(pk=request_id).BCCR_STATUS,
            "pending",
        )

    def test_dispatch_failure_does_not_undo_committed_approval(self):
        """Retain approved data when post-commit Celery dispatch fails."""
        request_id = self._submit().data["data"]["id"]
        with patch(
            "apps.merchant_operations.business_profile.services."
            "business_classification_change_service.recompute_discovery_scores.delay",
            side_effect=RuntimeError("broker unavailable"),
        ), patch(
            "apps.merchant_operations.business_profile.services."
            "business_classification_change_service.logger.exception"
        ) as logged_error:
            with self.captureOnCommitCallbacks(execute=True):
                response = self._approve(request_id)
        logged_error.assert_called_once()
        self.assertEqual(response.status_code, 200, response.data)
        self.business.refresh_from_db()
        self.assertEqual(self.business.CTGRY_ID_id, self.new_category.pk)
        self.assertEqual(
            BusinessClassificationChangeRequest.objects.get(pk=request_id).BCCR_STATUS,
            "approved",
        )


class BusinessClassificationConcurrencyTests(TransactionTestCase):
    """Exercise classification approval alongside a vouch on a removed tag."""

    def setUp(self):
        """Create committed fixtures visible to independent database connections."""
        self.merchant = BusinessClassificationChangeViewTests._user(
            "concurrent-owner@example.com",
            User.UserRole.MERCHANT,
        )
        self.explorer = BusinessClassificationChangeViewTests._user(
            "concurrent-explorer@example.com",
            User.UserRole.EXPLORER,
        )
        self.admin = BusinessClassificationChangeViewTests._user(
            "concurrent-admin@example.com",
            User.UserRole.ADMIN,
        )
        cluster = Cluster.objects.create(CLUS_NAME="Concurrent Cluster")
        category = Category.objects.create(
            CTGRY_NAME="Concurrent Category",
            CLUS_ID=cluster,
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.8854, 10.3157, srid=4326),
            LOCT_ADDRESS="Gorordo Avenue",
        )
        self.business = Business.objects.create(
            BUSN_NAME="Concurrent Business",
            BUSN_CONTACT_NUMBER="09171234567",
            USER_ID=self.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
        )
        self.tags = [
            SpecialtyTag.objects.create(TAG_NAME=f"Concurrent Tag {index}")
            for index in range(4)
        ]
        for tag in self.tags[:3]:
            BusinessSpecialtyTag.objects.create(
                BUSN_ID=self.business,
                TAG_ID=tag,
            )
        request = BusinessClassificationChangeService.submit(
            user=self.merchant,
            proposed_category_id=category.pk,
            proposed_specialty_tag_ids=[tag.pk for tag in self.tags[1:]],
            reason="Our products and services have changed.",
        )
        self.request_id = request.pk

    def test_parallel_vouch_and_approval_leave_complete_active_set(self):
        """Serialize assignment changes without deadlock or a partial set."""
        barrier = Barrier(2)

        def approve():
            """Approve using a separate database connection."""
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return BusinessClassificationChangeService.approve(
                    self.request_id,
                    self.admin,
                )
            finally:
                close_old_connections()

        def vouch():
            """Try to vouch for the tag being removed concurrently."""
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                try:
                    return VouchService.create_vouch(
                        user=self.explorer,
                        business_id=self.business.pk,
                        tag_id=self.tags[0].pk,
                    )
                except ValidationError:
                    return None
            finally:
                close_old_connections()

        with patch(
            "apps.merchant_operations.business_profile.services."
            "business_classification_change_service.recompute_discovery_scores.delay"
        ):
            with ThreadPoolExecutor(max_workers=2) as executor:
                approval_future = executor.submit(approve)
                vouch_future = executor.submit(vouch)
                approval_future.result(timeout=20)
                vouch_future.result(timeout=20)

        self.assertEqual(
            set(BusinessSpecialtyTag.objects.filter(
                BUSN_ID=self.business,
                BST_IS_ACTIVE=True,
            ).values_list("TAG_ID_id", flat=True)),
            {tag.pk for tag in self.tags[1:]},
        )
        self.assertEqual(
            BusinessClassificationChangeRequest.objects.get(
                pk=self.request_id,
            ).BCCR_STATUS,
            "approved",
        )
