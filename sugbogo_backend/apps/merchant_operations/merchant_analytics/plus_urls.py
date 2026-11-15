"""Merchant Plus demo endpoints kept separate from analytics query routes."""

from django.urls import path

from .views.mock_plus_views import MerchantPlusStatusView, MockPlusActivationView, MockPlusResetView
from .views.plus_checkout_views import MerchantPlusCheckoutView
from .views.plus_reconciliation_views import MerchantPlusReconciliationView


urlpatterns = [
    path("payment/reconcile/", MerchantPlusReconciliationView.as_view(), name="merchant-plus-payment-reconcile"),
    path("checkout/", MerchantPlusCheckoutView.as_view(), name="merchant-plus-checkout"),
    path("status/", MerchantPlusStatusView.as_view(), name="merchant-plus-status"),
    path("mock-activation/", MockPlusActivationView.as_view(), name="merchant-plus-mock-activation"),
    path("mock-reset/", MockPlusResetView.as_view(), name="merchant-plus-mock-reset"),
]
