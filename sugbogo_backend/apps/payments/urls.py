"""Routes for server-to-server payment notifications."""

from django.urls import path

from .views.maya_webhook import MayaSandboxWebhookView


urlpatterns = [
    path("webhooks/maya/test/", MayaSandboxWebhookView.as_view(), name="maya-sandbox-webhook"),
]
