"""Authenticated, opt-in endpoints for the experimental itinerary contract."""

from django.conf import settings
from django.utils.cache import add_never_cache_headers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.explorer_operations.explore_businesses.serializers.experimental_itinerary_serializers import (
    ItineraryDetailSerializer,
    ItinerarySearchResultSerializer,
    ItinerarySearchSerializer,
    ItinerarySelectionSerializer,
)
from apps.explorer_operations.explore_businesses.services.experimental_itinerary_service import ExperimentalItineraryService
from apps.users.models import User
from core.responses import success_response


class ExperimentalItineraryView(APIView):
    """Apply the Explorer API permission policy when itinerary access is enabled."""

    permission_classes = (
        IsAuthenticated,
        HasRole(
            User.UserRole.EXPLORER,
            User.UserRole.MERCHANT,
        ),
    )
    throttle_classes = (UserRateThrottle, ScopedRateThrottle)

    def check_permissions(self, request):
        """Apply the feature switch before checking Explorer permissions."""
        if not settings.EXPERIMENTAL_ITINERARIES_ENABLED:
            raise NotFound()
        super().check_permissions(request)

    def finalize_response(self, request, response, *args, **kwargs):
        """Prevent intermediaries and clients from persisting selection or provider responses."""
        response = super().finalize_response(request, response, *args, **kwargs)
        add_never_cache_headers(response)
        return response


class ExperimentalItinerarySearchView(ExperimentalItineraryView):
    """Return v1 ranked preview options and short-lived selection references."""

    throttle_scope = "experimental_itinerary_search"

    def post(self, request, business_id):
        """Search from the submitted origin to the authoritative business pin."""
        serializer = ItinerarySearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = ExperimentalItineraryService.search(
            business_id=business_id,
            user_id=request.user.pk,
            **serializer.validated_data,
        )
        return success_response(
            data=ItinerarySearchResultSerializer(result).data,
            message="Experimental itineraries evaluated successfully.",
        )


class ExperimentalItineraryDetailView(ExperimentalItineraryView):
    """Open the signed v1 itinerary and reevaluate current walking evidence."""

    throttle_scope = "experimental_itinerary_detail"

    def post(self, request, business_id):
        """Reject invalid or stale selections before providing itinerary detail."""
        serializer = ItinerarySelectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = ExperimentalItineraryService.detail(
            business_id=business_id,
            user_id=request.user.pk,
            **serializer.validated_data,
        )
        return success_response(
            data=ItineraryDetailSerializer(result).data,
            message="Experimental itinerary retrieved successfully.",
        )
