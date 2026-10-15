"""Super Admin settings APIs using existing permissions, envelopes, and pagination."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.pagination import StandardPagination
from core.responses import success_response

from .analytics_policy_definitions import FIXED_POLICY, POLICY_FIELDS
from .analytics_policy_serializers import AnalyticsPolicyChangeSerializer, AnalyticsPolicyUpdateSerializer
from .services.analytics_policy_service import AnalyticsPolicyService


def policy_payload(snapshot):
    """Publish current values with server-owned form bounds and fixed definitions."""
    return {"version": snapshot.version, "updated_at": snapshot.updated_at.isoformat(),
            "values": dict(snapshot.values), "fixed_policy": FIXED_POLICY,
            "schema": {name: {"default": spec.default, "minimum": spec.minimum,
                              "maximum": spec.maximum, "unit": spec.unit, "label": spec.label}
                       for name, spec in POLICY_FIELDS.items()}}


class AnalyticsPolicyView(APIView):
    """Read or update interpretation policy without changing algorithm settings."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.SUPER_ADMIN))

    def get(self, request):
        """Return seeded policy and form metadata without creating configuration rows."""
        return success_response(data=policy_payload(AnalyticsPolicyService.read()), message="Analytics policy retrieved successfully.")

    def patch(self, request):
        """Apply a validated, version-checked, and audited settings change."""
        command = AnalyticsPolicyUpdateSerializer(data=request.data)
        command.is_valid(raise_exception=True)
        configuration, changed = AnalyticsPolicyService.update(actor=request.user, **command.validated_data)
        # Read this committed-in-transaction revision directly, not the request's prior consumer snapshot.
        payload = policy_payload(AnalyticsPolicyService.snapshot(configuration))
        payload["changed"] = changed
        return success_response(data=payload, message="Analytics policy updated." if changed else "Analytics policy is unchanged.")


class AnalyticsPolicyHistoryView(APIView):
    """Expose paginated immutable revision history only to active Super Admins."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.SUPER_ADMIN))

    def get(self, request):
        """Return the standard pagination envelope for newest-first audit records."""
        paginator = StandardPagination()
        page = paginator.paginate_queryset(AnalyticsPolicyService.history(), request, view=self)
        return paginator.get_paginated_response(AnalyticsPolicyChangeSerializer(page, many=True).data)
