"""The dashboard's WebSocket end of ``notify.broadcast_dashboard_event``.

The consumer carries *no* incident data. It sends a bare "something changed"
nudge and the browser refetches through the existing REST endpoints, so read
scoping, permissions and serialisation stay in exactly one place instead of
being reimplemented for the socket. The win is latency, not a second API.
"""

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from .notify import DASHBOARD_GROUP

logger = logging.getLogger(__name__)

# Close codes. 4401/4403 mirror HTTP 401/403 in the application range, so the
# frontend can tell "log in again" apart from "you are not BFP personnel".
CLOSE_UNAUTHENTICATED = 4401
CLOSE_FORBIDDEN = 4403


@database_sync_to_async
def _bfp_user_from_token(raw_token):
    """Resolve an access token to a BFP user, or None."""
    try:
        token = AccessToken(raw_token)
    except TokenError:
        return None

    user = User.objects.filter(pk=token.get('user_id')).first()
    if user is None or not user.is_active:
        return None
    return user if user.user_type == User.UserType.BFP else False


class DashboardConsumer(AsyncJsonWebsocketConsumer):
    """Pushes dashboard change events to authenticated BFP personnel.

    Authentication is the first message on the socket rather than a query
    parameter, deliberately: a token in the URL ends up in server logs, browser
    history and any proxy in between. Nothing is joined to the broadcast group
    until that message checks out, so an unauthenticated socket receives
    nothing even though the connection was accepted.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.subscribed = False

    async def connect(self):
        await self.accept()

    async def disconnect(self, code):
        if self.subscribed:
            await self.channel_layer.group_discard(DASHBOARD_GROUP, self.channel_name)
            self.subscribed = False

    async def receive_json(self, content, **kwargs):
        if content.get('type') != 'auth' or self.subscribed:
            return

        user = await _bfp_user_from_token(content.get('token') or '')
        if user is None:
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return
        if user is False:
            await self.close(code=CLOSE_FORBIDDEN)
            return

        await self.channel_layer.group_add(DASHBOARD_GROUP, self.channel_name)
        self.subscribed = True
        await self.send_json({'type': 'ready'})

    async def dashboard_event(self, message):
        """Handler for ``group_send`` messages of type ``dashboard.event``."""
        await self.send_json({
            'type': 'event',
            'event': message.get('event'),
            'payload': message.get('payload') or {},
        })
