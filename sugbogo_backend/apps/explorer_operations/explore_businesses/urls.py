from apps.explorer_operations.explore_businesses.views.business_detail_views import (
    BusinessDetailView,
)
from apps.explorer_operations.explore_businesses.views.new_businesses_views import (
    NewBusinessesView,
)
from django.urls import path

urlpatterns = [

    path("businesses/<int:business_id>/", BusinessDetailView.as_view(), name="business-detail", ),
    
    path("new-businesses/", NewBusinessesView.as_view(), name="new-businesses", ),
]