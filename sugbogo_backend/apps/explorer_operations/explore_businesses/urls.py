from apps.explorer_operations.explore_businesses.views.new_businesses_views import (
    NewBusinessesView,
)
from django.urls import path

urlpatterns = [
    path("new-businesses/", NewBusinessesView.as_view(), name="new-businesses", ),
]