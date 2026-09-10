from decimal import Decimal

from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.admin_operations.system_configuration.services import (
    DiscoveryAlgorithmConfigurationService,
)
from apps.users.models import ReputationEvent, User

ZERO = Decimal("0.00")
ONE = Decimal("1.00")


class ReputationService:
    """Applies all explorer reputation mutations transactionally."""

    @staticmethod
    def apply_vouch_reward(
        user_id: int,
        source_id: int,
        business_id: int,
        specialty_tag_id: int,
    ) -> ReputationEvent:
        source_key = ReputationService._build_source_key(
            user_id=user_id,
            business_id=business_id,
            specialty_tag_id=specialty_tag_id,
        )

        return ReputationService._apply_event(
            user_id=user_id,
            event_type=ReputationEvent.EventType.VOUCH_REWARD,
            source_type=ReputationEvent.SourceType.BUSINESS_VOUCH,
            source_id=source_id,
            source_key=source_key,
            configuration_field="DAC_VOUCH_REPUTATION_REWARD",
            use_vouch_cap=True,
        )

    @staticmethod
    def apply_review_reward(
        user_id: int,
        source_id: int,
        business_id: int,
    ) -> ReputationEvent:
        source_key = ReputationService._build_source_key(
            user_id=user_id,
            business_id=business_id,
        )

        return ReputationService._apply_event(
            user_id=user_id,
            event_type=ReputationEvent.EventType.REVIEW_REWARD,
            source_type=ReputationEvent.SourceType.BUSINESS_REVIEW,
            source_id=source_id,
            source_key=source_key,
            configuration_field="DAC_REVIEW_REPUTATION_REWARD",
            superseding_event_type=(
                ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD
            ),
        )

    @staticmethod
    def apply_review_with_photo_reward(
        user_id: int,
        source_id: int,
        business_id: int,
    ) -> ReputationEvent:
        source_key = ReputationService._build_source_key(
            user_id=user_id,
            business_id=business_id,
        )

        return ReputationService._apply_event(
            user_id=user_id,
            event_type=(
                ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD
            ),
            source_type=ReputationEvent.SourceType.BUSINESS_REVIEW,
            source_id=source_id,
            source_key=source_key,
            configuration_field=(
                "DAC_REVIEW_PHOTO_REPUTATION_REWARD"
            ),
            difference_configuration_field=(
                "DAC_REVIEW_REPUTATION_REWARD"
            ),
            difference_if_event_type=(
                ReputationEvent.EventType.REVIEW_REWARD
            ),
        )

    @staticmethod
    def apply_review_photo_upgrade_reward(
        user_id: int,
        source_id: int,
        business_id: int,
    ) -> ReputationEvent:
        source_key = ReputationService._build_source_key(
            user_id=user_id,
            business_id=business_id,
        )

        return ReputationService._apply_event(
            user_id=user_id,
            event_type=(
                ReputationEvent.EventType.REVIEW_WITH_PHOTO_REWARD
            ),
            source_type=ReputationEvent.SourceType.BUSINESS_REVIEW,
            source_id=source_id,
            source_key=source_key,
            configuration_field=(
                "DAC_REVIEW_PHOTO_REPUTATION_REWARD"
            ),
            difference_configuration_field=(
                "DAC_REVIEW_REPUTATION_REWARD"
            ),
            force_configuration_difference=True,
        )

    @staticmethod
    def apply_approved_report_reward(
        user_id: int,
        source_id: int,
    ) -> ReputationEvent:
        return ReputationService._apply_event(
            user_id=user_id,
            event_type=(
                ReputationEvent.EventType.APPROVED_REPORT_REWARD
            ),
            source_type=ReputationEvent.SourceType.REVIEW_REPORT,
            source_id=source_id,
            source_key=f"report:{source_id}",
            configuration_field=(
                "DAC_APPROVED_REPORT_REPUTATION_REWARD"
            ),
        )

    @staticmethod
    def apply_confirmed_violation_penalty(
        user_id: int,
        review_id: int,
    ) -> ReputationEvent:
        return ReputationService._apply_event(
            user_id=user_id,
            event_type=(
                ReputationEvent.EventType.CONFIRMED_VIOLATION_PENALTY
            ),
            source_type=(
                ReputationEvent.SourceType.CONFIRMED_REVIEW_VIOLATION
            ),
            source_id=review_id,
            source_key=f"review:{review_id}",
            configuration_field=(
                "DAC_CONFIRMED_VIOLATION_REPUTATION_PENALTY"
            ),
            is_penalty=True,
        )

    @staticmethod
    @transaction.atomic
    def _apply_event(
        user_id: int,
        event_type: str,
        source_type: str,
        source_id: int,
        source_key: str,
        configuration_field: str,
        is_penalty: bool = False,
        use_vouch_cap: bool = False,
        superseding_event_type: str | None = None,
        difference_configuration_field: str | None = None,
        difference_if_event_type: str | None = None,
        force_configuration_difference: bool = False,
    ) -> ReputationEvent:
        if source_id < 1:
            raise ValidationError(
                {
                    "source_id": (
                        "The reputation event source ID must be positive."
                    ),
                },
            )

        try:
            user = (
                User.objects
                .select_for_update()
                .get(
                    USER_ID=user_id,
                )
            )
        except User.DoesNotExist:
            raise NotFound(
                "The user could not be found.",
            )

        existing_event = (
            ReputationEvent.objects
            .filter(
                REVT_SOURCE_TYPE=source_type,
                REVT_EVENT_TYPE=event_type,
                REVT_SOURCE_KEY=source_key,
            )
            .first()
        )

        if existing_event is not None:
            ReputationService._validate_existing_event(
                existing_event=existing_event,
                user=user,
                event_type=event_type,
                source_type=source_type,
                source_key=source_key,
            )

            return existing_event

        if superseding_event_type is not None:
            superseding_event = (
                ReputationEvent.objects
                .filter(
                    REVT_SOURCE_TYPE=source_type,
                    REVT_EVENT_TYPE=superseding_event_type,
                    REVT_SOURCE_KEY=source_key,
                )
                .first()
            )

            if superseding_event is not None:
                ReputationService._validate_existing_event(
                    existing_event=superseding_event,
                    user=user,
                    event_type=superseding_event_type,
                    source_type=source_type,
                    source_key=source_key,
                )

                return superseding_event

        difference_event_exists = False

        if difference_if_event_type is not None:
            difference_event_exists = (
                ReputationEvent.objects
                .filter(
                    REVT_SOURCE_TYPE=source_type,
                    REVT_EVENT_TYPE=difference_if_event_type,
                    REVT_SOURCE_KEY=source_key,
                )
                .exists()
            )

        configuration = (
            DiscoveryAlgorithmConfigurationService
            .require_complete_reputation_configuration()
        )

        configured_change = getattr(
            configuration,
            configuration_field,
        )

        if (
            difference_configuration_field is not None
            and (
                force_configuration_difference
                or difference_event_exists
            )
        ):
            lower_tier_change = getattr(
                configuration,
                difference_configuration_field,
            )

            configured_change = max(
                ZERO,
                configured_change - lower_tier_change,
            )

        current_reputation = user.USER_REPUTATION

        resulting_reputation = ReputationService._calculate_result(
            current_reputation=current_reputation,
            configured_change=configured_change,
            vouch_cap=configuration.DAC_VOUCH_ONLY_REPUTATION_CAP,
            is_penalty=is_penalty,
            use_vouch_cap=use_vouch_cap,
        )

        applied_change = resulting_reputation - current_reputation

        try:
            with transaction.atomic():
                event = ReputationEvent.objects.create(
                    USER_ID=user,
                    REVT_EVENT_TYPE=event_type,
                    REVT_APPLIED_CHANGE=applied_change,
                    REVT_RESULTING_REPUTATION=resulting_reputation,
                    REVT_SOURCE_TYPE=source_type,
                    REVT_SOURCE_ID=source_id,
                    REVT_SOURCE_KEY=source_key,
                )
        except IntegrityError:
            existing_event = ReputationEvent.objects.get(
                REVT_SOURCE_TYPE=source_type,
                REVT_EVENT_TYPE=event_type,
                REVT_SOURCE_KEY=source_key,
            )

            ReputationService._validate_existing_event(
                existing_event=existing_event,
                user=user,
                event_type=event_type,
                source_type=source_type,
                source_key=source_key,
            )

            return existing_event

        user.USER_REPUTATION = resulting_reputation
        user.save(
            update_fields=[
                "USER_REPUTATION",
                "USER_UPDATED_AT",
            ],
        )

        return event

    @staticmethod
    def _build_source_key(
        **components: int,
    ) -> str:
        for field_name, value in components.items():
            if value < 1:
                raise ValidationError(
                    {
                        field_name: (
                            "Reputation source identity values "
                            "must be positive."
                        ),
                    },
                )

        return ":".join(
            f"{field_name}:{value}"
            for field_name, value in components.items()
        )

    @staticmethod
    def _calculate_result(
        current_reputation: Decimal,
        configured_change: Decimal,
        vouch_cap: Decimal,
        is_penalty: bool,
        use_vouch_cap: bool,
    ) -> Decimal:
        if is_penalty:
            return max(
                ZERO,
                current_reputation - configured_change,
            )

        if use_vouch_cap:
            if current_reputation >= vouch_cap:
                return current_reputation

            return min(
                vouch_cap,
                current_reputation + configured_change,
            )

        return min(
            ONE,
            current_reputation + configured_change,
        )

    @staticmethod
    def _validate_existing_event(
        existing_event: ReputationEvent,
        user: User,
        event_type: str,
        source_type: str,
        source_key: str,
    ) -> None:
        if (
            existing_event.USER_ID_id != user.USER_ID
            or existing_event.REVT_EVENT_TYPE != event_type
            or existing_event.REVT_SOURCE_TYPE != source_type
            or existing_event.REVT_SOURCE_KEY != source_key
        ):
            raise ValidationError(
                "This reputation event source has already been used.",
            )
