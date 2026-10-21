"""Duplicate matching, privacy, adjudication, and lifecycle integration coverage."""

from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.urls import reverse
from django.test import override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService as AdminApplicationService,
)
from apps.business.models import Business, Location
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDuplicateAssessment,
    MerchantApplicationIdentity,
    MerchantApplicationLocation,
    MerchantApplicationSubmission,
    MerchantApplicationPhotos,
)
from apps.merchant_application.services.application_service import ApplicationService
from apps.merchant_application.services.duplicate_detection_service import DuplicateDetectionService
from apps.merchant_application.services.duplicate_review_service import DuplicateReviewService
from apps.merchant_application.services.identity_service import IdentityService
from apps.merchant_application.tests.test_services import MerchantApplicationServiceMixin
from apps.merchant_application.utils.section_fingerprints import get_section_fingerprints
from apps.users.models import User


class DuplicateBusinessReviewTests(MerchantApplicationServiceMixin, APITestCase):
    """Verify observable registration and administrator review behavior."""

    def setUp(self):
        super().setUp()
        self.application = ApplicationService.submit_application(self._build_complete_application())
        self.admin = User.objects.create_user(
            email="duplicate-admin@example.com",
            password=None,
            USER_FNAME="Admin",
            USER_LNAME="Reviewer",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )
        self.target = self.create_target()
        notification = patch(
            "apps.notifications.services.notification_event_service."
            "NotificationEventService.merchant_application_resolved",
        )
        notification.start()
        self.addCleanup(notification.stop)

    def create_target(self):
        """Create an independent submitted application with the same business details."""
        user = User.objects.create_user(
            email="matching-owner@example.com",
            password=None,
            USER_FNAME="Other",
            USER_LNAME="Owner",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        application = MerchantApplication.objects.create(
            USER_ID=user,
            MAPP_STATUS="submitted",
            MAPP_SUBMISSION_COUNT=1,
            MAPP_SUBMITTED_AT=self.application.MAPP_SUBMITTED_AT,
        )
        fields = self._identity_payload()
        fields.pop("specialty_tags")
        MerchantApplicationIdentity.objects.create(MAPP_ID=application, **fields)
        location = self._location_payload()
        location.pop("landmarks")
        latitude = location.pop("latitude")
        longitude = location.pop("longitude")
        MerchantApplicationLocation.objects.create(
            MAPP_ID=application,
            MLOC_POINT=Point(longitude, latitude, srid=4326),
            **location,
        )
        MerchantApplicationSubmission.objects.create(
            MAPP_ID=application,
            MASUB_SUBMISSION_NUMBER=1,
            MASUB_SUBMITTED_AT=self.application.MAPP_SUBMITTED_AT,
        )
        return application

    def assess(self, decision="legitimate", application=None):
        """Save the currently displayed evidence as an administrator would."""
        application = application or self.application
        state = DuplicateReviewService.review_state(application)
        candidate = state["candidates"][0]
        return DuplicateReviewService.assess(
            application.pk,
            self.admin,
            {
                "submission_id": state["submission_id"],
                "candidate_key": candidate["key"],
                "fingerprint": candidate["fingerprint"],
                "decision": decision,
                "explanation": "Reviewed separate branch evidence.",
            },
        )

    def test_normalized_name_and_complete_address_match(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "  SUGBO   BISTRO  "
        identity.save()
        candidates = DuplicateDetectionService.find_candidates(self.application)
        self.assertEqual(len(candidates), 1)
        self.assertIn("exact_name_and_address", candidates[0]["reasons"])

    def test_saved_name_edits_refresh_warning_admin_candidates_and_resubmission_evidence(self):
        for name, reason in (
            ("Sugbo Bistro", "exact_name_and_address"),
            ("Sugbo Bistrot", "similar_business_name"),
        ):
            with self.subTest(name=name):
                self.assess("confirmed_duplicate")
                submission = DuplicateReviewService.current_submission(self.application)
                AdminApplicationService.reject_application(
                    self.application.pk,
                    [],
                    self.admin,
                    duplicate=True,
                    explanation="This establishment is already registered.",
                    expected_submission_id=submission.pk,
                )
                self.client.force_authenticate(self.user)
                response = self.client.patch(
                    reverse("application-identity"),
                    {"business_name": "Unrelated New Establishment"},
                    format="json",
                )
                self.assertEqual(response.status_code, 200, response.data)
                warning = self.client.get(reverse("merchant-duplicate-warning"))
                self.assertFalse(warning.data["data"]["possible_duplicate"])

                response = self.client.patch(
                    reverse("application-identity"),
                    {"business_name": f"  {name}  "},
                    format="json",
                )
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["data"]["business_name"], name)
                warning = self.client.get(reverse("merchant-duplicate-warning"))
                self.assertTrue(warning.data["data"]["possible_duplicate"])
                self.client.force_authenticate(self.admin)
                response = self.client.get(
                    reverse("merchant-application-duplicates", args=[self.application.pk]),
                )
                self.assertEqual(response.status_code, 200, response.data)
                self.assertIn(reason, response.data["data"]["candidates"][0]["reasons"])

                ApplicationService.submit_application(self.application)
                current = DuplicateReviewService.current_submission(self.application)
                self.assertNotEqual(current.pk, submission.pk)
                self.assertIn(reason, current.MASUB_DUPLICATE_EVIDENCE[0]["reasons"])
                state = DuplicateReviewService.review_state(self.application)
                self.assertIsNone(state["candidates"][0]["assessment"])
                self.assertTrue(state["approval_blocked"])

    def test_metric_proximity_matches_when_addresses_differ(self):
        location = self.target.location
        location.MLOC_STREET_ADDRESS = "Another street"
        location.MLOC_POINT = Point(123.8855, 10.3157, srid=4326)
        location.save()
        candidate = DuplicateDetectionService.find_candidates(self.application)[0]
        self.assertEqual(candidate["reasons"], ["exact_name_and_nearby_location"])
        self.assertGreater(candidate["distance_metres"], 10)
        self.assertLess(candidate["distance_metres"], 12)

    def test_similar_names_match_nearby_without_exact_addresses(self):
        location = self.target.location
        location.MLOC_STREET_ADDRESS = "Another street"
        location.MLOC_POINT = Point(123.8855, 10.3157, srid=4326)
        location.save()
        for subject_name, target_name in (
            ("Serenity Cove Resort & Spa", "Serenity Cove Resort and Spa"),
            ("Juan's Coffee Shop", "Juans Coffee Shop"),
            ("Cebu Lechon House", "Cebu Lechon Haus"),
        ):
            with self.subTest(target_name=target_name):
                identity = self.application.identity
                identity.MIDN_BUSINESS_NAME = subject_name
                identity.save()
                target_identity = self.target.identity
                target_identity.MIDN_BUSINESS_NAME = target_name
                target_identity.save()
                candidates = DuplicateDetectionService.find_candidates(self.application)
                self.assertEqual(len(candidates), 1)
                self.assertEqual(
                    candidates[0]["reasons"],
                    ["similar_business_name", "nearby_location"],
                )

    def test_similar_name_requires_matching_address_or_proximity(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        location = self.target.location
        location.MLOC_POINT = Point(123.90, 10.33, srid=4326)
        location.save()
        candidate = DuplicateDetectionService.find_candidates(self.application)[0]
        self.assertEqual(
            candidate["reasons"],
            ["similar_business_name", "matching_address"],
        )
        location.MLOC_STREET_ADDRESS = "Different distant address"
        location.save()
        self.assertEqual(DuplicateDetectionService.find_candidates(self.application), [])

    def test_full_width_candidate_uses_canonical_fuzzy_names_on_both_sides(self):
        for subject_name, candidate_name in (
            ("cebu lechon house", "Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈａｕｓ"),
            ("Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈｏｕｓｅ", "cebu lechon haus"),
            ("  CEBU   LECHON HOUSE  ", "Ｃｅｂｕ　Ｌｅｃｈｏｎ　Ｈａｕｓ"),
        ):
            with self.subTest(
                subject_name=subject_name,
                candidate_name=candidate_name,
            ):
                identity = self.application.identity
                identity.MIDN_BUSINESS_NAME = subject_name
                identity.save()
                target_identity = self.target.identity
                target_identity.MIDN_BUSINESS_NAME = candidate_name
                target_identity.save()
                candidates = DuplicateDetectionService.find_candidates(self.application)
                self.assertEqual(len(candidates), 1)
                self.assertIn("similar_business_name", candidates[0]["reasons"])
                self.assertEqual(
                    candidates[0]["evidence"]["subject"]["name"],
                    "cebu lechon house",
                )
                self.assertEqual(
                    candidates[0]["evidence"]["candidate"]["name"],
                    "cebu lechon haus",
                )

    def test_full_width_business_candidate_matches_active_and_suspended(self):
        identity = self.application.identity
        identity.MIDN_BUSINESS_NAME = "cebu lechon house"
        identity.save()
        self.target.MAPP_STATUS = "draft"
        self.target.save()
        location = Location.objects.create(
            LOCT_POINT=self.target.location.MLOC_POINT,
            LOCT_ADDRESS="Different street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        business = Business.objects.create(
            BUSN_NAME="Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈａｕｓ",
            BUSN_CONTACT_NUMBER="09123456789",
            USER_ID=self.target.USER_ID,
            CTGRY_ID=self.category,
            LOCT_ID=location,
        )
        for status in ("active", "suspended"):
            with self.subTest(status=status):
                business.BUSN_STATUS = status
                business.save()
                candidates = DuplicateDetectionService.find_candidates(self.application)
                self.assertEqual(len(candidates), 1)
                self.assertEqual(candidates[0]["record_type"], "business")
                self.assertEqual(
                    candidates[0]["reasons"],
                    ["similar_business_name", "nearby_location"],
                )

    def test_canonical_names_still_require_matching_location(self):
        identity = self.application.identity
        identity.MIDN_BUSINESS_NAME = "cebu lechon house"
        identity.save()
        location = self.target.location
        location.MLOC_STREET_ADDRESS = "Different distant street"
        location.MLOC_POINT = Point(123.90, 10.33, srid=4326)
        location.save()
        for name in (
            "Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈａｕｓ",
            "Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈｏｕｓｅ",
        ):
            with self.subTest(name=name):
                identity = self.target.identity
                identity.MIDN_BUSINESS_NAME = name
                identity.save()
                self.assertEqual(
                    DuplicateDetectionService.find_candidates(self.application),
                    [],
                )

    def test_exact_candidates_precede_fuzzy_candidates_without_duplicates(self):
        identity = self.application.identity
        identity.MIDN_BUSINESS_NAME = "cebu lechon house"
        identity.save()
        target_identity = self.target.identity
        target_identity.MIDN_BUSINESS_NAME = "Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈａｕｓ"
        target_identity.save()
        location = Location.objects.create(
            LOCT_POINT=self.target.location.MLOC_POINT,
            LOCT_ADDRESS="Different street",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        Business.objects.create(
            BUSN_NAME="Ｃｅｂｕ Ｌｅｃｈｏｎ Ｈｏｕｓｅ",
            BUSN_CONTACT_NUMBER="09123456789",
            USER_ID=self.admin,
            CTGRY_ID=self.category,
            LOCT_ID=location,
        )
        candidates = DuplicateDetectionService.find_candidates(self.application)
        self.assertEqual(len(candidates), 2)
        self.assertNotIn("similar_business_name", candidates[0]["reasons"])
        self.assertEqual(candidates[0]["record_type"], "business")
        self.assertIn("exact_name_and_nearby_location", candidates[0]["reasons"])
        self.assertIn("similar_business_name", candidates[1]["reasons"])
        self.assertEqual(len({candidate["key"] for candidate in candidates}), 2)

    def test_normalization_rule_version_change_requires_fresh_assessment(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        with patch.object(
            DuplicateDetectionService,
            "RULE_VERSION",
            "trigram-name-location-v2",
        ):
            self.assess()
            before = DuplicateReviewService.review_state(self.application)
            self.assertTrue(before["candidates"][0]["resolved"])
        after = DuplicateReviewService.review_state(self.application)
        self.assertEqual(
            after["candidates"][0]["evidence"]["rule_version"],
            "trigram-name-location-v3",
        )
        self.assertTrue(after["candidates"][0]["stale"])
        self.assertTrue(after["approval_blocked"])
        with self.assertRaises(ValidationError):
            AdminApplicationService.approve_application(
                self.application.pk,
                self.admin,
            )
        self.assess()
        self.assertFalse(
            DuplicateReviewService.review_state(self.application)["approval_blocked"],
        )

    def test_fuzzy_match_requires_current_assessment_before_approval(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        with self.assertRaises(ValidationError):
            AdminApplicationService.approve_application(
                self.application.pk,
                self.admin,
            )
        self.assertFalse(self.application.reviews.exists())
        self.assess()
        AdminApplicationService.approve_application(
            self.application.pk,
            self.admin,
        )
        self.assertTrue(Business.objects.filter(USER_ID=self.user).exists())

    def test_changed_fuzzy_evidence_invalidates_saved_assessment(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        self.assess()
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistro Cafe"
        identity.save()
        state = DuplicateReviewService.review_state(self.application)
        self.assertTrue(state["candidates"][0]["stale"])
        self.assertTrue(state["approval_blocked"])
        with self.assertRaises(ValidationError):
            AdminApplicationService.approve_application(
                self.application.pk,
                self.admin,
            )

    def test_fuzzy_threshold_changes_invalidate_supporting_evidence(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        self.assess()
        with override_settings(MERCHANT_DUPLICATE_NAME_SIMILARITY_THRESHOLD=0.61):
            state = DuplicateReviewService.review_state(self.application)
            self.assertTrue(state["candidates"][0]["stale"])
            self.assertTrue(state["approval_blocked"])

    def test_fuzzy_submission_evidence_and_business_transition(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        self.application.MAPP_STATUS = "draft"
        self.application.save()
        ApplicationService.submit_application(self.application)
        submission = self.application.submissions.last()
        self.assertIn(
            "similar_business_name",
            submission.MASUB_DUPLICATE_EVIDENCE[0]["reasons"],
        )
        self.assess()
        before = DuplicateReviewService.review_state(self.application)["candidates"][0]
        self.assess(application=self.target)
        AdminApplicationService.approve_application(self.target.pk, self.admin)
        self.target.refresh_from_db()
        for status in ("active", "suspended"):
            with self.subTest(status=status):
                self.target.BUSN_ID.BUSN_STATUS = status
                self.target.BUSN_ID.save()
                after = DuplicateReviewService.review_state(self.application)["candidates"]
                self.assertEqual(len(after), 1)
                self.assertEqual(after[0]["record_type"], "business")
                self.assertEqual(after[0]["fingerprint"], before["fingerprint"])
                self.assertTrue(after[0]["resolved"])

    @override_settings(MERCHANT_DUPLICATE_NAME_SIMILARITY_THRESHOLD=0.99)
    def test_configurable_threshold_does_not_weaken_exact_matching(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Sugbo Bistrot"
        identity.save()
        self.assertEqual(DuplicateDetectionService.find_candidates(self.application), [])
        identity.MIDN_BUSINESS_NAME = "  SUGBO   BISTRO  "
        identity.save()
        self.assertEqual(len(DuplicateDetectionService.find_candidates(self.application)), 1)

    @override_settings(MERCHANT_DUPLICATE_RADIUS_METRES=5)
    def test_configured_radius_is_measured_in_metres(self):
        location = self.target.location
        location.MLOC_STREET_ADDRESS = "Another street"
        location.MLOC_POINT = Point(123.8855, 10.3157, srid=4326)
        location.save()
        self.assertEqual(DuplicateDetectionService.find_candidates(self.application), [])

    def test_different_tenant_name_does_not_match_shared_point_or_address(self):
        identity = self.target.identity
        identity.MIDN_BUSINESS_NAME = "Different tenant"
        identity.save()
        self.assertEqual(DuplicateDetectionService.find_candidates(self.application), [])

    def test_distant_branch_with_different_unit_is_not_a_match(self):
        location = self.target.location
        location.MLOC_UNIT = "Unit 5B"
        location.MLOC_POINT = Point(123.90, 10.33, srid=4326)
        location.save()
        self.assertEqual(DuplicateDetectionService.find_candidates(self.application), [])

    def test_drafts_and_rejections_do_not_block_or_reserve_identity(self):
        for status in ("draft", "rejected"):
            self.target.MAPP_STATUS = status
            self.target.save()
            self.assertEqual(DuplicateDetectionService.find_candidates(self.application), [])

    def test_active_and_suspended_businesses_are_candidates(self):
        self.target.MAPP_STATUS = "draft"
        self.target.save()
        location = Location.objects.create(
            LOCT_POINT=self.target.location.MLOC_POINT,
            LOCT_ADDRESS="Gorordo Avenue, Unit 4B, Lahug",
            LOCT_CITY="Cebu City",
            LOCT_PROVINCE="Cebu",
        )
        business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_CONTACT_NUMBER="09123456789",
            USER_ID=self.target.USER_ID,
            CTGRY_ID=self.category,
            LOCT_ID=location,
        )
        for status in ("active", "suspended"):
            business.BUSN_STATUS = status
            business.save()
            self.assertEqual(len(DuplicateDetectionService.find_candidates(self.application)), 1)

    def test_merchant_warning_is_private_read_only_and_submission_is_nonblocking(self):
        self.application.MAPP_STATUS = "draft"
        self.application.save()
        self.client.force_authenticate(self.user)
        before = get_section_fingerprints(self.application.pk)
        updated_at = self.application.MAPP_UPDATED_AT
        response = self.client.get(reverse("merchant-duplicate-warning"))
        self.assertEqual(response.data["data"], {"evaluated": True, "possible_duplicate": True})
        self.application.refresh_from_db()
        self.assertEqual(self.application.MAPP_UPDATED_AT, updated_at)
        self.assertEqual(get_section_fingerprints(self.application.pk), before)
        ApplicationService.submit_application(self.application)
        self.assertTrue(self.application.submissions.last().MASUB_DUPLICATE_EVIDENCE)

    def test_admin_candidate_context_has_cover_and_classification_without_changing_evidence(self):
        MerchantApplicationPhotos.objects.create(
            MAPP_ID=self.target,
            MPHT_CATEGORY="storefront",
            MPHT_PHOTO_URL="https://example.com/storefront.jpg",
            MPHT_PHOTO_PUBLIC_ID="duplicate-display-cover",
        )
        before = DuplicateReviewService.review_state(self.application)["candidates"][0]
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse(
            "merchant-application-duplicates",
            args=[self.application.pk],
        ))
        self.assertEqual(response.status_code, 200, response.data)
        candidate = response.data["data"]["candidates"][0]
        self.assertEqual(candidate["cover_photo_url"], "https://example.com/storefront.jpg")
        self.assertEqual(candidate["category_name"], self.target.identity.CTGRY_ID.CTGRY_NAME)
        self.assertEqual(candidate["cluster_name"], self.target.identity.CLUS_ID.CLUS_NAME)
        self.assertEqual(candidate["fingerprint"], before["fingerprint"])
        self.assertEqual(candidate["evidence"], before["evidence"])
        self.assess(application=self.target)
        AdminApplicationService.approve_application(self.target.pk, self.admin)
        response = self.client.get(reverse(
            "merchant-application-duplicates",
            args=[self.application.pk],
        ))
        business_candidate = response.data["data"]["candidates"][0]
        self.assertEqual(business_candidate["record_type"], "business")
        self.assertEqual(business_candidate["cover_photo_url"], candidate["cover_photo_url"])
        self.assertEqual(business_candidate["category_name"], candidate["category_name"])
        self.assertEqual(business_candidate["fingerprint"], before["fingerprint"])

    def test_admin_endpoint_requires_role_and_explanation(self):
        url = reverse("merchant-application-duplicates", args=[self.application.pk])
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.admin)
        state = self.client.get(url).data["data"]
        response = self.client.post(url, {
            "action": "assess",
            "submission_id": state["submission_id"],
            "candidate_key": state["candidates"][0]["key"],
            "fingerprint": state["candidates"][0]["fingerprint"],
            "decision": "legitimate",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_unresolved_and_ownership_conflicts_block_both_approval_routes(self):
        self.assess("ownership_conflict")
        self.client.force_authenticate(self.admin)
        for route, method in (
            ("merchant-application-approve", self.client.post),
            ("application-review", self.client.patch),
        ):
            response = method(
                reverse(route, args=[self.application.pk]),
                {"action": "approve"},
                format="json",
            )
            self.assertEqual(response.status_code, 400)
        self.assertFalse(Business.objects.filter(USER_ID=self.user).exists())
        self.assertFalse(self.application.reviews.exists())

    def test_legitimate_assessment_allows_approval_and_history_is_retained(self):
        self.assess("unresolved")
        self.assess()
        AdminApplicationService.approve_application(self.application.pk, self.admin)
        self.assertTrue(Business.objects.filter(USER_ID=self.user).exists())
        self.assertEqual(MerchantApplicationDuplicateAssessment.objects.count(), 2)

    def test_candidate_transition_to_business_preserves_key_and_valid_evidence(self):
        self.assess()
        before = DuplicateReviewService.review_state(self.application)["candidates"][0]
        self.assess(application=self.target)
        AdminApplicationService.approve_application(self.target.pk, self.admin)
        after = DuplicateReviewService.review_state(self.application)["candidates"]
        self.assertEqual(len(after), 1)
        self.assertEqual(after[0]["key"], before["key"])
        self.assertEqual(after[0]["fingerprint"], before["fingerprint"])
        self.assertTrue(after[0]["resolved"])

    def test_relevant_evidence_changes_invalidate_but_description_does_not(self):
        self.assess()
        identity = self.target.identity
        identity.MIDN_BUSINESS_DESCRIPTION = "An unrelated description correction."
        identity.save()
        self.assertFalse(DuplicateReviewService.review_state(self.application)["approval_blocked"])
        location = self.target.location
        location.MLOC_UNIT = "Changed unit"
        location.save()
        state = DuplicateReviewService.review_state(self.application)
        self.assertTrue(state["approval_blocked"])
        self.assertTrue(state["candidates"][0]["stale"])
        with self.assertRaises(ValidationError):
            AdminApplicationService.approve_application(self.application.pk, self.admin)

    def test_duplicate_rejection_allows_new_submission_without_fake_edits(self):
        self.assess("confirmed_duplicate")
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("merchant-application-reject", args=[self.application.pk]),
            {"disposition": "duplicate", "explanation": "This is the same establishment."},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        review = self.application.reviews.first()
        baseline = review.MAREV_SECTION_FINGERPRINTS.copy()
        self.assertFalse(review.feedback.exists())
        ApplicationService.submit_application(self.application)
        review.refresh_from_db()
        self.assertEqual(review.MAREV_SECTION_FINGERPRINTS, baseline)
        self.assertEqual(self.application.submissions.count(), 2)
        self.assertTrue(DuplicateReviewService.review_state(self.application)["approval_blocked"])

    def test_duplicate_rejection_does_not_waive_ordinary_section_corrections(self):
        self.assess("confirmed_duplicate")
        AdminApplicationService.reject_application(
            self.application.pk,
            [{"section": "identity", "message": "Correct the contact information."}],
            self.admin,
            duplicate=True,
            explanation="Duplicate establishment.",
        )
        with self.assertRaises(ValidationError):
            ApplicationService.submit_application(self.application)
        IdentityService.save_identity(self.user, {"MIDN_CONTACT_NUMBER": "09999999999"})
        ApplicationService.submit_application(self.application)
        self.assertEqual(self.application.submissions.count(), 2)

    def test_repeated_unchanged_resubmissions_keep_history_and_need_fresh_assessments(self):
        for submission_number in range(1, 4):
            self.assess("confirmed_duplicate")
            submission = DuplicateReviewService.current_submission(self.application)
            AdminApplicationService.reject_application(
                self.application.pk,
                [],
                self.admin,
                duplicate=True,
                explanation="Same establishment.",
                expected_submission_id=submission.pk,
            )
            self.client.force_authenticate(self.user)
            response = self.client.post(reverse("application-submit"), {}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            self.application.refresh_from_db()
            state = DuplicateReviewService.review_state(self.application)
            self.assertEqual(self.application.MAPP_STATUS, "submitted")
            self.assertEqual(self.application.submissions.count(), submission_number + 1)
            self.assertEqual(self.application.reviews.count(), submission_number)
            self.assertTrue(state["approval_blocked"])
            self.assertIsNone(state["candidates"][0]["assessment"])
            self.assertTrue(self.application.submissions.last().MASUB_DUPLICATE_EVIDENCE)
            self.assertFalse(self.application.reviews.filter(
                duplicate_reconsideration__isnull=False,
            ).exists())

    def test_prior_legitimate_assessment_does_not_clear_resubmission(self):
        self.assess("legitimate")
        previous = DuplicateReviewService.current_submission(self.application)
        AdminApplicationService.reject_application(
            self.application.pk,
            [{"section": "identity", "message": "Correct contact information."}],
            self.admin,
            expected_submission_id=previous.pk,
        )
        IdentityService.save_identity(
            self.user,
            {"MIDN_CONTACT_NUMBER": "09999999999"},
        )
        ApplicationService.submit_application(self.application)
        current = DuplicateReviewService.current_submission(self.application)
        state = DuplicateReviewService.review_state(self.application)
        self.assertTrue(state["approval_blocked"])
        self.assertIsNone(state["candidates"][0]["assessment"])
        with self.assertRaises(ValidationError):
            AdminApplicationService.approve_application(
                self.application.pk,
                self.admin,
                expected_submission_id=current.pk,
            )

    def test_final_decisions_reject_stale_submission_on_both_routes(self):
        previous = DuplicateReviewService.current_submission(self.application)
        self.assess("confirmed_duplicate")
        AdminApplicationService.reject_application(
            self.application.pk,
            [],
            self.admin,
            duplicate=True,
            explanation="Same establishment.",
        )
        ApplicationService.submit_application(self.application)
        self.assess("legitimate")
        self.client.force_authenticate(self.admin)
        for route, method, payload in (
            ("merchant-application-approve", self.client.post, {}),
            ("merchant-application-reject", self.client.post, {
                "feedback": [{"section": "identity", "message": "Correct contact details."}],
            }),
            ("merchant-application-reject", self.client.post, {
                "disposition": "duplicate",
                "explanation": "Stale duplicate decision.",
            }),
            ("application-review", self.client.patch, {"action": "approve"}),
            ("application-review", self.client.patch, {
                "action": "reject",
                "rejection_reason": "Contact details",
                "feedback": [{"section": "identity", "message": "Correct contact details."}],
            }),
        ):
            for expected in (None, previous.pk):
                data = dict(payload)
                if expected is not None:
                    data["expected_submission_id"] = expected
                response = method(reverse(route, args=[self.application.pk]), data, format="json")
                self.assertEqual(response.status_code, 409, response.data)
                self.assertEqual(response.data["code"], "STALE_APPLICATION_SUBMISSION")
        current = DuplicateReviewService.current_submission(self.application)
        response = self.client.post(
            reverse("merchant-application-approve", args=[self.application.pk]),
            {"expected_submission_id": current.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_legacy_reconsideration_remains_readable_but_is_not_needed(self):
        self.assess("confirmed_duplicate")
        AdminApplicationService.reject_application(
            self.application.pk,
            [],
            self.admin,
            duplicate=True,
            explanation="Same establishment.",
        )
        review = self.application.reviews.first()
        DuplicateReviewService.reconsider(
            self.application.pk,
            self.admin,
            review.pk,
            "Legacy clearance.",
        )
        self.assertTrue(DuplicateReviewService.disposition(self.application)["reconsidered"])
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("application-detail"))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data["data"]["duplicate_disposition"]["reconsideration_explanation"],
            "Legacy clearance.",
        )
        ApplicationService.submit_application(self.application)
        self.assertTrue(DuplicateReviewService.review_state(self.application)["approval_blocked"])
        self.assertTrue(review.duplicate_reconsideration.pk)

    def test_clearance_cannot_override_account_eligibility(self):
        self.assess()
        self.user.USER_STATUS = "suspended"
        self.user.save()
        with self.assertRaises(ValidationError):
            AdminApplicationService.approve_application(self.application.pk, self.admin)
        self.assertFalse(self.application.reviews.exists())

    def test_stale_assessment_payload_cannot_clear_changed_evidence(self):
        state = DuplicateReviewService.review_state(self.application)
        candidate = state["candidates"][0]
        location = self.target.location
        location.MLOC_UNIT = "Another unit"
        location.save()
        with self.assertRaises(ValidationError):
            DuplicateReviewService.assess(
                self.application.pk,
                self.admin,
                {
                    "submission_id": state["submission_id"],
                    "candidate_key": candidate["key"],
                    "fingerprint": candidate["fingerprint"],
                    "decision": "legitimate",
                    "explanation": "This was reviewed against old evidence.",
                },
            )
        self.assertFalse(MerchantApplicationDuplicateAssessment.objects.exists())

    def test_each_candidate_needs_individual_resolution(self):
        self.assess()
        third_user = User.objects.create_user(
            email="third-owner@example.com",
            password=None,
            USER_FNAME="Third",
            USER_LNAME="Owner",
        )
        business = Business.objects.create(
            BUSN_NAME="Sugbo Bistro",
            BUSN_CONTACT_NUMBER="09123456789",
            USER_ID=third_user,
            CTGRY_ID=self.category,
            LOCT_ID=Location.objects.create(
                LOCT_POINT=self.target.location.MLOC_POINT,
                LOCT_ADDRESS="A different address",
            ),
        )
        state = DuplicateReviewService.review_state(self.application)
        self.assertEqual(len(state["candidates"]), 2)
        self.assertTrue(state["approval_blocked"])
        self.assertTrue(any(
            candidate["key"] == f"business:{business.pk}" and not candidate["resolved"]
            for candidate in state["candidates"]
        ))

    def test_confirmation_is_required_before_duplicate_rejection(self):
        with self.assertRaises(ValidationError):
            AdminApplicationService.reject_application(
                self.application.pk,
                [],
                self.admin,
                duplicate=True,
                explanation="Not yet assessed.",
            )
        self.assertFalse(self.application.reviews.exists())
