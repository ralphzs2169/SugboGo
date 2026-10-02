from django.urls import path

from apps.merchant_operations.business_profile.views.business_profile_views import (
    BusinessCoverPhotoView,
    BusinessInformationView,
    BusinessOperatingHoursView,
    BusinessProfileView,
)

urlpatterns = [
    path("", BusinessProfileView.as_view(), name="business-profile", ),
    path(
        "information/",
        BusinessInformationView.as_view(),
        name="business-information",
    ),
    path("cover-photo/", BusinessCoverPhotoView.as_view(), name="business-cover-photo",),
    path(
        "operating-hours/",
        BusinessOperatingHoursView.as_view(),
        name="business-operating-hours",
    ),
]
