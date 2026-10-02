from django.urls import path

from apps.merchant_operations.business_profile.views.business_name_change_views import (
    MerchantBusinessNameChangeCreateView,
    MerchantBusinessNameChangeDetailView,
    MerchantBusinessNameChangeListView,
    MerchantBusinessNameChangeWithdrawView,
)

from apps.merchant_operations.business_profile.views.business_profile_views import (
    BusinessCoverPhotoView,
    BusinessInformationView,
    BusinessOperatingHoursView,
    BusinessPhotosView,
    BusinessProfileView,
)

urlpatterns = [
    path(
        "update-requests/",
        MerchantBusinessNameChangeListView.as_view(),
        name="business-name-change-list",
    ),
    path(
        "update-requests/business-name/",
        MerchantBusinessNameChangeCreateView.as_view(),
        name="business-name-change-create",
    ),
    path(
        "update-requests/<int:request_id>/",
        MerchantBusinessNameChangeDetailView.as_view(),
        name="business-name-change-detail",
    ),
    path(
        "update-requests/<int:request_id>/withdraw/",
        MerchantBusinessNameChangeWithdrawView.as_view(),
        name="business-name-change-withdraw",
    ),
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
    path(
        "photos/",
        BusinessPhotosView.as_view(),
        name="business-photos",
    ),
]
