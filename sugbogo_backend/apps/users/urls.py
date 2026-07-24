from django.urls import path
from . import views


urlpatterns = [
    path("me/", views.me, name="me"),
    path("me/profile-picture/", views.profile_picture, name="profile-picture"),

    path("me/avatar-preferences/",views.update_avatar_preferences,name="avatar-preferences",),

    path("me/interests/", views.complete_interest_selection, name="complete-interest-selection"),




    # path("profile-picture/",views.update_profile_picture,name="profile-picture",),
]