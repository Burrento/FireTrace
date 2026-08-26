"""The one place the dashboard finds out that something changed.

Every view that mutates a record calls ``broadcast_dashboard_event``; this
module turns those calls into a WebSocket push to the BFP dashboard group,
which ``realtime.consumers.DashboardConsumer`` relays to each connected
operator. The frontend treats a push as "refetch now" rather than as data, so
the REST endpoints remain the only thing that reads the database.

The channel layer is configured in ``settings.CHANNEL_LAYERS``. In development
that is the in-process in-memory layer, which needs no Redis but only reaches
clients attached to the same process -- fine for ``runserver``, not for a
multi-worker deployment. See the note in settings.py for the Redis swap.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

DASHBOARD_GROUP = 'bfp-dashboard'


def broadcast_dashboard_event(event_type, payload=None):
    """Announce a dashboard-relevant change.

    ``event_type`` is a dotted string such as ``report.created``. Callers must
    treat this as fire-and-forget: it must never raise, because a failure to
    notify is not a reason to fail the write that triggered it.
    """
    logger.debug('dashboard event %s %s', event_type, payload or {})

    try:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(
            DASHBOARD_GROUP,
            {'type': 'dashboard.event', 'event': event_type, 'payload': payload or {}},
        )
    except Exception:
        # Fire-and-forget, as the docstring above promises: a dashboard that
        # missed a nudge still catches up on its next poll, but a report that
        # failed to save because the socket layer hiccuped is data lost.
        logger.exception('failed to broadcast dashboard event %s', event_type)
