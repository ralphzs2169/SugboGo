from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["POST"])
def tag_management(request):
    return Response({
        "message": "Tag Management endpoint"
    })
