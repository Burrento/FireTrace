"""Read-only dashboard aggregates.

Everything here is descriptive: counts of what has happened and how long
things took. There is deliberately no forecasting, no risk scoring, and no
automated resource allocation -- those are out of scope for FireTrace, and the
absence is a design decision rather than an omission.
"""

import time

from django.conf import settings
from django.db import connection
from django.db.models import Avg, F
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBFPPersonnel
from incidents.models import (
    DuplicateStatus,
    Incident,
    IncidentReport,
    IncidentTimelineEvent,
    WorkflowStatus,
)

from .models import AuditLog


class DashboardKPIView(APIView):
    """The five summary cards along the top of the dashboard.

    The cards intentionally read from both record types: intake pressure is
    measured in *reports*, while operational load is measured in canonical
    *incidents*. Each card declares its own ``scope`` so the UI can label which
    kind of record it is counting and the two are never silently conflated.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        today = timezone.localdate()
        reports = IncidentReport.objects.all()
        incidents = Incident.objects.all()

        new_reports = reports.filter(workflow_status=WorkflowStatus.SUBMITTED)
        under_review = reports.filter(workflow_status=WorkflowStatus.UNDER_REVIEW)
        # The card counts what is still awaiting a human ruling. Reports already
        # dispositioned (kept separate / confirmed) are reported alongside it
        # rather than in the headline number.
        pending_duplicates = reports.filter(duplicate_status=DuplicateStatus.POSSIBLE)
        responding = incidents.filter(workflow_status=WorkflowStatus.RESPONDING)
        resolved = incidents.filter(workflow_status=WorkflowStatus.RESOLVED)

        cards = [
            {
                'key': 'new_reports',
                'label': 'New Reports',
                'value': new_reports.count(),
                'scope': 'reports',
                'detail': f"{reports.filter(created_at__date=today).count()} today",
            },
            {
                'key': 'under_review',
                'label': 'Under Review',
                'value': under_review.count(),
                'scope': 'reports',
                'detail': 'awaiting verification',
            },
            {
                'key': 'duplicates',
                'label': 'Duplicates',
                'value': pending_duplicates.count(),
                'scope': 'reports',
                'detail': (
                    f"{reports.filter(duplicate_status=DuplicateStatus.CONFIRMED).count()} confirmed, "
                    f"{reports.filter(duplicate_status=DuplicateStatus.KEPT_SEPARATE).count()} kept separate"
                ),
            },
            {
                'key': 'responding',
                'label': 'Responding',
                'value': responding.count(),
                'scope': 'incidents',
                'detail': 'units dispatched',
            },
            {
                'key': 'resolved',
                'label': 'Resolved',
                'value': resolved.count(),
                'scope': 'incidents',
                'detail': f"{resolved.filter(resolved_at__date=today).count()} today",
            },
        ]

        # Mean verified -> dispatched interval. Descriptive only: it reports
        # what response times have been, it does not predict the next one.
        average_response = (
            incidents.filter(dispatched_at__isnull=False, verified_at__isnull=False)
            .annotate(elapsed=F('dispatched_at') - F('verified_at'))
            .aggregate(mean=Avg('elapsed'))['mean']
        )

        return Response({
            'cards': cards,
            'generated_at': timezone.now(),
            'average_dispatch_seconds': (
                int(average_response.total_seconds()) if average_response else None
            ),
        })


class RecentActivityView(APIView):
    """The Recent Activity sidebar feed.

    Merges two sources without double-counting: ``AuditLog`` carries every
    action a person took, and ``IncidentTimelineEvent`` contributes only its
    system-raised entries (those with no actor, such as a duplicate flag).
    Personnel-driven timeline events are skipped here because the audit log
    already records them.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
        except (TypeError, ValueError):
            limit = 20

        entries = [
            {
                'id': f'audit-{entry.id}',
                'source': 'audit_log',
                'action': entry.action,
                'action_display': entry.get_action_display(),
                'summary': entry.summary,
                'actor_name': entry.actor.username if entry.actor else 'System',
                'reference': entry.target_reference,
                'created_at': entry.created_at,
            }
            for entry in AuditLog.objects.select_related('actor')[:limit]
        ]

        entries += [
            {
                'id': f'timeline-{event.id}',
                'source': 'timeline_event',
                'action': event.event_type,
                'action_display': event.get_event_type_display(),
                'summary': event.description,
                'actor_name': 'System',
                'reference': event.subject_reference,
                'created_at': event.created_at,
            }
            for event in IncidentTimelineEvent.objects.filter(actor__isnull=True)
            .select_related('incident', 'report')[:limit]
        ]

        entries.sort(key=lambda item: item['created_at'], reverse=True)
        return Response(entries[:limit])


class SystemHealthView(APIView):
    """Status indicators for the right-hand sidebar.

    Each indicator declares how it was determined via ``check``: ``live`` means
    the component was actually exercised just now, ``config`` means only its
    configuration was inspected. Nothing here is a synthetic placeholder value.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        components = [
            {
                'key': 'application_server',
                'label': 'Application Server',
                # This response is itself the proof, so there is nothing to probe.
                'status': 'operational',
                'detail': 'Serving requests',
                'check': 'live',
            },
            self._database_status(),
            self._mapping_status(),
        ]

        ranking = {'operational': 0, 'degraded': 1, 'down': 2}
        overall = max(components, key=lambda c: ranking.get(c['status'], 0))['status']

        return Response({
            'components': components,
            'overall': overall,
            # Reported rather than hardcoded: the dashboard header says "Live"
            # only when its socket is actually up, and this should agree with
            # what the server is configured to do.
            'realtime_transport': self._realtime_transport(),
            'checked_at': timezone.now(),
        })

    def _realtime_transport(self):
        """'websocket' when a channel layer is configured, else 'polling'."""
        try:
            from channels.layers import get_channel_layer
        except ImportError:
            return 'polling'
        return 'websocket' if get_channel_layer() is not None else 'polling'

    def _database_status(self):
        started = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
        except Exception as exc:
            return {
                'key': 'database',
                'label': 'Database',
                'status': 'down',
                'detail': type(exc).__name__,
                'check': 'live',
            }

        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        return {
            'key': 'database',
            'label': 'Database',
            'status': 'operational' if latency_ms < 500 else 'degraded',
            'detail': f'PostgreSQL responded in {latency_ms} ms',
            'check': 'live',
        }

    def _mapping_status(self):
        # Checking the key is configured, not calling Google -- a reachability
        # probe on every dashboard refresh would burn Maps quota for no gain.
        configured = bool(getattr(settings, 'GOOGLE_MAPS_API_KEY', ''))
        return {
            'key': 'mapping_service',
            'label': 'Mapping Service',
            'status': 'operational' if configured else 'degraded',
            'detail': 'API key configured' if configured else 'No API key configured',
            'check': 'config',
        }
