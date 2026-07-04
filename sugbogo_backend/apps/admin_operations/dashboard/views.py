from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def get_dashboard_data(request):
    return Response({
        "message": "Get Dashboard Data endpoint"
    })