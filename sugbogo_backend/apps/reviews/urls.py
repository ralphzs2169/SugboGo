from django.urls import path

from apps.reviews.views.review_reply_views import ReviewReplyView
from apps.reviews.views.review_views import (
    ReviewLikeView,
    ReviewReportView,
    ReviewView,
)

urlpatterns = [
    path("business/<int:business_id>/", ReviewView.as_view(), name="review-create",),
    path("<int:review_id>/like/", ReviewLikeView.as_view(), name="review-like",),
    path("<int:review_id>/report/",ReviewReportView.as_view(),name="review-report",),
    path("<int:review_id>/reply/",ReviewReplyView.as_view(),name="review-reply",),
]