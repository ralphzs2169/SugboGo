"""Merchant Plus demo endpoints kept separate from analytics query routes."""

from django.urls import path

from .views.mock_plus_views import MerchantPlusStatusView, MockPlusActivationView, MockPlusResetView


urlpatterns = [
    path("status/", MerchantPlusStatusView.as_view(), name="merchant-plus-status"),
    path("mock-activation/", MockPlusActivationView.as_view(), name="merchant-plus-mock-activation"),
    path("mock-reset/", MockPlusResetView.as_view(), name="merchant-plus-mock-reset"),
]
