from rest_framework.decorators import api_view
from rest_framework.response import Response

# Create your views here.
@api_view(["GET"])
def get_user_management_data(request):
    return Response({
        "message": "Get User Management Data endpoint"
    })
