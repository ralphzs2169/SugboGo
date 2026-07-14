from rest_framework.permissions import BasePermission

from apps.users.models import User

ROLE_HIERARCHY = {
    User.UserRole.EXPLORER: {User.UserRole.EXPLORER},
    User.UserRole.MERCHANT: {User.UserRole.MERCHANT},
    User.UserRole.ADMIN: {User.UserRole.ADMIN},
    User.UserRole.SUPER_ADMIN: {User.UserRole.SUPER_ADMIN, User.UserRole.ADMIN},
}

def _user_effective_roles(user) -> set:
    """Returns the set of roles this user is allowed to act as,
    accounting for the Super Admin -> Admin inheritance."""
    return ROLE_HIERARCHY.get(user.USER_ROLE, {user.USER_ROLE})

class HasRole(BasePermission):
    """
    Usage:
        permission_classes = [HasRole(User.UserRole.ADMIN)]

    Grants access if the authenticated, active user's effective roles
    (including inherited ones) include any of the allowed roles.
    """

    def __init__(self, *allowed_roles):
        self.allowed_roles = set(allowed_roles)

    def __call__(self):
        # DRF instantiates each item in permission_classes with no args,
        # so this makes HasRole(...) usable directly in that list.
        return self

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not user.is_active:
            return False

        return bool(_user_effective_roles(user) & self.allowed_roles)