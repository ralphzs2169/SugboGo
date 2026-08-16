from django.urls import path

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
)

urlpatterns = [
  
    path("", BusinessListView.as_view(), name="business-list"),
    path("map/", BusinessMapView.as_view(), name="business-map"),
    path("<int:business_id>/",BusinessDetailView.as_view(),name="business-detail"),

    path("applications/", MerchantApplicationListView.as_view(), name="merchant-application-list", ),
    path("applications/<int:application_id>/", MerchantApplicationDetailView.as_view(), name="merchant-application-detail"),
    path("applications/<int:application_id>/documents/<int:document_id>/preview/", MerchantApplicationDocumentPreviewView.as_view(),name="merchant-application-document-preview",),
    path("applications/<int:application_id>/reject/",MerchantApplicationRejectView.as_view(),name="merchant-application-reject"),
    path("applications/<int:application_id>/approve/",MerchantApplicationApproveView.as_view(),name="merchant-application-approve"),
    path('applications/statistics/', MerchantApplicationStatisticsView.as_view(), name='merchant-application-statistics'),

  
]