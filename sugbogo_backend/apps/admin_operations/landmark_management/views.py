from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def get_landmark_management_data(request):
    return Response({
        "message": "Get Landmark Management Data endpoint"
    })