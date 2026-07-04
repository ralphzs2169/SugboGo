from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_suspicious_activity_data, name="get_suspicious_activity_data"),
]