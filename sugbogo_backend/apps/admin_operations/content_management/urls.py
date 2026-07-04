from django.urls import path
from . import views

urlpatterns = [
    path("", views.content_management, name="content_management")
]