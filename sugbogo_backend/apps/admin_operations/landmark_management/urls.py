from django.urls import path
from . import views

urlpatterns = [
    path("", views.landmark_management, name="landmark_management")
]