"""
ASGI config for FireTrace project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'FireTrace.settings')

# Resolved before the routing import below, because importing a consumer pulls
# in the models it queries and those need the app registry populated.
django_asgi_application = get_asgi_application()

from realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_application,
    # CORS does not apply to WebSockets, so the browser will happily open one
    # from any origin. This is the equivalent check: the socket's Origin must
    # be a host Django already trusts, which in DEBUG includes this machine's
    # LAN address for phone testing.
    'websocket': AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
})
