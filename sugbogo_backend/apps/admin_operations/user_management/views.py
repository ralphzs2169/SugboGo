from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.authentication.permissions import HasRole
from apps.users.models import User

# Create your views here.
@api_view(["GET"])
@permission_classes([IsAuthenticated, HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)])
def get_user_management_data(request):
    return Response({
        "message": "Get User Management Data endpoint"
    })
