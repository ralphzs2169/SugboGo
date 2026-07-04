from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_dashboard_data, name="get_dashboard_data"),
]