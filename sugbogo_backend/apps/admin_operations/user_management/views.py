from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.admin_operations.activity_management.serializers import (
    AdminActivitySerializer,
)
from apps.admin_operations.activity_management.services import (
    AdminActivityService,
)
from apps.admin_operations.user_management.activity_service import (
    UserActivityService,
)
from apps.admin_operations.user_management.serializers import (
    AdminUserActivityQuerySerializer,
    AdminUserActivitySerializer,
    AdminUserDetailSerializer,
    AdminUserListQuerySerializer,
    AdminUserListSerializer,
    AdminUserSuspendSerializer,
)
from apps.admin_operations.user_management.services import (
    UserManagementService,
)
from apps.authentication.permissions import HasRole
from apps.users.models import User


ADMIN_USER_PERMISSIONS = (
    IsAuthenticated,
    HasRole(
        User.UserRole.ADMIN,
        User.UserRole.SUPER_ADMIN,
    ),
)


class AdminUserListView(APIView):
    """Handles administrator user listing and filtering."""

    permission_classes = ADMIN_USER_PERMISSIONS

    def get(self, request):
        """Returns a paginated list of users."""
        query_serializer = AdminUserListQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        users = UserManagementService.list_users(
            **query_serializer.validated_data,
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            users,
            request,
        )

        serializer = AdminUserListSerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )


class AdminUserDetailView(APIView):
    """Handles administrator viewing of a user profile."""

    permission_classes = ADMIN_USER_PERMISSIONS

    def get(self, request, user_id):
        """Returns one administrator-facing user profile."""
        user = UserManagementService.get_user_detail(
            user_id,
        )

        return success_response(
            data=AdminUserDetailSerializer(user).data,
            message="User retrieved successfully.",
        )


class AdminUserSuspendView(APIView):
    """Handles administrator suspension of eligible users."""

    permission_classes = ADMIN_USER_PERMISSIONS

    def post(self, request, user_id):
        """Suspends an active user for the validated reason."""
        serializer = AdminUserSuspendSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        user = UserManagementService.suspend_user(
            actor=request.user,
            user_id=user_id,
            reason=serializer.validated_data["reason"],
        )

        return success_response(
            data={
                "id": user.USER_ID,
                "status": user.USER_STATUS,
            },
            message="User suspended successfully.",
        )


class AdminUserReactivateView(APIView):
    """Handles administrator reactivation of eligible users."""

    permission_classes = ADMIN_USER_PERMISSIONS

    def post(self, request, user_id):
        """Reactivates a suspended user."""
        user = UserManagementService.reactivate_user(
            actor=request.user,
            user_id=user_id,
        )

        return success_response(
            data={
                "id": user.USER_ID,
                "status": user.USER_STATUS,
            },
            message="User reactivated successfully.",
        )


class AdminUserActivityView(APIView):
    """Handles administrator viewing of recent user-generated activity."""

    permission_classes = ADMIN_USER_PERMISSIONS

    def get(self, request, user_id):
        """Returns a limited newest-first user activity feed."""
        query_serializer = AdminUserActivityQuerySerializer(
            data=request.query_params,
        )
        query_serializer.is_valid(
            raise_exception=True,
        )

        user = UserManagementService.get_user(
            user_id,
        )
        activities = UserActivityService.list_recent_activity(
            user=user,
            limit=query_serializer.validated_data["limit"],
        )

        return success_response(
            data=AdminUserActivitySerializer(
                activities,
                many=True,
            ).data,
            message="User activity retrieved successfully.",
        )


class AdminUserAdministrativeHistoryView(APIView):
    """Handles administrator viewing of actions performed on a user."""

    permission_classes = ADMIN_USER_PERMISSIONS

    def get(self, request, user_id):
        """Returns paginated newest-first administrative history."""
        user = UserManagementService.get_user(
            user_id,
        )
        history = AdminActivityService.list_for_user(
            user,
        )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(
            history,
            request,
        )

        serializer = AdminActivitySerializer(
            page,
            many=True,
        )

        return paginator.get_paginated_response(
            serializer.data,
        )
