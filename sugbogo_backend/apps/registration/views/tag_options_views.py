from core.responses import success_response
from rest_framework.views import APIView

from apps.msme.serializers.specialty_tag_serializers import SpecialtyTagSerializer
from apps.msme.services.specialty_tag_service import SpecialtyTagService


class SpecialtyTagOptionsView(APIView):
    """Handle specialty tag options for registration forms."""

    def get(self, request):
        specialty_tags = SpecialtyTagService.list_specialty_tags()

        serializer = SpecialtyTagSerializer(
            specialty_tags,
            many=True,
        )

        return success_response(
            data=serializer.data,
            message="Specialty tags retrieved successfully.",
        )