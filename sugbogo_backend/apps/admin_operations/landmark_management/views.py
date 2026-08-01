from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.authentication.permissions import HasRole
from apps.users.models import User


@api_view(["GET"])
@permission_classes([IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)])
def get_landmark_management_data(request):
    return Response({
        "message": "Get Landmark Management Data endpoint"
    })