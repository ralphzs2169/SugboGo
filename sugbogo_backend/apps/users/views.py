from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def me(request):
    return Response({
        "message": "Current user"
    })


@api_view(["GET"])
def profile(request):
    return Response({
        "message": "Profile endpoint"
    })