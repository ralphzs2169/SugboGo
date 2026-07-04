from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_user_management_data, name="get_user_management_data"),
]