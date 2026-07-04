from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_role_management_data, name="get_role_management_data"),
]