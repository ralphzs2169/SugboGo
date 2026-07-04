from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["POST"])
def suspicious_activity(request):
    return Response({
        "message": "Suspicious Activity endpoint"
    })
