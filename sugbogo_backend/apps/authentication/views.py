from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["POST"])
def login_view(request):
    return Response({
        "message": "Login endpoint"
    })


@api_view(["POST"])
def register_view(request):
    return Response({
        "message": "Register endpoint"
    })


@api_view(["POST"])
def logout_view(request):
    return Response({
        "message": "Logout endpoint"
    })