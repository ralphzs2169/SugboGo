"""
ASGI config for sugbogo_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_application = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.conf import settings

from apps.notifications.routing import websocket_urlpatterns
from apps.notifications.websocket_security import NotificationOriginValidator

application = ProtocolTypeRouter({
    "http": django_application,
    "websocket": NotificationOriginValidator(
        URLRouter(websocket_urlpatterns),
        settings.NOTIFICATION_WS_ALLOWED_ORIGINS,
    ),
})
