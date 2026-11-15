"""Read-only Admin payment directory and inspection routes."""

from django.urls import path

from .views.payment_inspection_views import (
    AdminPaymentDetailView,
    AdminPaymentListView,
    AdminPaymentSummaryView,
)


urlpatterns = [
    path("", AdminPaymentListView.as_view(), name="admin-payment-list"),
    path("summary/", AdminPaymentSummaryView.as_view(), name="admin-payment-summary"),
    path("<int:payment_id>/", AdminPaymentDetailView.as_view(), name="admin-payment-detail"),
]
