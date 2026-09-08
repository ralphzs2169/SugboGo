from django.urls import path

from apps.review_disputes.views.review_dispute_views import (
    MerchantReviewDisputeCreateView,
    MerchantReviewDisputeDetailView,
    MerchantReviewDisputeEvidenceDetailView,
    MerchantReviewDisputeEvidenceView,
    MerchantReviewDisputeListView,
    MerchantReviewDisputeWithdrawView,
)

urlpatterns = [
    path("", MerchantReviewDisputeListView.as_view(), name="review-dispute-list"),
    path("review/<int:review_id>/", MerchantReviewDisputeCreateView.as_view(), name="review-dispute-create"),
    path("<int:dispute_id>/", MerchantReviewDisputeDetailView.as_view(), name="review-dispute-detail"),
    path("<int:dispute_id>/evidence/", MerchantReviewDisputeEvidenceView.as_view(), name="review-dispute-evidence"),
    path("<int:dispute_id>/withdraw/", MerchantReviewDisputeWithdrawView.as_view(), name="review-dispute-withdraw"),
    path("evidence/<int:evidence_id>/", MerchantReviewDisputeEvidenceDetailView.as_view(), name="review-dispute-evidence-detail"),
]
