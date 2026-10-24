from django.db import IntegrityError, models, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.business.models import (
    Business,
    BusinessSpecialtyTag,
    BusinessVouch,
    SpecialtyTag,
)
from apps.notifications.services.notification_event_service import (
    NotificationEventService,
)
from apps.users.models import User
from apps.users.services.reputation_service import ReputationService
from apps.business.services.discovery_score_refresh_service import DiscoveryScoreRefreshService


class VouchService:
    """Maintains one scoring identity through endorsement withdrawal and reinstatement."""

    @staticmethod
    def _dispatch_score_refresh(
        business_id: int,
    ) -> None:
        """Queues a scoped score refresh without failing an already committed endorsement."""
        from apps.business.tasks import recompute_business_discovery_score

        recompute_business_discovery_score.delay(
            business_id=business_id,
        )

    @staticmethod
    def _schedule_score_refresh(
        business_id: int,
    ) -> None:
        """Dispatches score work only after the endorsement transaction commits."""
        DiscoveryScoreRefreshService.request_refresh(
            business_id,
            publisher=VouchService._dispatch_score_refresh,
        )

    @staticmethod
    def _lock_user(
        user: User,
    ) -> User:
        """Locks the actor before any business, assignment, or endorsement lock."""
        try:
            return User.objects.select_for_update().get(
                USER_ID=user.USER_ID,
            )
        except User.DoesNotExist:
            raise NotFound(
                "The user could not be found.",
            )

    @staticmethod
    def _lock_business(
        business_id: int,
    ) -> Business:
        """Locks the business before its assignments and endorsements."""
        try:
            return Business.objects.select_for_update().get(
                BUSN_ID=business_id,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

    @staticmethod
    def _update_counts(
        business: Business,
        business_tag: BusinessSpecialtyTag,
        change: int,
    ) -> None:
        """Counts non-withdrawn endorsements independently of evidence validity."""
        Business.objects.filter(
            BUSN_ID=business.BUSN_ID,
        ).update(
            BUSN_VOUCH_COUNT=models.F("BUSN_VOUCH_COUNT") + change,
        )
        BusinessSpecialtyTag.objects.filter(
            BST_ID=business_tag.BST_ID,
        ).update(
            BST_VOUCH_COUNT=models.F("BST_VOUCH_COUNT") + change,
        )

    @staticmethod
    def get_retained_vouches(
        business_id,
        *,
        as_of,
    ):
        """Select surviving valid evidence on specialties active at the current read."""
        active_link = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=business_id,
            TAG_ID=models.OuterRef("TAG_ID"),
            BST_IS_ACTIVE=True,
            BST_CREATED_AT__lte=as_of,
        )
        return BusinessVouch.objects.filter(
            BUSN_ID=business_id,
            VOUCH_WITHDRAWN_AT__isnull=True,
            VOUCH_EVIDENCE_IS_VALID=True,
            VOUCH_CREATED_AT__lte=as_of,
        ).filter(
            models.Exists(active_link),
        )

    @staticmethod
    def get_current_specialty_support(
        business_id,
        *,
        as_of,
    ):
        """Report valid endorsements and distinct supporters for every current active specialty."""
        links = list(
            BusinessSpecialtyTag.objects.filter(
                BUSN_ID=business_id,
                BST_IS_ACTIVE=True,
                BST_CREATED_AT__lte=as_of,
            ).values(
                "TAG_ID",
                "TAG_ID__TAG_NAME",
            ).order_by(
                "TAG_ID__TAG_NAME",
                "TAG_ID",
            ),
        )
        tag_ids = [
            row["TAG_ID"]
            for row in links
        ]
        evidence = BusinessVouch.objects.filter(
            BUSN_ID=business_id,
            TAG_ID__in=tag_ids,
            VOUCH_WITHDRAWN_AT__isnull=True,
            VOUCH_EVIDENCE_IS_VALID=True,
            VOUCH_CREATED_AT__lte=as_of,
        ).values(
            "TAG_ID",
        ).annotate(
            valid_vouches=models.Count("VOUCH_ID"),
            distinct_supporters=models.Count("USER_ID", distinct=True),
        )
        # Suspicion alone does not invalidate evidence under the maintained vouch rules.
        counts = {
            row["TAG_ID"]: row
            for row in evidence
        }
        support = []
        for row in links:
            tag_counts = counts.get(row["TAG_ID"], {})
            support.append(
                {
                    "specialty_id": row["TAG_ID"],
                    "specialty_name": row["TAG_ID__TAG_NAME"],
                    "valid_vouches": tag_counts.get("valid_vouches", 0),
                    "distinct_supporters": tag_counts.get("distinct_supporters", 0),
                },
            )
        return support

    @staticmethod
    @transaction.atomic
    def create_vouch(
        user: User,
        business_id: int,
        tag_id: int,
        installation_id: str | None = None,
    ) -> BusinessVouch:
        """Creates or reinstates support without renewing its original scoring identity."""
        locked_user = VouchService._lock_user(
            user,
        )
        business = VouchService._lock_business(
            business_id,
        )

        if business.USER_ID_id == locked_user.USER_ID:
            raise ValidationError(
                "You cannot vouch for your own business.",
            )

        if business.BUSN_STATUS != Business.BusinessStatus.ACTIVE:
            raise ValidationError(
                "You cannot vouch for an inactive business.",
            )

        try:
            tag = SpecialtyTag.objects.get(
                TAG_ID=tag_id,
            )
        except SpecialtyTag.DoesNotExist:
            raise NotFound(
                "The specialty tag could not be found.",
            )

        try:
            business_tag = (
                BusinessSpecialtyTag.objects
                .select_for_update()
                .get(
                    BUSN_ID=business_id,
                    TAG_ID=tag_id,
                    BST_IS_ACTIVE=True,
                )
            )
        except BusinessSpecialtyTag.DoesNotExist:
            raise ValidationError(
                "This specialty is not associated with the business.",
            )

        vouch = (
            BusinessVouch.objects
            .select_for_update()
            .filter(
                BUSN_ID=business,
                USER_ID=locked_user,
                TAG_ID=tag,
            )
            .first()
        )
        if vouch is not None:
            if vouch.VOUCH_WITHDRAWN_AT is None:
                raise ValidationError(
                    "You have already vouched for this specialty.",
                )
            if not vouch.VOUCH_EVIDENCE_IS_VALID:
                raise ValidationError(
                    "This endorsement cannot be reinstated because its evidence is invalid.",
                )

            vouch.VOUCH_WITHDRAWN_AT = None
            vouch.save(
                update_fields=[
                    "VOUCH_WITHDRAWN_AT",
                    "VOUCH_UPDATED_AT",
                ],
            )
            VouchService._update_counts(
                business=business,
                business_tag=business_tag,
                change=1,
            )
            VouchService._schedule_score_refresh(
                business_id,
            )
            return vouch

        try:
            with transaction.atomic():
                vouch = BusinessVouch.objects.create(
                    BUSN_ID=business,
                    USER_ID=locked_user,
                    TAG_ID=tag,
                    VOUCH_INSTALLATION_ID=installation_id,
                    VOUCH_REPUTATION_SNAPSHOT=(
                        locked_user.USER_REPUTATION
                    ),
                    VOUCH_EVIDENCE_IS_VALID=True,
                )
        except IntegrityError:
            raise ValidationError(
                "You have already vouched for this specialty.",
            )

        VouchService._update_counts(
            business=business,
            business_tag=business_tag,
            change=1,
        )

        ReputationService.apply_vouch_reward(
            user_id=locked_user.USER_ID,
            source_id=vouch.VOUCH_ID,
            business_id=business.BUSN_ID,
            specialty_tag_id=tag.TAG_ID,
        )

        NotificationEventService.business_vouch_received(vouch)
        VouchService._schedule_score_refresh(
            business_id,
        )

        return vouch

    @staticmethod
    @transaction.atomic
    def remove_vouch(
        user: User,
        business_id: int,
        tag_id: int,
    ) -> None:
        """Withdraws support once while retaining its evidence and reputation history."""
        locked_user = VouchService._lock_user(
            user,
        )
        business = VouchService._lock_business(
            business_id,
        )
        # Withdrawal remains possible when the business or assignment is inactive.
        try:
            business_tag = (
                BusinessSpecialtyTag.objects
                .select_for_update()
                .get(
                    BUSN_ID=business,
                    TAG_ID=tag_id,
                )
            )
        except BusinessSpecialtyTag.DoesNotExist:
            raise NotFound(
                "Your vouch could not be found.",
            )

        try:
            vouch = (
                BusinessVouch.objects
                .select_for_update()
                .get(
                    BUSN_ID=business_id,
                    USER_ID=locked_user,
                    TAG_ID=tag_id,
                    VOUCH_WITHDRAWN_AT__isnull=True,
                )
            )
        except BusinessVouch.DoesNotExist:
            raise NotFound(
                "Your vouch could not be found.",
            )

        vouch.VOUCH_WITHDRAWN_AT = timezone.now()
        vouch.save(
            update_fields=[
                "VOUCH_WITHDRAWN_AT",
                "VOUCH_UPDATED_AT",
            ],
        )
        VouchService._update_counts(
            business=business,
            business_tag=business_tag,
            change=-1,
        )
        VouchService._schedule_score_refresh(
            business_id,
        )

    @staticmethod
    def has_vouched(
        user: User,
        business_id: int,
        tag_id: int,
    ) -> bool:
        """Checks current support without redefining evidence validity."""
        return BusinessVouch.objects.filter(
            BUSN_ID=business_id,
            USER_ID=user,
            TAG_ID=tag_id,
            VOUCH_WITHDRAWN_AT__isnull=True,
        ).exists()
