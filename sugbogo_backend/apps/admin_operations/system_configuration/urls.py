from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_system_configuration_data, name="get_system_configuration_data"),
]