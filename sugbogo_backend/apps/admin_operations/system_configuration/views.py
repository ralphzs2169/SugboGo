from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def get_system_configuration_data(request):
    return Response({
        "message": "Get System Configuration Data endpoint"
    })