from django.urls import path

from apps.users.views.interest_views import UserInterestsView
from apps.users.views.profile_views import (
    AvatarPreferencesView,
    ProfilePictureView,
    UserProfileView,
)

urlpatterns = [
    path(
        "me/",
        UserProfileView.as_view(),
        name="me",
    ),
    path(
        "me/profile-picture/",
        ProfilePictureView.as_view(),
        name="profile-picture",
    ),
    path(
        "me/avatar-preferences/",
        AvatarPreferencesView.as_view(),
        name="avatar-preferences",
    ),
    path(
        "me/interests/",
        UserInterestsView.as_view(),
        name="user-interests",
    ),
]