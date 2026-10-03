from django.urls import path

from apps.admin_operations.business_management.views.manage_business_classification_change_views import (
    AdminBusinessClassificationChangeApproveView,
    AdminBusinessClassificationChangeDetailView,
    AdminBusinessClassificationChangeListView,
    AdminBusinessClassificationChangeRejectView,
)
from apps.admin_operations.business_management.views.manage_business_name_change_views import (
    AdminBusinessNameChangeApproveView,
    AdminBusinessNameChangeDetailView,
    AdminBusinessNameChangeListView,
    AdminBusinessNameChangeRejectView,
)
from apps.admin_operations.business_management.views.manage_business_location_change_views import (
    AdminBusinessLocationChangeApproveView,
    AdminBusinessLocationChangeDetailView,
    AdminBusinessLocationChangeListView,
    AdminBusinessLocationChangeRejectView,
)

from apps.admin_operations.business_management.views.manage_application_views import (
    MerchantApplicationApproveView,
    MerchantApplicationDetailView,
    MerchantApplicationDocumentPreviewView,
    MerchantApplicationListView,
    MerchantApplicationRejectView,
    MerchantApplicationStatisticsView,
)
from apps.admin_operations.business_management.views.manage_business_views import (
    BusinessDetailView,
    BusinessListView,
    BusinessMapView,
    BusinessReviewInsightsRefreshView,
)

urlpatterns = [
    path(
        "update-requests/location/",
        AdminBusinessLocationChangeListView.as_view(),
        name="admin-business-location-change-list",
    ),
    path(
        "update-requests/location/<int:request_id>/",
        AdminBusinessLocationChangeDetailView.as_view(),
        name="admin-business-location-change-detail",
    ),
    path(
        "update-requests/location/<int:request_id>/approve/",
        AdminBusinessLocationChangeApproveView.as_view(),
        name="admin-business-location-change-approve",
    ),
    path(
        "update-requests/location/<int:request_id>/reject/",
        AdminBusinessLocationChangeRejectView.as_view(),
        name="admin-business-location-change-reject",
    ),
    path(
        "update-requests/classification/",
        AdminBusinessClassificationChangeListView.as_view(),
        name="admin-business-classification-change-list",
    ),
    path(
        "update-requests/classification/<int:request_id>/",
        AdminBusinessClassificationChangeDetailView.as_view(),
        name="admin-business-classification-change-detail",
    ),
    path(
        "update-requests/classification/<int:request_id>/approve/",
        AdminBusinessClassificationChangeApproveView.as_view(),
        name="admin-business-classification-change-approve",
    ),
    path(
        "update-requests/classification/<int:request_id>/reject/",
        AdminBusinessClassificationChangeRejectView.as_view(),
        name="admin-business-classification-change-reject",
    ),
    path(
        "update-requests/",
        AdminBusinessNameChangeListView.as_view(),
        name="admin-business-name-change-list",
    ),
    path(
        "update-requests/<int:request_id>/",
        AdminBusinessNameChangeDetailView.as_view(),
        name="admin-business-name-change-detail",
    ),
    path(
        "update-requests/<int:request_id>/approve/",
        AdminBusinessNameChangeApproveView.as_view(),
        name="admin-business-name-change-approve",
    ),
    path(
        "update-requests/<int:request_id>/reject/",
        AdminBusinessNameChangeRejectView.as_view(),
        name="admin-business-name-change-reject",
    ),
  
    path("", BusinessListView.as_view(), name="business-list"),
    path("map/", BusinessMapView.as_view(), name="business-map"),
    path("<int:business_id>/",BusinessDetailView.as_view(),name="business-detail"),
    path(
        "<int:business_id>/review-insights/refresh/",
        BusinessReviewInsightsRefreshView.as_view(),
        name="business-review-insights-refresh",
    ),

    path("applications/", MerchantApplicationListView.as_view(), name="merchant-application-list", ),
    path("applications/<int:application_id>/", MerchantApplicationDetailView.as_view(), name="merchant-application-detail"),
    path("applications/<int:application_id>/documents/<int:document_id>/preview/", MerchantApplicationDocumentPreviewView.as_view(),name="merchant-application-document-preview",),
    path("applications/<int:application_id>/reject/",MerchantApplicationRejectView.as_view(),name="merchant-application-reject"),
    path("applications/<int:application_id>/approve/",MerchantApplicationApproveView.as_view(),name="merchant-application-approve"),
    path('applications/statistics/', MerchantApplicationStatisticsView.as_view(), name='merchant-application-statistics'),

  
]
