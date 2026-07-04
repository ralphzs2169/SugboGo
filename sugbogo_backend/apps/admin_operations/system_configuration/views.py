from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["POST"])
def system_configuration(request):
    return Response({
        "message": "System Configuration endpoint"
    })