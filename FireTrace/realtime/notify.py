"""The one place the dashboard finds out that something changed.

Right now the dashboard polls, so this is a no-op that only logs. It exists so
that turning on Django Channels later is a change to *this file* and nothing
else: every view that mutates a record already calls
``broadcast_dashboard_event``.

To switch to WebSockets:

1. ``pipenv install channels channels-redis daphne`` and add ``channels`` to
   ``INSTALLED_APPS``.
2. Point ``ASGI_APPLICATION`` at a ``ProtocolTypeRouter`` and set
   ``CHANNEL_LAYERS`` to the Redis backend.
3. Replace the body of ``broadcast_dashboard_event`` with a
   ``group_send`` to the ``DASHBOARD_GROUP`` group.
4. Swap the frontend's polling hook for a WebSocket subscription.

No call site has to change.
"""

import logging

logger = logging.getLogger(__name__)

DASHBOARD_GROUP = 'bfp-dashboard'


def broadcast_dashboard_event(event_type, payload=None):
    """Announce a dashboard-relevant change.

    ``event_type`` is a dotted string such as ``report.created``. Callers must
    treat this as fire-and-forget: it must never raise, because a failure to
    notify is not a reason to fail the write that triggered it.
    """
    logger.debug('dashboard event %s %s', event_type, payload or {})

    # Channels implementation, for step 3 above:
    #
    # from asgiref.sync import async_to_sync
    # from channels.layers import get_channel_layer
    #
    # layer = get_channel_layer()
    # if layer is None:
    #     return
    # async_to_sync(layer.group_send)(
    #     DASHBOARD_GROUP,
    #     {'type': 'dashboard.event', 'event': event_type, 'payload': payload or {}},
    # )
