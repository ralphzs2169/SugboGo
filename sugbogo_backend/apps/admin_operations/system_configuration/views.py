from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.authentication.permissions import HasRole
from apps.users.models import User

@api_view(["GET"])
@permission_classes([IsAuthenticated, HasRole(User.UserRole.SUPER_ADMIN)])
def get_system_configuration_data(request):
    return Response({
        "message": "Get System Configuration Data endpoint"
    })