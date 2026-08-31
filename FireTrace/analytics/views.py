"""Read-only dashboard aggregates.

Everything here is descriptive: counts of what has happened and how long
things took. There is deliberately no forecasting, no risk scoring, and no
automated resource allocation -- those are out of scope for FireTrace, and the
absence is a design decision rather than an omission.
"""

import time
from datetime import timedelta

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import connection
from django.db.models import Avg, Count, F, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBFPPersonnel
from incidents.geocoding import derive_confidence
from incidents.models import (
    DuplicateStatus,
    GeocodingConfidence,
    Incident,
    IncidentReport,
    IncidentTimelineEvent,
    IncidentType,
    LocationSource,
    WorkflowStatus,
)

from .models import AuditLog, SystemSetting
from .serializers import SystemSettingSerializer

# Workflow states a report only reaches once a person has acted on it.
REVIEWED_STATUSES = (
    WorkflowStatus.VERIFIED,
    WorkflowStatus.RESPONDING,
    WorkflowStatus.RESOLVED,
)


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


def _audit_row(entry):
    return {
        'id': f'audit-{entry.id}',
        'source': 'audit_log',
        'action': entry.action,
        'action_display': entry.get_action_display(),
        'summary': entry.summary,
        'actor_name': entry.actor.username if entry.actor else 'System',
        'reference': entry.target_reference,
        'created_at': entry.created_at,
    }


def _timeline_row(event):
    return {
        'id': f'timeline-{event.id}',
        'source': 'timeline_event',
        'action': event.event_type,
        'action_display': event.get_event_type_display(),
        'summary': event.description,
        'actor_name': 'System',
        'reference': event.subject_reference,
        'created_at': event.created_at,
    }


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
            _audit_row(entry)
            for entry in AuditLog.objects.select_related('actor')[:limit]
        ]

        entries += [
            _timeline_row(event)
            for event in IncidentTimelineEvent.objects.filter(actor__isnull=True)
            .select_related('incident', 'report')[:limit]
        ]

        entries.sort(key=lambda item: item['created_at'], reverse=True)
        return Response(entries[:limit])


class AuditLogView(APIView):
    """The full, filterable personnel activity trail.

    Reads the same two sources as ``RecentActivityView`` and for the same
    reason: a trail that omitted the system's own duplicate flags could not
    explain why a person was then asked to rule on one. Both sources are
    filtered in the database and merged afterwards, so a filter means the same
    thing on each.

    Paginated by offset rather than page number -- entries arrive continuously,
    and a page number would shift under the reader between requests.
    """

    permission_classes = [IsBFPPersonnel]

    MAX_LIMIT = 200

    def get(self, request):
        params = request.query_params
        limit = self._int_param(params.get('limit'), default=50, maximum=self.MAX_LIMIT)
        offset = max(self._int_param(params.get('offset'), default=0, maximum=100000), 0)
        query = (params.get('q') or '').strip()
        actor = (params.get('actor') or '').strip()
        action = (params.get('action') or '').strip()
        days = self._int_param(params.get('days'), default=0, maximum=3650)

        audit = AuditLog.objects.select_related('actor')
        # Only the system-raised half, so personnel actions are not listed twice.
        timeline = IncidentTimelineEvent.objects.filter(
            actor__isnull=True
        ).select_related('incident', 'report')

        if days:
            since = timezone.now() - timedelta(days=days)
            audit = audit.filter(created_at__gte=since)
            timeline = timeline.filter(created_at__gte=since)

        if actor:
            if actor.lower() == 'system':
                # The system is a null actor in the audit log, and is the only
                # thing the timeline half ever contributes.
                audit = audit.filter(actor__isnull=True)
            else:
                audit = audit.filter(actor__username__iexact=actor)
                timeline = timeline.none()

        if action:
            audit = audit.filter(action=action)
            timeline = timeline.filter(event_type=action)

        if query:
            audit = audit.filter(
                Q(summary__icontains=query)
                | Q(target_reference__icontains=query)
                | Q(actor__username__icontains=query)
            )
            timeline = timeline.filter(
                Q(description__icontains=query)
                | Q(incident__barangay__icontains=query)
                | Q(report__barangay__icontains=query)
            )

        count = audit.count() + timeline.count()

        # Merging two ordered sources means taking offset+limit from each before
        # the merge: the newest N overall could come entirely from either one.
        window = offset + limit
        merged = [_audit_row(entry) for entry in audit[:window]]
        merged += [_timeline_row(event) for event in timeline[:window]]
        merged.sort(key=lambda item: item['created_at'], reverse=True)

        return Response({
            'count': count,
            'limit': limit,
            'offset': offset,
            'results': merged[offset:window],
            # Offered for the filter dropdowns so the UI never lists a name that
            # has never acted, or an action that cannot occur.
            'actors': self._actors(),
            'actions': [
                {'value': value, 'label': label}
                for value, label in AuditLog.Action.choices
            ],
        })

    def _actors(self):
        names = list(
            AuditLog.objects.filter(actor__isnull=False)
            .values_list('actor__username', flat=True)
            .distinct()
            .order_by('actor__username')
        )
        if (
            AuditLog.objects.filter(actor__isnull=True).exists()
            or IncidentTimelineEvent.objects.filter(actor__isnull=True).exists()
        ):
            names.insert(0, 'System')
        return names

    @staticmethod
    def _int_param(raw, *, default, maximum):
        try:
            return min(int(raw), maximum)
        except (TypeError, ValueError):
            return default


class OperationalOverviewView(APIView):
    """Descriptive operational rates and a daily intake series.

    Every number here is a count, or a ratio of two counts, already in the
    database. Nothing is projected forward and nothing is scored: the page
    answers "what has the workload looked like", never "what will it be".
    """

    permission_classes = [IsBFPPersonnel]

    WINDOW_CHOICES = (7, 30, 90)

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 7))
        except (TypeError, ValueError):
            days = 7
        if days not in self.WINDOW_CHOICES:
            days = 7

        today = timezone.localdate()
        start = today - timedelta(days=days - 1)
        reports = IncidentReport.objects.filter(created_at__date__gte=start)
        incidents = Incident.objects.filter(created_at__date__gte=start)

        total_reports = reports.count()

        return Response({
            'days': days,
            'days_choices': self.WINDOW_CHOICES,
            'range': {'start': start, 'end': today},
            'totals': {
                'reports': total_reports,
                'incidents': incidents.count(),
                'reports_all_time': IncidentReport.objects.count(),
                'incidents_all_time': Incident.objects.count(),
            },
            'rates': self._rates(reports, incidents, total_reports),
            'daily': self._daily(start, days, reports, incidents),
            'by_type': self._by_type(reports),
            'by_barangay': self._by_barangay(reports),
            'response_times': self._response_times(incidents),
            'generated_at': timezone.now(),
        })

    def _rates(self, reports, incidents, total_reports):
        """Three ratios, each carrying the counts that produced it.

        The numerator and denominator ride along so a percentage can never be
        read without its sample size: "100% reviewed" out of one report is not
        the same claim as out of four hundred, and a gauge alone cannot tell
        them apart. ``percent`` is null rather than 0 when nothing was counted,
        so "no data" and "none of them" stay distinguishable.
        """
        reviewed = reports.filter(workflow_status__in=REVIEWED_STATUSES).count()
        mappable = reports.filter(
            geocoding_confidence__in=(
                GeocodingConfidence.HIGH,
                GeocodingConfidence.MEDIUM,
            )
        ).count()
        total_incidents = incidents.count()
        resolved = incidents.filter(workflow_status=WorkflowStatus.RESOLVED).count()

        def ratio(part, whole):
            return round(part / whole * 100) if whole else None

        return [
            {
                'key': 'reviewed',
                'label': 'Reports reviewed',
                'percent': ratio(reviewed, total_reports),
                'count': reviewed,
                'total': total_reports,
                'detail': 'reached Verified, Responding or Resolved',
            },
            {
                'key': 'resolved',
                'label': 'Incidents resolved',
                'percent': ratio(resolved, total_incidents),
                'count': resolved,
                'total': total_incidents,
                'detail': 'canonical incidents closed',
            },
            {
                'key': 'map_coverage',
                'label': 'Map coverage',
                'percent': ratio(mappable, total_reports),
                'count': mappable,
                'total': total_reports,
                'detail': 'precise enough to plot (High or Medium)',
            },
        ]

    def _daily(self, start, days, reports, incidents):
        """One row per day in the window, including the empty ones.

        Counted in Python from two grouped queries rather than one query per
        day: a 90-day window would otherwise be 180 round trips. Days with no
        records are filled in so the chart keeps an even axis instead of
        silently collapsing a quiet week into a busy-looking one.
        """
        report_counts = {
            row['day']: row['n']
            for row in reports.values(day=F('created_at__date')).annotate(n=Count('id'))
        }
        incident_counts = {
            row['day']: row['n']
            for row in incidents.values(day=F('created_at__date')).annotate(n=Count('id'))
        }

        series = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            series.append({
                'date': day,
                'reports': report_counts.get(day, 0),
                'incidents': incident_counts.get(day, 0),
            })
        return series

    def _by_type(self, reports):
        counts = {
            row['incident_type']: row['n']
            for row in reports.values('incident_type').annotate(n=Count('id'))
        }
        # Driven off the choices rather than the data, so a category with no
        # reports this window reads as zero instead of vanishing from the list.
        return [
            {'key': value, 'label': label, 'count': counts.get(value, 0)}
            for value, label in IncidentType.choices
        ]

    def _by_barangay(self, reports, limit=8):
        rows = (
            reports.values('barangay')
            .annotate(n=Count('id'))
            .order_by('-n', 'barangay')[:limit]
        )
        return [{'barangay': row['barangay'], 'count': row['n']} for row in rows]

    def _response_times(self, incidents):
        dispatched = incidents.filter(
            dispatched_at__isnull=False, verified_at__isnull=False
        ).annotate(elapsed=F('dispatched_at') - F('verified_at'))
        resolved = incidents.filter(
            resolved_at__isnull=False, verified_at__isnull=False
        ).annotate(elapsed=F('resolved_at') - F('verified_at'))

        def mean_seconds(queryset):
            value = queryset.aggregate(mean=Avg('elapsed'))['mean']
            return int(value.total_seconds()) if value else None

        return {
            'average_dispatch_seconds': mean_seconds(dispatched),
            'dispatch_sample': dispatched.count(),
            'average_resolution_seconds': mean_seconds(resolved),
            'resolution_sample': resolved.count(),
        }


class ReferenceDataView(APIView):
    """The vocabularies and thresholds the rest of the system runs on.

    Derived rather than restated: the confidence table is built by calling
    ``derive_confidence`` itself, so it cannot drift from the grading that
    actually runs, and the barangay list comes from the reports on file rather
    than a fixture, so it describes where reports genuinely come from.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        current = SystemSetting.load()
        high_band = getattr(settings, 'GEO_HIGH_ACCURACY_M', 50)
        medium_band = getattr(settings, 'GEO_MEDIUM_ACCURACY_M', 200)

        # Probes chosen to sit either side of the configured bands so every
        # outcome the grader can return appears in the table exactly once.
        probes = (
            (LocationSource.MAP_PIN, None, 'n/a'),
            (LocationSource.DEVICE_GPS, high_band, f'at or under {high_band} m'),
            (LocationSource.DEVICE_GPS, medium_band, f'at or under {medium_band} m'),
            (LocationSource.DEVICE_GPS, medium_band + 1, f'over {medium_band} m'),
            (LocationSource.DEVICE_GPS, None, 'unreported'),
            (LocationSource.GEOCODED_ADDRESS, None, 'n/a'),
            (LocationSource.BARANGAY_ONLY, None, 'n/a'),
        )

        confidence = []
        for source, accuracy, note in probes:
            grade = derive_confidence(source, accuracy)
            confidence.append({
                'source': LocationSource(source).label,
                'accuracy_m': accuracy,
                'accuracy_note': note,
                'grade': GeocodingConfidence(grade).label,
                'mappable': grade in (
                    GeocodingConfidence.HIGH,
                    GeocodingConfidence.MEDIUM,
                ),
            })

        return Response({
            'incident_types': self._choices(IncidentType),
            'workflow_statuses': self._choices(WorkflowStatus),
            'duplicate_statuses': self._choices(DuplicateStatus),
            'location_sources': self._choices(LocationSource),
            'confidence_grading': confidence,
            'rules': [
                {
                    'key': 'duplicate_radius',
                    'label': 'Duplicate radius',
                    'value': f'{current.duplicate_radius_m} m',
                    'note': 'Haversine distance between two reports',
                    'editable': True,
                },
                {
                    'key': 'duplicate_window',
                    'label': 'Duplicate time window',
                    'value': f'{current.duplicate_window_minutes} min',
                    'note': 'Both the radius and the window must hold',
                    'editable': True,
                },
                {
                    'key': 'map_window',
                    'label': 'Live map window',
                    'value': f'{current.map_recent_hours} h',
                    'note': 'Ongoing incidents stay on the map regardless of age',
                    'editable': True,
                },
                {
                    'key': 'geo_bands',
                    'label': 'GPS accuracy bands',
                    'value': f'High at or under {high_band} m, Medium at or under {medium_band} m',
                    'note': 'Set in settings.py: changing them would re-grade history',
                    'editable': False,
                },
            ],
            'barangays': self._barangays(),
        })

    def _choices(self, enum):
        return [{'value': value, 'label': label} for value, label in enum.choices]

    def _barangays(self):
        rows = (
            IncidentReport.objects.values('barangay')
            .annotate(reports=Count('id'))
            .order_by('barangay')
        )
        return [
            {'name': row['barangay'], 'reports': row['reports']}
            for row in rows
            if row['barangay']
        ]


class SystemSettingsView(APIView):
    """Read and update the runtime-tunable rules.

    A change takes effect on the next report submitted -- ``duplicates`` reads
    the singleton on each call rather than caching it -- so the write is
    audited like any other personnel action, and the entry names the old and
    new value so a later "why was this flagged" has an answer.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        return Response(self._payload(SystemSetting.load()))

    def patch(self, request):
        instance = SystemSetting.load()
        serializer = SystemSettingSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        tracked = (
            'duplicate_radius_m',
            'duplicate_window_minutes',
            'map_recent_hours',
        )
        before = {key: getattr(instance, key) for key in tracked}
        instance = serializer.save(updated_by=request.user)
        changed = {
            key: [before[key], getattr(instance, key)]
            for key in tracked
            if before[key] != getattr(instance, key)
        }

        if changed:
            AuditLog.objects.create(
                actor=request.user,
                action=AuditLog.Action.SETTINGS_UPDATED,
                target_type='SystemSetting',
                target_id=instance.pk,
                summary='Updated operational settings: ' + ', '.join(
                    f'{key} {old} to {new}' for key, (old, new) in changed.items()
                ),
                context={'changed': changed},
            )

        return Response(self._payload(instance))

    def _payload(self, instance):
        data = SystemSettingSerializer(instance).data
        # The bounds the serializer enforces, sent along so the form applies the
        # same limits instead of keeping a second copy that could drift.
        data['limits'] = {
            'duplicate_radius_m': {'min': 25, 'max': 2000},
            'duplicate_window_minutes': {'min': 5, 'max': 720},
            'map_recent_hours': {
                'choices': list(
                    getattr(settings, 'MAP_RECENT_HOURS_CHOICES', (1, 6, 24))
                )
            },
        }
        data['defaults'] = SystemSetting.defaults()
        return data


class BackupExportView(APIView):
    """A full JSON export of the operational record.

    Read-only by design. There is deliberately no matching import endpoint:
    restoring a database from an uploaded file is destructive and
    all-or-nothing, and that belongs to the platform (Azure Postgres
    point-in-time restore) rather than to a web form any signed-in operator
    could reach by accident.

    Password hashes are excluded. This file is meant to be handed to the thesis
    archive and to BFP records, and a hash is a credential.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        reports = IncidentReport.objects.select_related(
            'reporter', 'duplicate_of', 'incident'
        )
        incidents = Incident.objects.select_related('verified_by')
        counts = {
            'reports': reports.count(),
            'incidents': incidents.count(),
            'timeline_events': IncidentTimelineEvent.objects.count(),
            'audit_entries': AuditLog.objects.count(),
        }

        payload = {
            'meta': {
                'generated_at': timezone.now(),
                'generated_by': request.user.username,
                'schema': 'firetrace-export/1',
                'counts': counts,
            },
            'settings': SystemSettingSerializer(SystemSetting.load()).data,
            'reports': [self._report(report) for report in reports],
            'incidents': [self._incident(incident) for incident in incidents],
            'timeline_events': [
                {
                    'id': event.id,
                    'report_id': event.report_id,
                    'incident_id': event.incident_id,
                    'event_type': event.event_type,
                    'description': event.description,
                    'context': event.context,
                    'actor': event.actor.username if event.actor else None,
                    'created_at': event.created_at,
                }
                for event in IncidentTimelineEvent.objects.select_related('actor')
            ],
            'audit_log': [
                {
                    'id': entry.id,
                    'actor': entry.actor.username if entry.actor else None,
                    'action': entry.action,
                    'target_type': entry.target_type,
                    'target_id': entry.target_id,
                    'target_reference': entry.target_reference,
                    'summary': entry.summary,
                    'context': entry.context,
                    'created_at': entry.created_at,
                }
                for entry in AuditLog.objects.select_related('actor')
            ],
            'users': [
                {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'is_active': user.is_active,
                    'date_joined': user.date_joined,
                }
                for user in type(request.user).objects.order_by('id')
            ],
        }

        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.DATA_EXPORTED,
            target_type='Export',
            summary=(
                f"Exported {counts['reports']} reports and "
                f"{counts['incidents']} incidents"
            ),
            context=counts,
        )

        response = Response(payload)
        stamp = timezone.now().strftime('%Y%m%d-%H%M')
        response['Content-Disposition'] = (
            f'attachment; filename="firetrace-export-{stamp}.json"'
        )
        return response

    def _report(self, report):
        return {
            'id': report.id,
            'reference_number': report.reference_number,
            'reporter': report.reporter.username if report.reporter else None,
            'incident_type': report.incident_type,
            'description': report.description,
            'barangay': report.barangay,
            'address': report.address,
            'latitude': str(report.latitude),
            'longitude': str(report.longitude),
            'location_source': report.location_source,
            'gps_accuracy_m': report.gps_accuracy_m,
            'geocoding_confidence': report.geocoding_confidence,
            'workflow_status': report.workflow_status,
            'duplicate_status': report.duplicate_status,
            'duplicate_of': (
                report.duplicate_of.reference_number if report.duplicate_of else None
            ),
            'duplicate_distance_m': report.duplicate_distance_m,
            'duplicate_time_delta_seconds': report.duplicate_time_delta_seconds,
            'incident': report.incident.reference_number if report.incident else None,
            'has_photo': report.has_photo,
            'created_at': report.created_at,
        }

    def _incident(self, incident):
        return {
            'id': incident.id,
            'reference_number': incident.reference_number,
            'incident_type': incident.incident_type,
            'description': incident.description,
            'barangay': incident.barangay,
            'address': incident.address,
            'latitude': str(incident.latitude),
            'longitude': str(incident.longitude),
            'workflow_status': incident.workflow_status,
            'verified_by': (
                incident.verified_by.username if incident.verified_by else None
            ),
            'verification_note': incident.verification_note,
            'verified_at': incident.verified_at,
            'dispatched_at': incident.dispatched_at,
            'resolved_at': incident.resolved_at,
            'created_at': incident.created_at,
        }


class SystemHealthView(APIView):
    """Status indicators for the dashboard sidebar and the System Health page.

    Each indicator declares how it was determined via ``check``: ``live`` means
    the component was actually exercised just now, ``config`` means only its
    configuration was inspected. Nothing here is a synthetic placeholder value.

    There is deliberately no uptime percentage, error rate or CPU figure. A
    single Django process cannot observe any of those about itself, and a
    number invented to fill a card is worse than an absent one on a screen an
    operator is meant to trust during a fire.
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
            self._channel_layer_status(),
            self._storage_status(),
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
            'record_counts': {
                'reports': IncidentReport.objects.count(),
                'incidents': Incident.objects.count(),
                'audit_entries': AuditLog.objects.count(),
            },
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
        engine = connection.settings_dict.get('ENGINE', '').rsplit('.', 1)[-1]
        return {
            'key': 'database',
            'label': 'Database',
            'status': 'operational' if latency_ms < 500 else 'degraded',
            'detail': f'{engine} responded in {latency_ms} ms',
            'check': 'live',
        }

    def _channel_layer_status(self):
        """Whether realtime can fan out beyond this one process.

        The in-memory layer reports as degraded rather than operational: it
        works, but only reaches clients attached to the same process, so a
        second operator on a scaled-out deployment would silently never see a
        push. Drawing that distinction is the whole point of the indicator.
        """
        try:
            from channels.layers import get_channel_layer
        except ImportError:
            return {
                'key': 'channel_layer',
                'label': 'Realtime Channel Layer',
                'status': 'down',
                'detail': 'channels is not installed',
                'check': 'config',
            }

        layer = get_channel_layer()
        if layer is None:
            return {
                'key': 'channel_layer',
                'label': 'Realtime Channel Layer',
                'status': 'down',
                'detail': 'No channel layer configured, dashboards will poll',
                'check': 'config',
            }

        name = type(layer).__name__
        in_memory = 'InMemory' in name
        return {
            'key': 'channel_layer',
            'label': 'Realtime Channel Layer',
            'status': 'degraded' if in_memory else 'operational',
            'detail': (
                'In-memory layer: reaches this process only'
                if in_memory
                else f'{name} configured'
            ),
            'check': 'config',
        }

    def _storage_status(self):
        """Where uploaded photos go.

        Configuration only: writing a probe file to Blob Storage on every
        dashboard refresh would litter the container with them.
        """
        azure = bool(getattr(settings, 'AZURE_ACCOUNT_NAME', '')) and bool(
            getattr(settings, 'AZURE_ACCOUNT_KEY', '')
        )
        return {
            'key': 'photo_storage',
            'label': 'Photo Storage',
            'status': 'operational',
            'detail': (
                f'Azure Blob Storage ({settings.AZURE_ACCOUNT_NAME})'
                if azure
                else f'Local filesystem ({type(default_storage).__name__})'
            ),
            'check': 'config',
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
