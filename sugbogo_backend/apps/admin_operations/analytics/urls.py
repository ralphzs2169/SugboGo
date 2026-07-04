from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_analytics_data, name="get_analytics_data")
]