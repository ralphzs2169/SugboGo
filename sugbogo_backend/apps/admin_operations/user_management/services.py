from django.db import transaction
from django.db.models import Count, Prefetch, Q, Value
from django.db.models.functions import Concat
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import (
    AdminActivityService,
)
from apps.authentication.services.session_service import SessionService
from apps.merchant_application.models import MerchantApplication
from apps.users.models import User


class UserManagementService:
    """Handles administrator-facing user queries and account transitions."""

    @staticmethod
    def list_users(
        *,
        search=None,
        role=None,
        status=None,
        ordering=None,
    ):
        """Returns the filtered and ordered administrator user list."""
        queryset = User.objects.all()

        if search:
            queryset = queryset.annotate(
                admin_full_name=Concat(
                    "USER_FNAME",
                    Value(" "),
                    "USER_LNAME",
                ),
            ).filter(
                Q(USER_EMAIL__icontains=search)
                | Q(USER_FNAME__icontains=search)
                | Q(USER_LNAME__icontains=search)
                | Q(admin_full_name__icontains=search)
            )

        if role:
            queryset = queryset.filter(
                USER_ROLE=role,
            )

        if status:
            queryset = queryset.filter(
                USER_STATUS=status,
            )

        ordering_map = {
            "name": ("USER_FNAME", "USER_LNAME"),
            "-name": ("-USER_FNAME", "-USER_LNAME"),
            "email": ("USER_EMAIL",),
            "-email": ("-USER_EMAIL",),
            "role": ("USER_ROLE",),
            "-role": ("-USER_ROLE",),
            "status": ("USER_STATUS",),
            "-status": ("-USER_STATUS",),
            "joined_at": ("USER_CREATED_AT",),
            "-joined_at": ("-USER_CREATED_AT",),
        }

        return queryset.order_by(
            *ordering_map.get(
                ordering,
                ("-USER_CREATED_AT",),
            ),
        )

    @staticmethod
    def get_user(user_id: int) -> User:
        """Retrieves one user for administrator operations."""
        try:
            return User.objects.get(
                USER_ID=user_id,
            )
        except User.DoesNotExist:
            raise NotFound(
                "The requested user could not be found.",
            ) from None

    @staticmethod
    def get_user_detail(user_id: int) -> User:
        """Retrieves one user with profile relationships and activity counts."""
        applications = (
            MerchantApplication.objects
            .select_related(
                "BUSN_ID",
            )
            .order_by(
                "-MAPP_CREATED_AT",
            )
        )

        try:
            return (
                User.objects
                .select_related(
                    "owned_business",
                )
                .prefetch_related(
                    Prefetch(
                        "merchant_applications",
                        queryset=applications,
                        to_attr="admin_merchant_applications",
                    ),
                )
                .annotate(
                    admin_review_count=Count(
                        "reviews",
                        distinct=True,
                    ),
                    admin_vouch_count=Count(
                        "business_vouches",
                        distinct=True,
                    ),
                    admin_report_count=Count(
                        "review_reports",
                        distinct=True,
                    ),
                    admin_review_dispute_count=Count(
                        "merchant_review_disputes",
                        distinct=True,
                    ),
                )
                .get(
                    USER_ID=user_id,
                )
            )
        except User.DoesNotExist:
            raise NotFound(
                "The requested user could not be found.",
            ) from None

    @staticmethod
    def _validate_actor_can_manage_user(
        *,
        actor: User,
        target_user: User,
    ) -> None:
        """Enforces the administrator-to-target role authority matrix."""
        if actor.USER_ID == target_user.USER_ID:
            raise PermissionDenied(
                "Administrators cannot change their own account status.",
            )

        allowed_target_roles = {
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        }

        if actor.USER_ROLE == User.UserRole.SUPER_ADMIN:
            allowed_target_roles.add(
                User.UserRole.ADMIN,
            )

        if target_user.USER_ROLE not in allowed_target_roles:
            raise PermissionDenied(
                "You do not have permission to change this user's account status.",
            )

    @staticmethod
    def _get_locked_user(user_id: int) -> User:
        """Locks and retrieves a target user for an account transition."""
        try:
            return (
                User.objects
                .select_for_update()
                .get(
                    USER_ID=user_id,
                )
            )
        except User.DoesNotExist:
            raise NotFound(
                "The requested user could not be found.",
            ) from None

    @staticmethod
    @transaction.atomic
    def suspend_user(
        *,
        actor: User,
        user_id: int,
        reason: str,
    ) -> User:
        """Suspends an eligible active user and revokes refresh sessions."""
        target_user = UserManagementService._get_locked_user(
            user_id,
        )

        UserManagementService._validate_actor_can_manage_user(
            actor=actor,
            target_user=target_user,
        )

        if target_user.USER_STATUS != User.UserStatus.ACTIVE:
            raise ValidationError(
                "Only active users can be suspended.",
            )

        target_user.USER_STATUS = User.UserStatus.SUSPENDED
        target_user.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        SessionService.revoke_all_sessions(
            target_user,
        )

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=target_user,
            action=AdminActivity.Action.USER_SUSPENDED,
            context={
                "reason": reason,
            },
        )

        return target_user

    @staticmethod
    @transaction.atomic
    def reactivate_user(
        *,
        actor: User,
        user_id: int,
    ) -> User:
        """Reactivates an eligible suspended user."""
        target_user = UserManagementService._get_locked_user(
            user_id,
        )

        UserManagementService._validate_actor_can_manage_user(
            actor=actor,
            target_user=target_user,
        )

        if target_user.USER_STATUS != User.UserStatus.SUSPENDED:
            raise ValidationError(
                "Only suspended users can be reactivated.",
            )

        target_user.USER_STATUS = User.UserStatus.ACTIVE
        target_user.save(
            update_fields=[
                "USER_STATUS",
                "USER_UPDATED_AT",
            ],
        )

        AdminActivityService.record_user_action(
            actor=actor,
            target_user=target_user,
            action=AdminActivity.Action.USER_REACTIVATED,
        )

        return target_user
