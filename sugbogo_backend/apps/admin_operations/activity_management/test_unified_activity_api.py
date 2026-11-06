from datetime import UTC, datetime, timedelta

from django.contrib.gis.geos import Point
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase

from apps.admin_operations.system_configuration.models import AnalyticsPolicyChange
from apps.authentication.models import LoginEvent
from apps.business.models import Business, BusinessVouch, Category, Cluster, Location, SpecialtyTag
from apps.merchant_application.models import MerchantApplication, MerchantApplicationSubmission
from apps.merchant_operations.business_profile.models import BusinessNameChangeRequest
from apps.reviews.models import Review
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin

from .models import AdminActivity
from .unified_activity_service import UnifiedActivityService


class UnifiedActivityAPITests(APIResponseAssertionsMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        AnalyticsPolicyChange.objects.all().delete()
        cls.now = timezone.now().replace(microsecond=0)
        cls.users = {}
        for role in User.UserRole.values:
            cls.users[role] = User.objects.create(
                USER_EMAIL=f"activity-api-{role}@example.com",
                USER_FNAME="Current",
                USER_LNAME=role,
                USER_ROLE=role,
                USER_STATUS=User.UserStatus.ACTIVE,
                password="!",
            )
        cls.admin = cls.users[User.UserRole.ADMIN]
        cls.merchant = cls.users[User.UserRole.MERCHANT]
        cls.explorer = cls.users[User.UserRole.EXPLORER]
        cls.activity = AdminActivity.objects.create(
            AACT_ID=42,
            ACTOR_ID=cls.admin,
            AACT_ACTION=AdminActivity.Action.USER_SUSPENDED,
            AACT_MODULE=AdminActivity.Module.USER,
            AACT_IS_ADMINISTRATIVE=True,
            AACT_ACTOR_NAME="Recorded Administrator",
            AACT_ACTOR_ROLE=User.UserRole.SUPER_ADMIN,
            AACT_TARGET_TYPE="user",
            AACT_TARGET_ID=str(cls.merchant.pk),
            AACT_TARGET_LABEL="Recorded Target",
            AACT_OUTCOME=AdminActivity.Outcome.SUCCEEDED,
            AACT_REASON="Recorded decision reason.",
            AACT_PREVIOUS_STATE={"status": "active", "token": "private-secret"},
            AACT_NEW_STATE={
                "status": "suspended",
                "password": "private-secret",
                "name": {"private_document": "private-secret"},
            },
            AACT_CONTEXT={
                "business_id": 73,
                "request_id": {"token": "private-secret"},
                "report_ids": [1, {"document": "private-secret"}],
                "admin_notes": "private-moderation-evidence",
                "candidate_key": "private-duplicate-contact",
                "device_id": "private-device",
                "reason": {"payload": "private-secret"},
            },
        )
        AdminActivity.objects.filter(pk=42).update(AACT_CREATED_AT=cls.now)
        cls.policy = AnalyticsPolicyChange.objects.create(
            APCH_ID=42,
            APCH_VERSION=2,
            APCH_ACTOR=cls.admin,
            APCH_ACTOR_ID_SNAPSHOT=cls.admin.pk,
            APCH_REASON="Recorded policy reason.",
            APCH_BEFORE={"peer_min_businesses": 5, "private": "private-secret"},
            APCH_AFTER={"peer_min_businesses": 6, "private": "private-secret"},
        )
        AnalyticsPolicyChange.objects.filter(pk=42).update(APCH_CREATED_AT=cls.now)
        application = MerchantApplication.objects.create(USER_ID=cls.merchant)
        cls.submission = MerchantApplicationSubmission.objects.create(
            MASUB_ID=42,
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=cls.now,
            MASUB_DUPLICATE_EVIDENCE=[{"contact": "private-contact"}],
        )
        cls.login = LoginEvent.objects.create(
            LEVT_ID=42,
            USER=cls.admin,
            LEVT_METHOD=LoginEvent.Method.ADMIN,
            LEVT_OUTCOME=LoginEvent.Outcome.SUCCESS,
            LEVT_CREATED_AT=cls.now,
            LEVT_IP_ADDRESS="192.0.2.55",
            LEVT_PLATFORM="private-platform",
            LEVT_CLIENT="private-client",
        )
        cluster = Cluster.objects.create(CLUS_NAME="API fixture cluster")
        category = Category.objects.create(
            CLUS_ID=cluster,
            CTGRY_NAME="API fixture category",
        )
        location = Location.objects.create(
            LOCT_POINT=Point(123.9, 10.3, srid=4326),
            LOCT_ADDRESS="API fixture address",
        )
        cls.business = Business.objects.create(
            USER_ID=cls.merchant,
            CTGRY_ID=category,
            LOCT_ID=location,
            BUSN_NAME="Current business",
            BUSN_CONTACT_NUMBER="09123456789",
        )
        cls.review = Review.objects.create(
            REVW_ID=42,
            USER_ID=cls.explorer,
            BUSN_ID=cls.business,
            REVW_TEXT="private-review-content",
            REVW_MODERATION_NOTES="private-moderation-evidence",
        )
        Review.objects.filter(pk=42).update(REVW_CREATED_AT=cls.now)
        tag = SpecialtyTag.objects.create(TAG_NAME="API fixture specialty")
        cls.vouch = BusinessVouch.objects.create(
            VOUCH_ID=42,
            USER_ID=cls.explorer,
            BUSN_ID=cls.business,
            TAG_ID=tag,
            VOUCH_REPUTATION_SNAPSHOT="0.50000",
            VOUCH_WITHDRAWN_AT=cls.now,
        )
        BusinessVouch.objects.filter(pk=42).update(VOUCH_CREATED_AT=cls.now)
        cls.change_request = BusinessNameChangeRequest.objects.create(
            BNCR_ID=42,
            USER_ID=cls.merchant,
            BUSN_ID=cls.business,
            BNCR_STATUS=BusinessNameChangeRequest.Status.WITHDRAWN,
            BNCR_SUBMITTED_AT=cls.now,
            BNCR_RESOLVED_AT=cls.now,
            BNCR_PREVIOUS_BUSINESS_NAME="Original business name",
            BNCR_PROPOSED_BUSINESS_NAME="Proposed business name",
        )

    def setUp(self):
        self.url = reverse("unified-activity-list")
        self.client.force_authenticate(self.admin)

    def detail_url(
        self,
        event_id,
    ):
        return reverse(
            "unified-activity-detail",
            kwargs={"event_id": event_id},
        )

    def test_admin_and_super_admin_can_read_both_endpoints_but_cannot_write(self):
        detail_url = self.detail_url("admin_activity:42:user_suspended")
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.client.force_authenticate(self.users[role])
            self.assertSuccessResponse(
                self.client.get(self.url),
                message="Success.",
            )
            self.assertSuccessResponse(
                self.client.get(detail_url),
                message="Success.",
            )
        for url in (self.url, detail_url):
            self.assertEqual(self.client.post(url, {}).status_code, 405)
            self.assertEqual(self.client.patch(url, {}).status_code, 405)
            self.assertEqual(self.client.delete(url).status_code, 405)
        self.assertEqual(
            self.client.get(reverse("get_activity_management_data")).status_code,
            200,
        )

    def test_other_roles_anonymous_and_inactive_administrators_cannot_read_either_endpoint(self):
        detail_url = self.detail_url("admin_activity:42:user_suspended")
        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            self.client.force_authenticate(self.users[role])
            for url in (self.url, detail_url):
                self.assertEqual(self.client.get(url).status_code, 403)
        self.admin.USER_STATUS = User.UserStatus.DISABLED
        self.client.force_authenticate(self.admin)
        for url in (self.url, detail_url):
            self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(None)
        for url in (self.url, detail_url):
            self.assertIn(self.client.get(url).status_code, (401, 403))

    def test_sql_pagination_and_composite_identities_match_existing_normalized_order(self):
        normalized = list(UnifiedActivityService.list_activity())
        expected_ids = [
            UnifiedActivityService.event_identity(event)
            for event in normalized
        ]
        self.assertEqual(len(expected_ids), 9)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(self.url, {"page_size": 2})
        self.assertEqual(len(queries), 2)
        self.assertIn("UNION ALL", queries[-1]["sql"])
        self.assertIn("LIMIT 2", queries[-1]["sql"])
        self.assertEqual(response.data["data"]["pagination"], {
            "page": 1,
            "page_size": 2,
            "total_items": 9,
            "total_pages": 5,
            "has_next": True,
            "has_previous": False,
        })
        rows = response.data["data"]["items"]
        for page in range(2, 6):
            response = self.client.get(self.url, {"page_size": 2, "page": page})
            rows.extend(response.data["data"]["items"])
        self.assertEqual([row["id"] for row in rows], expected_ids)
        self.assertEqual(len({row["id"] for row in rows}), 9)
        for event, row in zip(normalized, rows):
            self.assertEqual(
                set(row),
                set(UnifiedActivityService.COLUMNS) | {"id", "category"},
            )
            self.assertEqual(parse_datetime(row["occurred_at"]), event["occurred_at"])
            for field in set(UnifiedActivityService.COLUMNS) - {"occurred_at", "new_state"}:
                self.assertEqual(row[field], event[field])
        self.assertFalse(response.data["data"]["pagination"]["has_next"])
        self.assertTrue(response.data["data"]["pagination"]["has_previous"])
        default = self.client.get(self.url)
        self.assertEqual(default.data["data"]["pagination"]["page_size"], 10)
        capped = self.client.get(self.url, {"page_size": 1000})
        self.assertEqual(capped.data["data"]["pagination"]["page_size"], 100)
        self.assertEqual(self.client.get(self.url, {"page": 99}).status_code, 404)

    def test_categories_follow_recorded_classification_and_not_current_actor_role(self):
        for category, expected in (
            ("administrative", 2),
            ("merchant", 3),
            ("explorer", 3),
            ("authentication", 1),
            ("all", 9),
        ):
            response = self.client.get(self.url, {"category": category})
            self.assertEqual(response.data["data"]["pagination"]["total_items"], expected)
            if category != "all":
                self.assertEqual(
                    {row["category"] for row in response.data["data"]["items"]},
                    {category},
                )
        AdminActivity.objects.create(
            ACTOR_ID=self.merchant,
            AACT_ACTION=AdminActivity.Action.REVIEW_DELETED_BY_AUTHOR,
        )
        unknown = AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            AACT_ACTION="unknown_legacy_action",
        )
        response = self.client.get(self.url, {"category": "explorer"})
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 4)
        unknown_detail = self.client.get(self.detail_url(
            f"admin_activity:{unknown.pk}:unknown_legacy_action",
        ))
        self.assertIsNone(unknown_detail.data["data"]["category"])
        self.assertIsNone(unknown_detail.data["data"]["is_administrative"])

    def test_module_action_and_actor_filters_combine_before_sql_pagination(self):
        params = {
            "category": "merchant",
            "module": "business",
            "action": "business_name_change_request_submitted",
            "actor_id": self.merchant.pk,
            "page_size": 1,
        }
        response = self.client.get(self.url, params)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        self.assertEqual(
            response.data["data"]["items"][0]["id"],
            "business_name_change_request:42:business_name_change_request_submitted",
        )
        params["actor_id"] = self.explorer.pk
        response = self.client.get(self.url, params)
        self.assertEqual(response.data["data"]["items"], [])
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 0)
        response = self.client.get(self.url, {
            "category": "authentication",
            "module": "authentication",
            "action": "login_succeeded",
            "actor_id": self.admin.pk,
        })
        self.assertEqual(len(response.data["data"]["items"]), 1)

    def test_date_filters_use_inclusive_manila_days_and_timezone_aware_timestamps(self):
        start = datetime(2026, 11, 5, 16, tzinfo=UTC)
        end = start + timedelta(days=1)
        events = []
        for timestamp in (
            start - timedelta(microseconds=1),
            start,
            end - timedelta(microseconds=1),
            end,
        ):
            event = AdminActivity.objects.create(
                ACTOR_ID=self.admin,
                AACT_ACTION=AdminActivity.Action.USER_REACTIVATED,
            )
            AdminActivity.objects.filter(pk=event.pk).update(AACT_CREATED_AT=timestamp)
            events.append(event)
        params = {
            "start_date": "2026-11-06",
            "end_date": "2026-11-06",
            "action": "user_reactivated",
        }
        response = self.client.get(self.url, params)
        self.assertEqual(
            {row["source_id"] for row in response.data["data"]["items"]},
            {str(events[1].pk), str(events[2].pk)},
        )
        del params["end_date"]
        response = self.client.get(self.url, params)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 3)
        del params["start_date"]
        params["end_date"] = "2026-11-06"
        response = self.client.get(self.url, params)
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 3)

    def test_invalid_filters_use_standard_validation_errors(self):
        for params, field in (
            ({"category": "invalid"}, "category"),
            ({"module": "invalid"}, "module"),
            ({"action": "invalid"}, "action"),
            ({"actor_id": "not-an-id"}, "actor_id"),
            ({"actor_id": 0}, "actor_id"),
            ({"start_date": "2026-02-30"}, "start_date"),
            ({"end_date": "2026-11-06T00:00:00Z"}, "end_date"),
            ({"start_date": "2026-11-07", "end_date": "2026-11-06"}, "end_date"),
            ({"end_date": "9999-12-31"}, "end_date"),
            ({"search": "ignored"}, "search"),
        ):
            with self.subTest(params=params):
                self.assertValidationError(
                    self.client.get(self.url, params),
                    field,
                )

    def test_admin_and_policy_details_return_only_safe_historical_values(self):
        response = self.client.get(self.detail_url("admin_activity:42:user_suspended"))
        data = response.data["data"]
        self.assertEqual(data["actor_display_snapshot"], "Recorded Administrator")
        self.assertEqual(data["actor_role_snapshot"], User.UserRole.SUPER_ADMIN)
        self.assertEqual(data["target_label"], "Recorded Target")
        self.assertEqual(data["reason"], "Recorded decision reason.")
        self.assertEqual(data["previous_state"], {"status": "active"})
        self.assertEqual(data["new_state"], {"status": "suspended"})
        self.assertEqual(data["context"], {"business_id": 73})
        response = self.client.get(self.detail_url(
            "analytics_policy_change:42:analytics_policy_revision",
        ))
        self.assertEqual(response.data["data"]["previous_state"], {"peer_min_businesses": 5})
        self.assertEqual(response.data["data"]["new_state"], {"peer_min_businesses": 6})
        self.assertEqual(response.data["data"]["reason"], "Recorded policy reason.")
        self.assertIsNone(response.data["data"]["actor_role_snapshot"])
        AdminActivity.objects.filter(pk=42).update(AACT_REASON=None)
        response = self.client.get(self.detail_url("admin_activity:42:user_suspended"))
        self.assertIsNone(response.data["data"]["reason"])
        AdminActivity.objects.filter(pk=42).update(AACT_CONTEXT={"reason": "Legacy suspension reason."})
        response = self.client.get(self.detail_url("admin_activity:42:user_suspended"))
        self.assertEqual(response.data["data"]["reason"], "Legacy suspension reason.")

    def test_missing_snapshots_and_sensitive_source_data_are_never_fabricated_or_exposed(self):
        response = self.client.get(self.url, {"page_size": 100})
        responses = [response]
        for event_id in (
            "login_event:42:login_succeeded",
            "review:42:review_submitted",
            "merchant_application_submission:42:merchant_application_submitted",
        ):
            detail = self.client.get(self.detail_url(event_id))
            responses.append(detail)
            data = detail.data["data"]
            for field in (
                "actor_display_snapshot",
                "actor_role_snapshot",
                "target_label",
                "previous_state",
                "new_state",
                "reason",
                "context",
            ):
                self.assertIsNone(data[field])
            self.assertFalse(data["is_administrative"])
        for response in responses:
            payload = repr(response.data)
            self.assertNotIn("private-", payload)
            self.assertNotIn("192.0.2.55", payload)
            self.assertNotIn(self.admin.USER_EMAIL, payload)

    def test_distinct_occurrences_are_individually_addressable(self):
        identities = []
        for occurrence in ("business_vouch_submitted", "business_vouch_withdrawn"):
            identity = f"business_vouch:42:{occurrence}"
            response = self.client.get(self.detail_url(identity))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["id"], identity)
            self.assertEqual(response.data["data"]["source_id"], "42")
            self.assertEqual(response.data["data"]["occurrence"], occurrence)
            self.assertEqual(response.data["data"]["provenance"]["business_id"], self.business.pk)
            identities.append(response.data["data"]["id"])
        self.assertEqual(len(set(identities)), 2)

    def test_recorded_admin_decision_suppresses_its_domain_resolution_in_list_and_detail(self):
        BusinessNameChangeRequest.objects.filter(pk=42).update(
            BNCR_STATUS=BusinessNameChangeRequest.Status.APPROVED,
            REVIEWER_ID=self.admin,
        )
        AdminActivity.objects.create(
            ACTOR_ID=self.admin,
            AACT_ACTION=AdminActivity.Action.BUSINESS_NAME_CHANGE_APPROVED,
            AACT_CONTEXT={"request_type": "business_name_change", "request_id": 42},
        )
        response = self.client.get(self.url, {"action": "business_name_change_approved"})
        self.assertEqual(response.data["data"]["pagination"]["total_items"], 1)
        item = response.data["data"]["items"][0]
        self.assertEqual(item["source_type"], "admin_activity")
        self.assertEqual(self.client.get(self.detail_url(item["id"])).status_code, 200)
        self.assertEqual(self.client.get(self.detail_url(
            "business_name_change_request:42:business_name_change_approved",
        )).status_code, 404)
        self.assertEqual(self.client.get(self.detail_url(
            "business_name_change_request:42:business_name_change_request_submitted",
        )).status_code, 200)

    def test_missing_deleted_unattributed_and_expired_sources_return_standard_not_found(self):
        for identity in (
            "invalid",
            "unknown_source:42:login_succeeded",
            "login_event:999999:login_succeeded",
            "login_event:42:login_failed",
        ):
            response = self.client.get(self.detail_url(identity))
            self.assertEqual(response.status_code, 404)
            self.assertFalse(response.data["success"])
            self.assertEqual(response.data["code"], "NOT_FOUND")
        LoginEvent.objects.filter(pk=42).update(USER=None)
        identity = "login_event:42:login_succeeded"
        self.assertEqual(self.client.get(self.detail_url(identity)).status_code, 404)
        LoginEvent.objects.filter(pk=42).update(
            USER=self.admin,
            LEVT_CREATED_AT=self.now - timedelta(days=1000),
        )
        self.assertEqual(self.client.get(self.detail_url(identity)).status_code, 404)
        self.assertTrue(LoginEvent.objects.filter(pk=42).exists())
        LoginEvent.objects.filter(pk=42).delete()
        self.assertEqual(self.client.get(self.detail_url(identity)).status_code, 404)
