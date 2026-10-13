from django.urls import path

from .views.standard_analytics_views import StandardAnalyticsView


urlpatterns = [
    path("standard/", StandardAnalyticsView.as_view(), name="merchant-analytics-standard"),
]
