from decimal import Decimal

from django.contrib.gis.geos import Point
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.business.models import Business, Category, Cluster, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationIdentity,
)
from apps.merchant_operations.business_profile.models import (
    BusinessClassificationChangeRequest,
    BusinessLocationChangeRequest,
    BusinessNameChangeRequest,
)
from apps.review_disputes.models import MerchantReviewDispute
from apps.reviews.models import Review
from apps.users.models import User

from .serializers import SEARCH_TYPES
from .services import GlobalSearchService


class GlobalSearchTests(APITestCase):
    """Cover the new endpoint's scopes, compact projections, and query bounds."""

    @classmethod
    def create_user(
        cls,
        *,
        email,
        role=User.UserRole.MERCHANT,
        first_name="Needle",
        last_name="Merchant",
    ):
        """Create an account without relying on discovery policy configuration."""
        return User.objects.create_user(
            email=email,
            password=None,
            USER_FNAME=first_name,
            USER_LNAME=last_name,
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
            USER_REPUTATION=Decimal("0.20000"),
        )

    @classmethod
    def setUpTestData(cls):
        """Create six matching rows per category to exercise the maximum lookahead."""
        cls.admin = cls.create_user(
            email="search-admin@example.com",
            role=User.UserRole.ADMIN,
            first_name="Search",
            last_name="Administrator",
        )
        cls.cluster = Cluster.objects.create(CLUS_NAME="Search food")
        cls.category = Category.objects.create(
            CLUS_ID=cls.cluster,
            CTGRY_NAME="Search cafes",
        )
        cls.location = Location.objects.create(
            LOCT_POINT=Point(
                123.9,
                10.3,
                srid=4326,
            ),
            LOCT_ADDRESS="Test Avenue",
        )
        cls.records = []
        submitted_at = timezone.now()

        for index in range(6):
            owner = cls.create_user(
                email=f"needle-owner-{index}@example.com",
                last_name=f"Merchant {index}",
            )
            business = Business.objects.create(
                BUSN_NAME="Needle Cafe",
                BUSN_STATUS=Business.BusinessStatus.SUSPENDED,
                USER_ID=owner,
                CTGRY_ID=cls.category,
                LOCT_ID=cls.location,
            )
            application = MerchantApplication.objects.create(
                USER_ID=owner,
                MAPP_STATUS=MerchantApplication.ApplicationStatus.SUBMITTED,
                MAPP_SUBMITTED_AT=submitted_at,
            )
            MerchantApplicationIdentity.objects.create(
                MAPP_ID=application,
                MIDN_BUSINESS_NAME=f"Needle application {index}",
                CLUS_ID=cls.cluster,
                CTGRY_ID=cls.category,
            )
            name_request = BusinessNameChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=owner,
                BNCR_PREVIOUS_BUSINESS_NAME=f"Former title {index}",
                BNCR_PROPOSED_BUSINESS_NAME=f"Future title {index}",
                BNCR_SUBMITTED_AT=submitted_at,
                BNCR_STATUS=BusinessNameChangeRequest.Status.WITHDRAWN,
            )
            classification = BusinessClassificationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=owner,
                PREVIOUS_CTGRY_ID=cls.category,
                PROPOSED_CTGRY_ID=cls.category,
                BCCR_PREVIOUS_CATEGORY_NAME=cls.category.CTGRY_NAME,
                BCCR_PREVIOUS_CLUSTER_ID=cls.cluster.pk,
                BCCR_PREVIOUS_CLUSTER_NAME=cls.cluster.CLUS_NAME,
                BCCR_PROPOSED_CATEGORY_NAME=cls.category.CTGRY_NAME,
                BCCR_PROPOSED_CLUSTER_ID=cls.cluster.pk,
                BCCR_PROPOSED_CLUSTER_NAME=cls.cluster.CLUS_NAME,
                BCCR_SUBMITTED_AT=submitted_at,
                BCCR_STATUS=BusinessClassificationChangeRequest.Status.APPROVED,
            )
            location_request = BusinessLocationChangeRequest.objects.create(
                BUSN_ID=business,
                USER_ID=owner,
                BLCR_PREVIOUS_LOCT_ID=cls.location.pk,
                BLCR_PREVIOUS_POINT=cls.location.LOCT_POINT,
                BLCR_PREVIOUS_ADDRESS=cls.location.LOCT_ADDRESS,
                BLCR_PREVIOUS_CITY=cls.location.LOCT_CITY,
                BLCR_PREVIOUS_PROVINCE=cls.location.LOCT_PROVINCE,
                BLCR_PROPOSED_POINT=cls.location.LOCT_POINT,
                BLCR_PROPOSED_ADDRESS="Proposed Avenue",
                BLCR_PROPOSED_CITY=cls.location.LOCT_CITY,
                BLCR_PROPOSED_PROVINCE=cls.location.LOCT_PROVINCE,
                BLCR_SUBMITTED_AT=submitted_at,
                BLCR_STATUS=BusinessLocationChangeRequest.Status.REJECTED,
            )
            review = Review.objects.create(
                USER_ID=owner,
                BUSN_ID=business,
                REVW_TEXT=f"Delicious pastry {index} " + "x" * 500,
                REVW_STATUS=Review.ReviewStatus.REJECTED,
                REVW_MODERATION_NOTES="Private moderation notes",
                REVW_INSTALLATION_ID="private-installation",
            )
            dispute = MerchantReviewDispute.objects.create(
                USER_ID=owner,
                BUSN_ID=business,
                REVW_ID=review,
                MRDSP_ORIGINAL_REVIEW_ID=review.pk,
                MRDSP_ORIGINAL_BUSINESS_ID=business.pk,
                MRDSP_ORIGINAL_MERCHANT_ID=owner.pk,
                MRDSP_REASON=MerchantReviewDispute.DisputeReason.OTHER,
                MRDSP_DESCRIPTION=f"Disputed accuracy {index}",
                MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.DISMISSED,
                MRDSP_ADMIN_NOTES="Private investigation notes",
            )
            cls.records.append(
                {
                    "business": business,
                    "user": owner,
                    "application": application,
                    "business_name_request": name_request,
                    "classification_request": classification,
                    "location_request": location_request,
                    "review": review,
                    "review_dispute": dispute,
                },
            )

    def setUp(self):
        """Authenticate the API client using the existing Admin permissions."""
        self.client.force_authenticate(self.admin)
        self.url = reverse("admin-global-search")

    def search(
        self,
        text="Needle",
        **params,
    ):
        """Read a valid search response and index the stable result groups."""
        response = self.client.get(
            self.url,
            {"search": text, **params},
        )
        self.assertEqual(response.status_code, 200)
        return {
            group["type"]: group
            for group in response.data["data"]["groups"]
        }

    def test_trimmed_search_returns_compact_ordered_groups_and_original_statuses(self):
        """Verify all eight model identities and the default response contract."""
        response = self.client.get(
            self.url,
            {"search": "  Needle  "},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["search"], "Needle")
        groups = response.data["data"]["groups"]
        self.assertEqual(
            tuple(
                group["type"]
                for group in groups
            ),
            SEARCH_TYPES,
        )
        expected_statuses = (
            "suspended",
            "active",
            "submitted",
            "withdrawn",
            "approved",
            "rejected",
            "rejected",
            "dismissed",
        )

        for group, expected_status in zip(groups, expected_statuses):
            with self.subTest(record_type=group["type"]):
                self.assertEqual(set(group), {"type", "items", "has_more"})
                self.assertEqual(len(group["items"]), 3)
                self.assertTrue(group["has_more"])
                expected_ids = {
                    record[group["type"]].pk
                    for record in self.records
                }
                for item in group["items"]:
                    self.assertEqual(
                        set(item),
                        {"id", "title", "subtitle", "status"},
                    )
                    self.assertIn(item["id"], expected_ids)
                    self.assertEqual(item["status"], expected_status)
                    self.assertTrue(item["title"])
                    self.assertLessEqual(len(item["title"]), 160)
                    self.assertLessEqual(len(item["subtitle"]), 300)

        self.assertLessEqual(len(groups[6]["items"][0]["subtitle"]), 160)

    def test_verified_text_predicates_find_the_expected_records(self):
        """Exercise domain predicates and the new request name/merchant matching."""
        cases = (
            ("application 0", ("application",)),
            ("Needle Merchant 0", ("user", "review")),
            ("Former title 0", ("business_name_request",)),
            ("Future title 0", ("business_name_request",)),
            ("Delicious pastry 0", ("review", "review_dispute")),
            ("Disputed accuracy 0", ("review_dispute",)),
            (
                "needle-owner-0@example.com",
                (
                    "user",
                    "business_name_request",
                    "classification_request",
                    "location_request",
                    "review",
                    "review_dispute",
                ),
            ),
        )
        for text, record_types in cases:
            groups = self.search(text)
            for record_type in record_types:
                with self.subTest(search=text, record_type=record_type):
                    self.assertEqual(
                        [
                            item["id"]
                            for item in groups[record_type]["items"]
                        ],
                        [self.records[0][record_type].pk],
                    )

    def test_invalid_text_and_numeric_parameters_use_validation_envelope(self):
        """Reject missing, blank, short, oversized, and invalid limit values."""
        invalid_params = [
            {},
            {"search": ""},
            {"search": "   "},
            {"search": " a "},
            {"search": "a" * 201},
        ]
        for limit in ("", "abc", "1.5", "0", "-1", "6"):
            invalid_params.append(
                {
                    "search": "Needle",
                    "limit_per_type": limit,
                },
            )

        for params in invalid_params:
            with self.subTest(params=params):
                with self.assertNumQueries(0):
                    response = self.client.get(self.url, params)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.data["success"])
                self.assertEqual(response.data["code"], "VALIDATION_ERROR")
                self.assertIn("errors", response.data)

    def test_limits_and_lookahead_are_per_category(self):
        """Verify both permitted limit extremes and the exact-limit boundary."""
        for limit in (1, 5):
            groups = self.search(limit_per_type=limit)
            for group in groups.values():
                self.assertEqual(len(group["items"]), limit)
                self.assertTrue(group["has_more"])

        for group in self.search("Future title 0", limit_per_type=1).values():
            self.assertFalse(group["has_more"])

    def test_no_matches_returns_all_eight_empty_groups(self):
        """Distinguish valid searches with no matches from invalid blank input."""
        groups = self.search("No matching record anywhere")
        self.assertEqual(tuple(groups), SEARCH_TYPES)
        for group in groups.values():
            self.assertEqual(group["items"], [])
            self.assertFalse(group["has_more"])

    def test_permissions_allow_admin_inheritance_and_deny_other_roles(self):
        """Preserve Admin, Super Admin, active-account, and anonymous behavior."""
        for role in (User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN):
            self.admin.USER_ROLE = role
            response = self.client.get(
                self.url,
                {"search": "Needle"},
            )
            self.assertEqual(response.status_code, 200)

        for role in (User.UserRole.EXPLORER, User.UserRole.MERCHANT):
            self.admin.USER_ROLE = role
            response = self.client.get(
                self.url,
                {"search": "Needle"},
            )
            self.assertEqual(response.status_code, 403)

        self.admin.USER_ROLE = User.UserRole.ADMIN
        self.admin.USER_STATUS = User.UserStatus.SUSPENDED
        response = self.client.get(
            self.url,
            {"search": "Needle"},
        )
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=None)
        response = self.client.get(
            self.url,
            {"search": "Needle"},
        )
        self.assertEqual(response.status_code, 401)

    def test_application_scope_retains_resolved_records_and_excludes_drafts(self):
        """Keep the existing submitted, approved, and rejected application scope."""
        statuses = ("draft", "approved", "rejected")
        for record, application_status in zip(self.records, statuses):
            MerchantApplication.objects.filter(pk=record["application"].pk).update(
                MAPP_STATUS=application_status,
            )
        items = self.search(limit_per_type=5)["application"]["items"]
        self.assertEqual(len(items), 5)
        self.assertEqual(
            {
                item["status"]
                for item in items
            },
            {"submitted", "approved", "rejected"},
        )
        self.assertNotIn(
            self.records[0]["application"].pk,
            [
                item["id"]
                for item in items
            ],
        )

    def test_disputes_with_unavailable_relations_remain_searchable(self):
        """Retain closed disputes without exposing snapshots or investigation data."""
        dispute = self.records[0]["review_dispute"]
        MerchantReviewDispute.objects.filter(pk=dispute.pk).update(
            USER_ID=None,
            BUSN_ID=None,
            REVW_ID=None,
            MRDSP_STATUS=MerchantReviewDispute.DisputeStatus.AUTHOR_DELETED,
        )
        item = self.search("Disputed accuracy 0")["review_dispute"]["items"][0]
        self.assertEqual(
            item,
            {
                "id": dispute.pk,
                "title": f"Dispute #{dispute.pk}",
                "subtitle": None,
                "status": "author_deleted",
            },
        )

    def test_service_uses_eight_bounded_scalar_queries_with_stable_ties(self):
        """Prevent counts, media loads, unbounded reads, and unstable tied names."""
        with CaptureQueriesContext(connection) as captured:
            results = GlobalSearchService.search(
                search="Needle",
                limit_per_type=1,
            )

        self.assertEqual(len(captured), 8)
        for query in captured:
            sql = query["sql"].upper()
            self.assertIn("LIMIT 2", sql)
            self.assertIn("ORDER BY", sql)
            self.assertNotIn("COUNT(", sql)
            self.assertNotIn("PHOTO", sql)
            self.assertNotIn("EVIDENCE", sql)
            self.assertNotIn("MODERATION", sql)

        business_group = results["groups"][0]
        self.assertEqual(
            business_group["items"][0]["id"],
            self.records[0]["business"].pk,
        )
        self.assertTrue(business_group["has_more"])
