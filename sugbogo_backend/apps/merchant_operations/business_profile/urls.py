from django.urls import path

from apps.merchant_operations.business_profile.views.business_classification_change_views import (
    MerchantBusinessClassificationChangeDetailView,
    MerchantBusinessClassificationChangeListCreateView,
    MerchantBusinessClassificationChangeWithdrawView,
)
from apps.merchant_operations.business_profile.views.business_change_pending_status_views import (
    MerchantBusinessChangePendingStatusView,
)
from apps.merchant_operations.business_profile.views.business_name_change_views import (
    MerchantBusinessNameChangeCreateView,
    MerchantBusinessNameChangeDetailView,
    MerchantBusinessNameChangeListView,
    MerchantBusinessNameChangeWithdrawView,
)
from apps.merchant_operations.business_profile.views.business_location_change_views import (
    MerchantBusinessLocationChangeDetailView,
    MerchantBusinessLocationChangeListCreateView,
    MerchantBusinessLocationChangeWithdrawView,
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
        "update-requests/pending-status/",
        MerchantBusinessChangePendingStatusView.as_view(),
        name="business-change-pending-status",
    ),
    path(
        "update-requests/location/",
        MerchantBusinessLocationChangeListCreateView.as_view(),
        name="business-location-change-list-create",
    ),
    path(
        "update-requests/location/<int:request_id>/",
        MerchantBusinessLocationChangeDetailView.as_view(),
        name="business-location-change-detail",
    ),
    path(
        "update-requests/location/<int:request_id>/withdraw/",
        MerchantBusinessLocationChangeWithdrawView.as_view(),
        name="business-location-change-withdraw",
    ),
    path(
        "update-requests/classification/",
        MerchantBusinessClassificationChangeListCreateView.as_view(),
        name="business-classification-change-list-create",
    ),
    path(
        "update-requests/classification/<int:request_id>/",
        MerchantBusinessClassificationChangeDetailView.as_view(),
        name="business-classification-change-detail",
    ),
    path(
        "update-requests/classification/<int:request_id>/withdraw/",
        MerchantBusinessClassificationChangeWithdrawView.as_view(),
        name="business-classification-change-withdraw",
    ),
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
