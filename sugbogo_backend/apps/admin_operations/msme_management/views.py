from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def get_msme_management_data(request):
    return Response({
        "message": "Get MSME Management Data endpoint"
    })