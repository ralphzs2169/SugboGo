"""Merchant Plus status and payment endpoints."""

from django.urls import path

from .views.plus_checkout_views import MerchantPlusCheckoutView
from .views.plus_reconciliation_views import MerchantPlusReconciliationView
from .views.plus_status_views import MerchantPlusStatusView


urlpatterns = [
    path("payment/reconcile/", MerchantPlusReconciliationView.as_view(), name="merchant-plus-payment-reconcile"),
    path("checkout/", MerchantPlusCheckoutView.as_view(), name="merchant-plus-checkout"),
    path("status/", MerchantPlusStatusView.as_view(), name="merchant-plus-status"),
]
