from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import HasRole
from apps.users.models import User
from apps.users.serializers import UserSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(["GET"])
def profile(request):
    return Response({
        "message": "Profile endpoint"
    })

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def complete_interest_selection(request):

    user = request.user

    user.HAS_COMPLETED_INTEREST_SELECTION = True
    user.save()

    return Response({
        "message": "Interest selection completed."
    })