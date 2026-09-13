from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import HasRole
from apps.users.models import User


ADMIN_PERMISSIONS = (
    IsAuthenticated,
    HasRole(
        User.UserRole.ADMIN,
        User.UserRole.SUPER_ADMIN,
    ),
)

