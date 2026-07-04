from django.urls import path
from . import views

urlpatterns = [
    path("", views.system_configuration, name="system_configuration")
]