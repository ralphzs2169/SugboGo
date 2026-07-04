from django.urls import path
from . import views

urlpatterns = [
    path("me/", views.me, name="me"),
    path("profile/", views.profile, name="profile")
]