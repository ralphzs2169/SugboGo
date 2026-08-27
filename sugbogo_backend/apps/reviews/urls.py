from django.urls import path

from apps.reviews.views.review_like_views import ReviewLikeView
from apps.reviews.views.review_reply_views import (
    ReplyPhotoView,
    ReviewReplyDetailView,
    ReviewReplyView,
)
from apps.reviews.views.review_report_views import ReviewReportView
from apps.reviews.views.review_views import (
    ReviewDetailView,
    ReviewListView,
    ReviewPhotoView,
    ReviewView,
)

urlpatterns = [
    path("business/<int:business_id>/", ReviewView.as_view(), name="review-preview"),
    path("business/<int:business_id>/all/", ReviewListView.as_view(), name="review-list"),

    path("<int:review_id>/like/", ReviewLikeView.as_view(), name="review-like"),
    path("<int:review_id>/report/", ReviewReportView.as_view(), name="review-report"),
    path("<int:review_id>/reply/", ReviewReplyView.as_view(), name="review-reply"),
    path("<int:review_id>/", ReviewDetailView.as_view(), name="review-detail"),

    path("photos/<int:photo_id>/", ReviewPhotoView.as_view(), name="review-photo"),
    path("replies/<int:reply_id>/", ReviewReplyDetailView.as_view(), name="review-reply-detail"),
    
    path("reply-photos/<int:photo_id>/", ReplyPhotoView.as_view(), name="reply-photo"),
]