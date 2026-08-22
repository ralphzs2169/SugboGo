from django.urls import path

from apps.merchant_operations.business_profile.views.business_profile_views import (
    BusinessCoverPhotoView,
)

urlpatterns = [
    path("cover-photo/", BusinessCoverPhotoView.as_view(), name="business-cover-photo",),
]