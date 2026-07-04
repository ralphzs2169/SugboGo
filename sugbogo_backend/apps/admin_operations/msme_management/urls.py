from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_msme_management_data, name="get_msme_management_data"),
]