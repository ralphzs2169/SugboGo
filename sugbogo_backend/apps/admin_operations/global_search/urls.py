from django.urls import path

from .views import GlobalSearchView


urlpatterns = [
    path(
        "",
        GlobalSearchView.as_view(),
        name="admin-global-search",
    ),
]
