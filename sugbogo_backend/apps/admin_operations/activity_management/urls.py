from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_activity_management_data, name="get_activity_management_data"),
]