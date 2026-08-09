from django.urls import path

from apps.admin_operations.business_management.views.application_views import (
    MerchantApplicationListView,
)
from apps.admin_operations.business_management.views.business_views import (
    BusinessVerifyView,
)

urlpatterns = [
 
    path("applications/", MerchantApplicationListView.as_view(), name="merchant-application-list", ),

    path('<int:BUS_ID>/verify/', BusinessVerifyView.as_view(), name='business-verify'),
]