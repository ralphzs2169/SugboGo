from django.urls import path 
from . import views

urlpatterns = [
    path("", views.get_tag_management_data, name="get_tag_management_data"),
]