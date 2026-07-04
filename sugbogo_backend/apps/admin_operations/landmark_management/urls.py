from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_landmark_management_data, name="get_landmark_management_data"),
]