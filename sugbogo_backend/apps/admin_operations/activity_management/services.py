from apps.admin_operations.activity_management.models import AdminActivity
from apps.users.models import User


class AdminActivityService:
    """Creates and queries administrative actions involving users."""

    @staticmethod
    def record_user_action(
        *,
        actor: User,
        target_user: User,
        action: str,
        context: dict | None = None,
    ) -> AdminActivity:
        """Persists one administrator action against a target user."""
        return AdminActivity.objects.create(
            ACTOR_ID=actor,
            TARGET_USER_ID=target_user,
            AACT_ACTION=action,
            AACT_CONTEXT=context or {},
        )

    @staticmethod
    def list_for_user(user: User):
        """Returns newest-first administrative history for a target user."""
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
