from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_profile_serializers import (
    BusinessCoverPhotoResponseSerializer,
    BusinessCoverPhotoSerializer,
    BusinessProfileResponseSerializer,
)
from apps.merchant_operations.business_profile.services.business_profile_service import (
    BusinessProfileService,
)
from apps.merchant_operations.business_profile.throttles import (
    BusinessCoverPhotoThrottle,
)
from apps.users.models import User


class BusinessProfileView(APIView):
    """Handle the authenticated merchant's business profile."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request):
        """Retrieve the authenticated merchant's business profile."""

        business = BusinessProfileService.get_business_for_merchant(
            request.user,
        )

        serializer = BusinessProfileResponseSerializer(
            business,
            context={"request": request},
        )

        return success_response(
            data=serializer.data,
            message="Business profile retrieved successfully.",
        )


class BusinessCoverPhotoView(APIView):
    """Handle cover photo updates for the authenticated merchant's business."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    throttle_classes = (
        BusinessCoverPhotoThrottle,
    )

    def patch(self, request):
        """Replace the merchant's current business cover photo."""

        serializer = BusinessCoverPhotoSerializer(
            data=request.data,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        business = BusinessProfileService.get_business_for_merchant(
            request.user,
        )

        business = BusinessProfileService.update_cover_photo(
            business=business,
            photo=serializer.validated_data["cover_photo"],
        )

        response_serializer = BusinessCoverPhotoResponseSerializer(
            business,
            context={"request": request},
        )

        return success_response(
            data=response_serializer.data,
            message="Business cover photo updated successfully.",
        )