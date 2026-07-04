from django.urls import path
from . import views

urlpatterns = [
    path("", views.suspicious_activity, name="suspicious_activity")
]