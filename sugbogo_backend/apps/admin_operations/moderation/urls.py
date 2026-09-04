from django.urls import path

from apps.admin_operations.moderation.views.manage_review_dispute_views import (
    AdminReviewDisputeDetailView,
    AdminReviewDisputeDismissView,
    AdminReviewDisputeListView,
    AdminReviewDisputeUpholdView,
)

urlpatterns = [
    path("", AdminReviewDisputeListView.as_view(), name="admin-review-dispute-list"),
    path("<int:dispute_id>/", AdminReviewDisputeDetailView.as_view(), name="admin-review-dispute-detail"),
    path("<int:dispute_id>/uphold/", AdminReviewDisputeUpholdView.as_view(), name="admin-review-dispute-uphold"),
    path("<int:dispute_id>/dismiss/", AdminReviewDisputeDismissView.as_view(), name="admin-review-dispute-dismiss"),
]
