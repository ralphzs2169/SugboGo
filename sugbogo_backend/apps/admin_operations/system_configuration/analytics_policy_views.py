"""Expose the current analytics policy to authorized read-only clients."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.users.models import User
from core.responses import success_response

from .analytics_policy_definitions import FIXED_POLICY, POLICY_FIELDS
from .services.analytics_policy_service import AnalyticsPolicyService


def policy_payload(snapshot):
    """Publish current values with server-owned form bounds and fixed definitions."""
    return {"version": snapshot.version, "updated_at": snapshot.updated_at.isoformat(),
            "values": dict(snapshot.values), "fixed_policy": FIXED_POLICY,
            "schema": {name: {"default": spec.default, "minimum": spec.minimum,
                              "maximum": spec.maximum, "unit": spec.unit, "label": spec.label}
                       for name, spec in POLICY_FIELDS.items()}}


class AnalyticsPolicyView(APIView):
    """Read the persisted interpretation policy."""

    permission_classes = (IsAuthenticated, HasRole(User.UserRole.SUPER_ADMIN))

    def get(self, request):
        """Return seeded policy and form metadata without creating configuration rows."""
        return success_response(data=policy_payload(AnalyticsPolicyService.read()), message="Analytics policy retrieved successfully.")
