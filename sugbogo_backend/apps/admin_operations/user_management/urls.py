from django.urls import path

from . import views

urlpatterns = [
    path(
        "",
        views.AdminUserListView.as_view(),
        name="admin-user-list",
    ),
    path(
        "<int:user_id>/",
        views.AdminUserDetailView.as_view(),
        name="admin-user-detail",
    ),
    path(
        "<int:user_id>/suspend/",
        views.AdminUserSuspendView.as_view(),
        name="admin-user-suspend",
    ),
    path(
        "<int:user_id>/reactivate/",
        views.AdminUserReactivateView.as_view(),
        name="admin-user-reactivate",
    ),
    path(
        "<int:user_id>/activity/",
        views.AdminUserActivityView.as_view(),
        name="admin-user-activity",
    ),
    path(
        "<int:user_id>/administrative-history/",
        views.AdminUserAdministrativeHistoryView.as_view(),
        name="admin-user-administrative-history",
    ),
]
