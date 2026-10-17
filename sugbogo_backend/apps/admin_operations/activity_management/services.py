from apps.admin_operations.activity_management.models import AdminActivity
from apps.users.models import User


class AdminActivityService:
    """Creates and queries administrative and moderation history involving users."""

    @staticmethod
    def record_user_action(
        *,
        actor: User,
        target_user: User,
        action: str,
        context: dict | None = None,
    ) -> AdminActivity:
        """Persist an audited action with the actual acting user and target."""
        return AdminActivity.objects.create(
            ACTOR_ID=actor,
            TARGET_USER_ID=target_user,
            AACT_ACTION=action,
            AACT_CONTEXT=context or {},
        )

    @staticmethod
    def list_for_user(user: User):
        """Return newest-first administrative and moderation history for a user."""
        return (
            AdminActivity.objects
            .filter(
                TARGET_USER_ID=user,
            )
            .select_related(
                "ACTOR_ID",
            )
            .order_by(
                "-AACT_CREATED_AT",
                "-AACT_ID",
            )
        )
