from core.responses import success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.merchant_operations.business_profile.serializers.business_profile_serializers import (
    BusinessCoverPhotoResponseSerializer,
    BusinessCoverPhotoSerializer,
    BusinessInformationSerializer,
    BusinessOperatingHoursUpdateSerializer,
    BusinessPhotosUpdateSerializer,
    BusinessProfileResponseSerializer,
    MerchantBusinessHoursSerializer,
    MerchantBusinessPhotoSerializer,
)
from apps.merchant_operations.business_profile.services.business_photo_service import (
    BusinessPhotoService,
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


class BusinessInformationView(APIView):
    """Update basic information on the authenticated merchant's business."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def patch(self, request):
        business = BusinessProfileService.get_business_for_merchant(
            request.user,
        )

        serializer = BusinessInformationSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(
            raise_exception=True,
        )

        business = BusinessProfileService.update_information(
            business=business,
            validated_data=serializer.validated_data,
        )

        return success_response(
            data=BusinessInformationSerializer(business).data,
            message="Business information updated successfully.",
        )


class BusinessOperatingHoursView(APIView):
    """Replace the authenticated merchant's approved weekly schedule."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def put(self, request):
        """Validate and persist all seven days in one operation."""

        serializer = BusinessOperatingHoursUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hours = BusinessProfileService.update_operating_hours(
            user=request.user,
            hours=serializer.validated_data["hours"],
        )

        return success_response(
            data=MerchantBusinessHoursSerializer(hours, many=True).data,
            message="Operating hours updated successfully.",
        )


class BusinessPhotosView(APIView):
    """Save additions and removals to the authenticated business gallery."""

    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )
    parser_classes = (MultiPartParser, FormParser)

    def patch(self, request):
        serializer = BusinessPhotosUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        photos = BusinessPhotoService.save_photos(
            user=request.user,
            validated_data=serializer.validated_data,
        )

        return success_response(
            data=MerchantBusinessPhotoSerializer(photos, many=True).data,
            message="Business photos updated successfully.",
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
