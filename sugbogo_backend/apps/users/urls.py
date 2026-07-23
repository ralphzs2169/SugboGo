from django.urls import path
from . import views


urlpatterns = [
    path("me/", views.me, name="me"),
    path("me/profile-picture/", views.update_profile_picture, name="profile-picture"),
    path("me/interests/", views.has_completed_interest_selection, name="complete-interest-selection"),
    # path("profile-picture/",views.update_profile_picture,name="profile-picture",),
]