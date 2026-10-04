from django.urls import path

from apps.notifications.views.notification_views import (
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    NotificationUnreadCountView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("unread-count/", NotificationUnreadCountView.as_view(), name="notification-unread-count"),
    path("read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
    path("<int:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
]

