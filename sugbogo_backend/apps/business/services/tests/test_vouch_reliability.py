from datetime import timedelta
from unittest.mock import patch

from django.db import DatabaseError
from django.test import TestCase
from django.utils import timezone

from apps.business.models import Business, BusinessVouch
from apps.business.services.specialty_score_service import SpecialtyScoreService
from apps.business.services.tests.test_vouch_lifecycle import VouchLifecycleFixtures
from apps.business.services.vouch_service import VouchService
from apps.users.models import ReputationEvent, User


class VouchReliabilityTests(VouchLifecycleFixtures, TestCase):
    """Exercises the single advisory rule through real endorsement creation."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.actors = [cls.user, cls.second_user]
        for index in range(3):
            cls.actors.append(
                User.objects.create(
                    USER_EMAIL=f"vouch-actor-{index}@example.com",
                    USER_FNAME="Supporter",
                    USER_LNAME=str(index),
                    USER_ROLE=User.UserRole.EXPLORER,
                    USER_STATUS=User.UserStatus.ACTIVE,
                    password="!",
                ),
            )

    def setUp(self):
        super().setUp()
        self.now = timezone.now()

    def history(
        self,
        user,
        *,
        created_at=None,
        installation_id="shared-installation",
        business=None,
        tag=None,
        **state,
    ):
        """Creates retained historical activity without granting new rewards."""
        vouch = BusinessVouch.objects.create(
            BUSN_ID=business or self.business,
            TAG_ID=tag or self.spicy_tag,
            USER_ID=user,
            VOUCH_INSTALLATION_ID=installation_id,
            VOUCH_REPUTATION_SNAPSHOT=user.USER_REPUTATION,
            **state,
        )
        BusinessVouch.objects.filter(pk=vouch.pk).update(
            VOUCH_CREATED_AT=created_at or self.now - timedelta(hours=1),
        )
        return vouch

    def submit(
        self,
        user=None,
        installation_id="shared-installation",
    ):
        """Fixes the observation clock for exact rolling-window assertions."""
        with patch(
            "apps.business.services.vouch_service.timezone.now",
            return_value=self.now,
        ):
            return VouchService.create_vouch(
                user=user or self.actors[4],
                business_id=self.business.pk,
                tag_id=self.spicy_tag.pk,
                installation_id=installation_id,
            )

    def test_threshold_includes_retained_activity_and_only_flags_new_vouch(self):
        """The fifth account flags only itself and remains eligible for scoring."""
        for actor in self.actors[:3]:
            self.history(
                actor,
                VOUCH_WITHDRAWN_AT=self.now,
                VOUCH_EVIDENCE_IS_VALID=False,
            )
        fourth = self.submit(self.actors[3])
        self.assertFalse(fourth.VOUCH_FLAG_SUSPICIOUS)
        fifth = self.submit()
        finding = fifth.VOUCH_RELIABILITY_EVIDENCE[VouchService.CONCENTRATION_REASON]
        self.assertTrue(fifth.VOUCH_FLAG_SUSPICIOUS)
        self.assertEqual(finding["distinct_account_count"], 5)
        self.assertEqual(finding["threshold"], 5)
        self.assertEqual(finding["window_hours"], 24)
        self.assertEqual(
            BusinessVouch.objects.filter(VOUCH_FLAG_SUSPICIOUS=True).count(),
            1,
        )
        result = SpecialtyScoreService.recompute_tag_score(
            business_specialty_id=self.spicy_business_tag.pk,
        )
        self.assertEqual(result.valid_evidence_count, 2)
        self.assertTrue(fifth.VOUCH_EVIDENCE_IS_VALID)
        self.assertTrue(
            ReputationEvent.objects.filter(
                REVT_SOURCE_ID=fifth.pk,
            ).exists(),
        )

    def test_window_includes_exact_boundary_but_excludes_older_and_future(self):
        """The rolling observation has inclusive start and end timestamps."""
        for actor in self.actors[:4]:
            self.history(
                actor,
                created_at=self.now - timedelta(hours=24),
            )
        fifth = self.submit()
        self.assertTrue(fifth.VOUCH_FLAG_SUSPICIOUS)
        BusinessVouch.objects.filter(pk=fifth.pk).delete()
        BusinessVouch.objects.filter(USER_ID=self.actors[0]).update(
            VOUCH_CREATED_AT=self.now - timedelta(hours=24, microseconds=1),
        )
        self.assertFalse(self.submit().VOUCH_FLAG_SUSPICIOUS)
        BusinessVouch.objects.filter(USER_ID=self.actors[4]).delete()
        BusinessVouch.objects.filter(USER_ID=self.actors[0]).update(
            VOUCH_CREATED_AT=self.now + timedelta(microseconds=1),
        )
        self.assertFalse(self.submit().VOUCH_FLAG_SUSPICIOUS)

    def test_multiple_specialties_count_each_account_once(self):
        """Several endorsements from one account do not inflate concentration."""
        for actor in self.actors[:2]:
            self.history(actor)
            self.history(actor, tag=self.traditional_tag)
        self.assertFalse(self.submit().VOUCH_FLAG_SUSPICIOUS)

    def test_blank_ids_and_unrelated_installations_or_businesses_do_not_combine(self):
        """Only the same usable installation and business form the cohort."""
        other_owner = User.objects.create(
            USER_EMAIL="other-vouch-owner@example.com",
            USER_ROLE=User.UserRole.MERCHANT,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        other = Business.objects.create(
            BUSN_NAME="Other business",
            BUSN_DESCRIPTION="Unrelated activity",
            BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            USER_ID=other_owner,
            CTGRY_ID=self.category,
            LOCT_ID=self.location,
        )
        for actor in self.actors[:4]:
            self.history(actor, business=other)
            self.history(actor, installation_id="other-installation")
        self.assertFalse(self.submit().VOUCH_FLAG_SUSPICIOUS)
        for installation_id in (None, "", " \t"):
            BusinessVouch.objects.filter(USER_ID=self.actors[4]).delete()
            with self.subTest(installation_id=installation_id):
                vouch = self.submit(installation_id=installation_id)
                self.assertFalse(vouch.VOUCH_FLAG_SUSPICIOUS)

    def test_detection_database_failure_rolls_back_only_the_finding(self):
        """A failed advisory write leaves the endorsement and reward intact."""
        def fail_after_write(vouch):
            """Raises after a write to exercise the advisory savepoint rollback."""
            BusinessVouch.objects.filter(pk=vouch.pk).update(
                VOUCH_FLAG_SUSPICIOUS=True,
            )
            raise DatabaseError("Detection unavailable")

        with patch.object(
            VouchService,
            "_record_reliability_finding",
            side_effect=fail_after_write,
        ):
            vouch = self.submit()
        vouch.refresh_from_db()
        self.assertFalse(vouch.VOUCH_FLAG_SUSPICIOUS)
        self.assertEqual(vouch.VOUCH_RELIABILITY_EVIDENCE, {})
        self.assertTrue(vouch.VOUCH_EVIDENCE_IS_VALID)
        self.assertTrue(
            ReputationEvent.objects.filter(
                REVT_SOURCE_ID=vouch.pk,
            ).exists(),
        )
        self._assert_counts(1)

    def test_withdrawal_and_reinstatement_preserve_the_original_finding(self):
        """Reinstatement does not rerun detection or replace original context."""
        for actor in self.actors[:4]:
            self.history(actor)
        vouch = self.submit()
        original = vouch.VOUCH_RELIABILITY_EVIDENCE
        original_snapshot = vouch.VOUCH_REPUTATION_SNAPSHOT
        VouchService.remove_vouch(
            user=self.actors[4],
            business_id=self.business.pk,
            tag_id=self.spicy_tag.pk,
        )
        with patch.object(VouchService, "_record_reliability_finding") as detect:
            restored = self.submit(installation_id="replacement")
        detect.assert_not_called()
        self.assertEqual(restored.pk, vouch.pk)
        self.assertEqual(restored.VOUCH_RELIABILITY_EVIDENCE, original)
        self.assertEqual(restored.VOUCH_REPUTATION_SNAPSHOT, original_snapshot)
        self.assertEqual(restored.VOUCH_CREATED_AT, vouch.VOUCH_CREATED_AT)
        self.assertEqual(restored.VOUCH_INSTALLATION_ID, "shared-installation")
        self.assertTrue(restored.VOUCH_FLAG_SUSPICIOUS)
        self.assertTrue(restored.VOUCH_EVIDENCE_IS_VALID)
        self.assertEqual(ReputationEvent.objects.count(), 1)
