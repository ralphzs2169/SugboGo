from django.urls import path
from . import views

urlpatterns = [
    path("", views.msme_management, name="msme_management")
]