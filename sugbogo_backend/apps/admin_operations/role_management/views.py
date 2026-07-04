from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["POST"])
def role_management(request):
    return Response({
        "message": "Role Management endpoint"
    })