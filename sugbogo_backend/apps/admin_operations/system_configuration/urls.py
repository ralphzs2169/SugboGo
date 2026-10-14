from django.urls import path
from . import views
from .analytics_policy_views import AnalyticsPolicyHistoryView, AnalyticsPolicyView

urlpatterns = [
    path("analytics-policy/", AnalyticsPolicyView.as_view(), name="analytics-policy"),
    path("analytics-policy/history/", AnalyticsPolicyHistoryView.as_view(), name="analytics-policy-history"),
    path("", views.get_system_configuration_data, name="get_system_configuration_data"),
]
