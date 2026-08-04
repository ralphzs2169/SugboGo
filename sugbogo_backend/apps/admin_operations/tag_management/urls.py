from django.urls import path

from apps.admin_operations.tag_management.views.specialty_tag_views import (
    SpecialtyTagDetailView,
    SpecialtyTagListView,
)
from apps.admin_operations.tag_management.views.tag_statistics_views import (
    SpecialtyTagStatisticsView,
)

urlpatterns = [

    path("", SpecialtyTagListView.as_view()),
    path("<int:tag_id>/", SpecialtyTagDetailView.as_view()),

    path("statistics/", SpecialtyTagStatisticsView.as_view()),
]