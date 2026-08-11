from django.urls import path

from apps.admin_operations.business_management.views.business_views import (
    BusinessVerifyView,
)
from apps.admin_operations.business_management.views.manage_application_views import (
    MerchantApplicationApproveView,
    MerchantApplicationDetailView,
    MerchantApplicationListView,
    MerchantApplicationRejectView,
    MerchantApplicationStatisticsView,
)

urlpatterns = [
 
    path("applications/", MerchantApplicationListView.as_view(), name="merchant-application-list", ),
    path("applications/<int:application_id>/", MerchantApplicationDetailView.as_view(), name="merchant-application-detail"),
    path('<int:BUSN_ID>/verify/', BusinessVerifyView.as_view(), name='business-verify'),
    path('applications/statistics/', MerchantApplicationStatisticsView.as_view(), name='merchant-application-statistics'),
    path("applications/<int:application_id>/reject/",MerchantApplicationRejectView.as_view(),name="merchant-application-reject"),
    path("applications/<int:application_id>/approve/",MerchantApplicationApproveView.as_view(),name="merchant-application-approve"),
]