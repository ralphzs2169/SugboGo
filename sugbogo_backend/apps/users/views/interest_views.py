from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.users.serializers.interest_serializers import (
    InterestCategorySerializer,
    InterestSpecialtyTagSerializer,
)
from apps.users.serializers.profile_serializers import (
    UserInterestsUpdateSerializer,
)
from apps.users.services.interest_service import UserInterestService


class UserInterestsView(APIView):
    """Retrieves and updates the authenticated user's interests."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Retrieves the user's selected and available interests."""
        interests = UserInterestService.get_interests(
            request.user,
        )

        return success_response(
            message="Interests retrieved successfully.",
            data=self._serialize_interests(interests),
        )

    def put(self, request):
        """Replaces the user's explicit category and specialty interests."""
        serializer = UserInterestsUpdateSerializer(
            data=request.data,
            context={
                "onboarding": False,
            },
        )
        serializer.is_valid(raise_exception=True)

        interests = UserInterestService.update_interests(
            user=request.user,
            category_ids=serializer.validated_data.get("category_ids"),
            specialty_tag_ids=serializer.validated_data.get(
                "specialty_tag_ids",
            ),
            complete_onboarding=False,
        )

        return success_response(
            message="Interests updated successfully.",
            data=self._serialize_interests(interests),
        )

    def patch(self, request):
        """Completes onboarding interest selection using specialty tags."""
        serializer = UserInterestsUpdateSerializer(
            data=request.data,
            context={
                "onboarding": True,
            },
        )
        serializer.is_valid(raise_exception=True)

        specialty_tag_ids = serializer.validated_data.get(
            "specialty_tag_ids",
        )

        if specialty_tag_ids is None:
            specialty_tag_ids = []

        interests = UserInterestService.update_interests(
            user=request.user,
            category_ids=serializer.validated_data.get("category_ids"),
            specialty_tag_ids=specialty_tag_ids,
            complete_onboarding=True,
        )

        return success_response(
            message="Interest selection completed successfully.",
            data=self._serialize_interests(interests),
        )

    @staticmethod
    def _serialize_interests(interests):
        """Serializes selected and available interests for API responses."""
        return {
            "categories": InterestCategorySerializer(
                interests["categories"],
                many=True,
            ).data,
            "specialty_tags": InterestSpecialtyTagSerializer(
                interests["specialty_tags"],
                many=True,
            ).data,
            "available_categories": InterestCategorySerializer(
                interests["available_categories"],
                many=True,
            ).data,
            "available_specialty_tags": InterestSpecialtyTagSerializer(
                interests["available_specialty_tags"],
                many=True,
            ).data,
        }