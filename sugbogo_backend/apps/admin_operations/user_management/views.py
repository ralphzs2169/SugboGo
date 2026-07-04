from rest_framework.decorators import api_view
from rest_framework.response import Response

# Create your views here.
@api_view(["POST"])
def user_management(request):
    return Response({
        "message": "User Management endpoint"
    })
