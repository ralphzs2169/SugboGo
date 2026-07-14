from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.authentication.permissions import HasRole
from apps.users.models import User


@api_view(["GET"])
@permission_classes([HasRole(User.UserRole.ADMIN)])
def me(request):
    user = request.user
    return Response({
        "id": user.USER_ID,
        "email": user.USER_EMAIL,
        "role": user.USER_ROLE,
        "status": user.USER_STATUS,
    })


@api_view(["GET"])
def profile(request):
    return Response({
        "message": "Profile endpoint"
    })