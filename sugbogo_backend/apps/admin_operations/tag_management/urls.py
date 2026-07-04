from django.urls import path 
from . import views

urlpatterns = [
    path("", views.tag_management, name="tag_management")
]