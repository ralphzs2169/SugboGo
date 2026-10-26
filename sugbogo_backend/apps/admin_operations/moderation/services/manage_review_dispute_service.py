from django.db import transaction
from django.db.models import Count, OuterRef, Prefetch, Q, Subquery
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import BusinessSpecialtyTag
from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import AdminActivityService
from apps.users.models import User
from apps.review_disputes.models import MerchantReviewDispute
from apps.review_disputes.services.review_snapshot_service import (
    DisputeContentConflict,
    ReviewSnapshotService,
)
from apps.reviews.models import Review, ReviewPhoto
from apps.reviews.services.review_moderation_consistency_service import (
    ReviewModerationConsistencyService,
)
from apps.users.services.reputation_service import ReputationService
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)


class ManageReviewDisputeService:
    """Handles administrator-facing review dispute moderation."""

    @staticmethod
    def _detail_queryset():
        """Load authorized investigation relations without per-attempt media queries."""
        active_specialty_tags = (
            BusinessSpecialtyTag.objects
            .filter(
                BST_IS_ACTIVE=True,
            )
            .select_related(
                "TAG_ID",
            )
        )

        return (
            MerchantReviewDispute.objects
            .select_related(
                "BUSN_ID",
                "BUSN_ID__USER_ID",
                "REVW_ID",
                "REVW_ID__USER_ID",
                "USER_ID",
                "snapshot",
            )
            .prefetch_related(
                Prefetch(
                    "BUSN_ID__specialty_tag_links",
                    queryset=active_specialty_tags,
                    to_attr="active_specialty_tag_links",
                ),
                "evidence",
                Prefetch(
                    "REVW_ID__photos",
                    queryset=ReviewPhoto.objects.order_by("RPHO_ID"),
                ),
                "REVW_ID__reports",
                "REVW_ID__reply",
            )
        )

    @staticmethod
    def list_disputes(
        status=None,
        reason=None,
        business_id=None,
        review_id=None,
        ordering=None,
        search=None,
    ):
        """List moderation cases with attempt numbers stable after source deletion."""
        queryset = ManageReviewDisputeService._detail_queryset()

        earlier_attempts = (
            MerchantReviewDispute.objects
            .filter(
                MRDSP_ORIGINAL_REVIEW_ID=OuterRef("MRDSP_ORIGINAL_REVIEW_ID"),
            )
            .filter(
                Q(MRDSP_CREATED_AT__lt=OuterRef("MRDSP_CREATED_AT"))
                | Q(
                    MRDSP_CREATED_AT=OuterRef("MRDSP_CREATED_AT"),
                    MRDSP_ID__lte=OuterRef("MRDSP_ID"),
                )
            )
            .order_by()
            .values("MRDSP_ORIGINAL_REVIEW_ID")
            .annotate(total=Count("MRDSP_ID"))
            .values("total")[:1]
        )
        queryset = queryset.annotate(
            attempt_number=Subquery(earlier_attempts),
        )

        if search:
            queryset = queryset.filter(
                Q(USER_ID__USER_FNAME__icontains=search)
                | Q(USER_ID__USER_LNAME__icontains=search)
                | Q(USER_ID__USER_EMAIL__icontains=search)
                | Q(BUSN_ID__BUSN_NAME__icontains=search)
                | Q(REVW_ID__REVW_TEXT__icontains=search)
                | Q(MRDSP_DESCRIPTION__icontains=search)
            )

        if status:
            queryset = queryset.filter(
                MRDSP_STATUS=status,
            )

        if reason:
            queryset = queryset.filter(
                MRDSP_REASON=reason,
            )

        if business_id:
            queryset = queryset.filter(
                BUSN_ID=business_id,
            )

        if review_id:
            queryset = queryset.filter(
                MRDSP_ORIGINAL_REVIEW_ID=review_id,
            )

        ordering_map = {
            "created_at": "MRDSP_CREATED_AT",
            "-created_at": "-MRDSP_CREATED_AT",
            "status": "MRDSP_STATUS",
            "-status": "-MRDSP_STATUS",
        }

        return queryset.order_by(
            ordering_map.get(
                ordering,
                "-MRDSP_CREATED_AT",
            ),
        )

    @staticmethod
    def get_dispute(
        dispute_id: int,
        *,
        for_update: bool = False,
    ) -> MerchantReviewDispute:
        """Retrieve a dispute, locking its review before its decision state."""
        try:
            queryset = ManageReviewDisputeService._detail_queryset()
            if for_update:
                review_id = (
                    MerchantReviewDispute.objects
                    .values_list("REVW_ID_id", flat=True)
                    .get(MRDSP_ID=dispute_id)
                )
                # Match deletion's parent-first order before locking the dispute.
                if review_id is not None:
                    Review.objects.select_for_update(of=("self",)).filter(
                        REVW_ID=review_id,
                    ).first()
                queryset = queryset.select_for_update(of=("self",))
            return queryset.get(MRDSP_ID=dispute_id)
        except (Review.DoesNotExist, MerchantReviewDispute.DoesNotExist):
            raise NotFound(
                "The review dispute could not be found.",
            ) from None


    @staticmethod
    @transaction.atomic
    def get_dispute_detail(
        dispute_id: int,
    ) -> MerchantReviewDispute:
        """Read current text and photos under the review lock for a coherent token."""
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
            for_update=True,
        )

        review_disputes = list(
            MerchantReviewDispute.objects
            .filter(
                MRDSP_ORIGINAL_REVIEW_ID=dispute.MRDSP_ORIGINAL_REVIEW_ID,
            )
            .select_related("snapshot")
            .prefetch_related("evidence")
            .order_by(
                "MRDSP_CREATED_AT",
                "MRDSP_ID",
            )
        )

        attempt_number = next(
            (
                index
                for index, attempt in enumerate(
                    review_disputes,
                    start=1,
                )
                if attempt.MRDSP_ID == dispute.MRDSP_ID
            ),
            1,
        )

        previous_disputes = [
            attempt
            for attempt in review_disputes[:attempt_number - 1]
        ]

        dispute.attempt_number = attempt_number
        dispute.previous_dispute_count = len(previous_disputes)
        dispute.previous_disputes = list(
            reversed(previous_disputes),
        )

        return dispute

    
    @staticmethod
    @transaction.atomic
    def uphold_dispute(
        dispute_id: int,
        admin_notes: str | None = None,
        *,
        actor: User,
        expected_fingerprint: str,
        acknowledge_review_changes: bool = False,
    ) -> MerchantReviewDispute:
        """Uphold a dispute and penalize the review author in one transaction."""
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
            for_update=True,
        )

        if (
            dispute.MRDSP_STATUS
            != MerchantReviewDispute.DisputeStatus.PENDING
        ):
            raise ValidationError(
                "Only pending review disputes can be upheld.",
            )

        ManageReviewDisputeService._validate_decision(
            dispute,
            expected_fingerprint,
            admin_notes,
            uphold=True,
            acknowledge_review_changes=acknowledge_review_changes,
        )

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.UPHELD
        )
        dispute.MRDSP_ADMIN_NOTES = admin_notes
        dispute.MRDSP_RESOLVED_AT = timezone.now()

        dispute.save(
            update_fields=[
                "MRDSP_STATUS",
                "MRDSP_ADMIN_NOTES",
                "MRDSP_RESOLVED_AT",
                "MRDSP_UPDATED_AT",
            ],
        )

        review, previous_review_status = (
            ReviewModerationConsistencyService.reject_review(
                dispute.REVW_ID_id,
            )
        )
        dispute.REVW_ID = review

        ReputationService.apply_confirmed_violation_penalty(
            user_id=dispute.REVW_ID.USER_ID_id,
            review_id=dispute.REVW_ID_id,
        )

        ManageReviewDisputeService._record_resolution(
            actor,
            dispute,
            AdminActivity.Action.REVIEW_DISPUTE_UPHELD,
            previous_review_status,
            Review.ReviewStatus.REJECTED,
        )
        NotificationEventService.review_dispute_resolved(
            dispute,
            previous_review_status,
        )
        return ManageReviewDisputeService.get_dispute_detail(dispute.pk)

    @staticmethod
    @transaction.atomic
    def dismiss_dispute(
        dispute_id: int,
        admin_notes: str | None = None,
        *,
        actor: User,
        expected_fingerprint: str,
        acknowledge_review_changes: bool = False,
    ) -> MerchantReviewDispute:
        """Dismisses a pending dispute and records its administrator decision."""
        dispute = ManageReviewDisputeService.get_dispute(
            dispute_id,
            for_update=True,
        )

        if (
            dispute.MRDSP_STATUS
            != MerchantReviewDispute.DisputeStatus.PENDING
        ):
            raise ValidationError(
                "Only pending review disputes can be dismissed.",
            )

        ManageReviewDisputeService._validate_decision(
            dispute,
            expected_fingerprint,
            admin_notes,
            acknowledge_review_changes=acknowledge_review_changes,
        )

        dispute.MRDSP_STATUS = (
            MerchantReviewDispute.DisputeStatus.DISMISSED
        )
        dispute.MRDSP_ADMIN_NOTES = admin_notes
        dispute.MRDSP_RESOLVED_AT = timezone.now()

        dispute.save(
            update_fields=[
                "MRDSP_STATUS",
                "MRDSP_ADMIN_NOTES",
                "MRDSP_RESOLVED_AT",
                "MRDSP_UPDATED_AT",
            ],
        )

        ManageReviewDisputeService._record_resolution(
            actor,
            dispute,
            AdminActivity.Action.REVIEW_DISPUTE_DISMISSED,
            dispute.REVW_ID.REVW_STATUS,
            dispute.REVW_ID.REVW_STATUS,
        )
        NotificationEventService.review_dispute_resolved(
            dispute,
            dispute.REVW_ID.REVW_STATUS,
        )
        return ManageReviewDisputeService.get_dispute_detail(dispute.pk)

    @staticmethod
    def _validate_decision(
        dispute,
        expected_fingerprint,
        admin_notes,
        *,
        uphold=False,
        acknowledge_review_changes=False,
    ):
        """Reject stale or unjustified decisions before any moderation side effects."""
        if dispute.REVW_ID is None:
            raise ValidationError("The original review no longer exists.")
        fingerprint = ReviewSnapshotService.current_fingerprint(dispute.REVW_ID)
        if fingerprint != expected_fingerprint:
            raise DisputeContentConflict()
        snapshot = getattr(dispute, "snapshot", None)
        if uphold and (
            snapshot is None
            or snapshot.MRDS_FINGERPRINT != fingerprint
        ):
            if (
                not admin_notes
                or len(admin_notes.strip()) < 20
            ):
                raise ValidationError({
                    "admin_notes": (
                        "Provide at least 20 characters explaining why rejecting "
                        "the current review is justified."
                    ),
                })
            if acknowledge_review_changes is not True:
                raise ValidationError({
                    "acknowledge_review_changes": (
                        "Acknowledge the changed review or unavailable snapshot and "
                        "explain in admin_notes why rejecting the current review is justified."
                    ),
                })
        dispute.acknowledged_review_changes = acknowledge_review_changes

    @staticmethod
    def _record_resolution(
        actor,
        dispute,
        action,
        previous_review_status,
        review_status,
    ):
        """Records the administrator and state transition for a dispute decision."""
        AdminActivityService.record_user_action(
            actor=actor,
            target_user=dispute.REVW_ID.USER_ID,
            action=action,
            context={
                "dispute_id": dispute.MRDSP_ID,
                "review_id": dispute.REVW_ID_id,
                "business_id": dispute.REVW_ID.BUSN_ID_id,
                "reason": dispute.MRDSP_REASON,
                "admin_notes": dispute.MRDSP_ADMIN_NOTES,
                "previous_dispute_status": MerchantReviewDispute.DisputeStatus.PENDING,
                "dispute_status": dispute.MRDSP_STATUS,
                "previous_review_status": previous_review_status,
                "review_status": review_status,
                "decision_content_fingerprint": (
                    ReviewSnapshotService.current_fingerprint(dispute.REVW_ID)
                ),
                "filing_snapshot_available": (
                    getattr(dispute, "snapshot", None) is not None
                ),
                "acknowledged_review_changes": dispute.acknowledged_review_changes,
            },
        )
