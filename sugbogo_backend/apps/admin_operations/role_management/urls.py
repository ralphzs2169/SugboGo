from django.urls import path
from . import views

urlpatterns = [
    path("", views.role_management, name="role_management")
]