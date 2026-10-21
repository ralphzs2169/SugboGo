"""Persist duplicate decisions and enforce current submission-specific clearance."""

from django.db import connection, transaction
from rest_framework.exceptions import ValidationError

from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDuplicateAssessment,
    MerchantApplicationDuplicateReconsideration,
)
from apps.merchant_application.services.duplicate_detection_service import (
    DuplicateDetectionService,
)


def lock_duplicate_approvals():
    """Serialize participating approvals before any applicant or application row lock."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(736421, 1)")


class DuplicateReviewService:
    """Keep duplicate adjudication independent from ordinary correction fingerprints."""

    @staticmethod
    def current_submission(application):
        """Return the latest saved submission, including while its rejection is reconsidered."""
        return application.submissions.order_by("-MASUB_SUBMISSION_NUMBER").first()

    @staticmethod
    def review_state(application):
        """Expose current matches with valid, stale, or missing administrator decisions."""
        submission = DuplicateReviewService.current_submission(application)
        assessments = {}
        if submission is not None:
            for assessment in submission.duplicate_assessments.all():
                assessments.setdefault(assessment.MDAS_CANDIDATE_KEY, assessment)

        candidates = DuplicateDetectionService.find_candidates(application)
        for candidate in candidates:
            assessment = assessments.get(candidate["key"])
            candidate["assessment"] = None
            candidate["stale"] = False
            candidate["resolved"] = False
            if assessment is not None:
                candidate["stale"] = assessment.MDAS_FINGERPRINT != candidate["fingerprint"]
                candidate["assessment"] = {
                    "decision": assessment.MDAS_DECISION,
                    "explanation": assessment.MDAS_EXPLANATION,
                    "reviewer_id": assessment.USER_ID_id,
                    "reviewed_at": assessment.MDAS_CREATED_AT.isoformat(),
                }
                candidate["resolved"] = (
                    not candidate["stale"]
                    and assessment.MDAS_DECISION
                    == MerchantApplicationDuplicateAssessment.Decision.LEGITIMATE
                )
        return {
            "submission_id": submission.pk if submission is not None else None,
            "candidates": candidates,
            "approval_blocked": any(not candidate["resolved"] for candidate in candidates),
            "disposition": DuplicateReviewService.disposition(application),
        }

    @staticmethod
    def disposition(application):
        """Return privacy-safe duplicate rejection information separately from section feedback."""
        review = application.reviews.order_by("-MAREV_REVIEWED_AT", "-MAREV_ID").first()
        if review is None or not review.MAREV_DUPLICATE_REJECTION:
            return None
        clearance = getattr(review, "duplicate_reconsideration", None)
        return {
            "review_id": review.pk,
            "explanation": review.MAREV_DUPLICATE_EXPLANATION,
            "reconsidered": clearance is not None,
            "reconsideration_explanation": (
                clearance.MDRC_EXPLANATION if clearance is not None else None
            ),
        }

    @staticmethod
    def enforce_approval(application):
        """Block every current candidate lacking a valid legitimate-match assessment."""
        if DuplicateReviewService.review_state(application)["approval_blocked"]:
            raise ValidationError({
                "duplicates": "Resolve all current possible duplicate matches before approval.",
            })

    @staticmethod
    def validate_duplicate_rejection(application):
        """Require a current confirmed-duplicate assessment before explicit rejection."""
        state = DuplicateReviewService.review_state(application)
        confirmed = any(
            not candidate["stale"]
            and candidate["assessment"] is not None
            and candidate["assessment"]["decision"]
            == MerchantApplicationDuplicateAssessment.Decision.DUPLICATE
            for candidate in state["candidates"]
        )
        if not confirmed:
            raise ValidationError({
                "duplicates": "Confirm a current duplicate match before rejecting as a duplicate.",
            })

    @staticmethod
    @transaction.atomic
    def assess(
        application_id,
        reviewer,
        validated_data,
    ):
        """Append an assessment only if its submission and evidence are still current."""
        from apps.admin_operations.business_management.services.manage_application_service import (
            ApplicationService,
        )

        lock_duplicate_approvals()
        application, _ = ApplicationService._get_locked_application(application_id)
        if application.MAPP_STATUS != MerchantApplication.ApplicationStatus.SUBMITTED:
            raise ValidationError("Only submitted applications can be assessed.")
        state = DuplicateReviewService.review_state(application)
        if state["submission_id"] != validated_data["submission_id"]:
            raise ValidationError("The submission changed. Reload the duplicate review.")
        candidate = next(
            (
                item
                for item in state["candidates"]
                if item["key"] == validated_data["candidate_key"]
            ),
            None,
        )
        if (
            candidate is None
            or candidate["fingerprint"] != validated_data["fingerprint"]
        ):
            raise ValidationError("The matching evidence changed. Reload the duplicate review.")
        MerchantApplicationDuplicateAssessment.objects.create(
            MASUB_ID_id=state["submission_id"],
            MDAS_CANDIDATE_KEY=candidate["key"],
            MDAS_FINGERPRINT=candidate["fingerprint"],
            MDAS_EVIDENCE=candidate,
            MDAS_DECISION=validated_data["decision"],
            MDAS_EXPLANATION=validated_data.get("explanation", ""),
            USER_ID=reviewer,
        )
        return DuplicateReviewService.review_state(application)

    @staticmethod
    @transaction.atomic
    def reconsider(
        application_id,
        reviewer,
        review_id,
        explanation,
    ):
        """Support deprecated admin clients; resubmission no longer requires this record."""
        from apps.admin_operations.business_management.services.manage_application_service import (
            ApplicationService,
        )

        application, _ = ApplicationService._get_locked_application(application_id)
        disposition = DuplicateReviewService.disposition(application)
        if (
            application.MAPP_STATUS != MerchantApplication.ApplicationStatus.REJECTED
            or disposition is None
            or disposition["review_id"] != review_id
        ):
            raise ValidationError("Only the current duplicate rejection can be reconsidered.")
        if disposition["reconsidered"]:
            raise ValidationError("This rejection has already been reconsidered.")
        MerchantApplicationDuplicateReconsideration.objects.create(
            MAREV_ID_id=review_id,
            USER_ID=reviewer,
            MDRC_EXPLANATION=explanation,
        )
        return DuplicateReviewService.review_state(application)
