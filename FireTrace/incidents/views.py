from datetime import timedelta

from django.conf import settings as django_settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsBFPPersonnel
from analytics.models import AuditLog, SystemSetting
from realtime.notify import broadcast_dashboard_event

from .duplicates import flag_possible_duplicate
from .models import (
    DuplicateStatus,
    GeocodingConfidence,
    Incident,
    IncidentReport,
    IncidentTimelineEvent,
    SourceChannel,
    WorkflowStatus,
)
from .serializers import (
    DuplicateReviewSerializer,
    IncidentReportSerializer,
    IncidentSerializer,
    IncidentTimelineEventSerializer,
    IncidentVerifySerializer,
    ReportIntakeSerializer,
    ReportLinkSerializer,
    ReportQueueSerializer,
    WorkflowStatusUpdateSerializer,
)
from .services import record_activity

# How far back the live dashboard map reaches by default, and the windows the
# operator can switch between. Everything older is still on the All Reports
# page; this only decides what the operations view draws.
#
# Re-exported from settings so the Settings page and this view cannot end up
# offering different windows: the singleton that holds the live value is
# validated against the same MAP_RECENT_HOURS_CHOICES tuple.
MAP_RECENT_HOURS = django_settings.MAP_RECENT_HOURS
MAP_RECENT_HOURS_CHOICES = django_settings.MAP_RECENT_HOURS_CHOICES

# A fire someone is currently working stays on the live map however long ago it
# came in -- "current" is about the response, not the timestamp. A report merely
# sitting in Submitted or Under Review is not that, and ages out of the window.
ONGOING_STATUSES = (
    WorkflowStatus.VERIFIED,
    WorkflowStatus.RESPONDING,
)

ACTIVE_STATUSES = (
    WorkflowStatus.SUBMITTED,
    WorkflowStatus.UNDER_REVIEW,
    WorkflowStatus.VERIFIED,
    WorkflowStatus.RESPONDING,
)


def _reporter_contact(report):
    """Who to call back: the caller for an encoded report, else the account holder."""
    if report.source_channel != SourceChannel.PWA:
        return report.caller_name, report.caller_phone
    user = report.reporter
    return (user.get_full_name() or user.email or user.username), user.phone_number


class QueuePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 200


class ReportQuerysetMixin:
    def get_queryset(self):
        user = self.request.user
        qs = IncidentReport.objects.select_related('reporter', 'duplicate_of', 'incident')
        # A civilian only ever sees their own submissions.
        if user.user_type == 'civilian':
            qs = qs.filter(reporter=user)
        return qs


class IncidentReportListCreateView(ReportQuerysetMixin, generics.ListCreateAPIView):
    serializer_class = IncidentReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        report = serializer.save()

        record_activity(
            actor=report.reporter,
            action=AuditLog.Action.REPORT_SUBMITTED,
            event_type=IncidentTimelineEvent.EventType.REPORT_SUBMITTED,
            summary=f"Report {report.reference_number} submitted from {report.barangay}",
            report=report,
            context={
                'incident_type': report.incident_type,
                'geocoding_confidence': report.geocoding_confidence,
            },
        )

        # Advisory flag only -- nothing is merged, nothing is deleted, and the
        # report's workflow status is untouched.
        flag_possible_duplicate(report)

        broadcast_dashboard_event('report.created', {'report_id': report.id})


class ReportIntakeView(generics.CreateAPIView):
    """Personnel encode a report that reached the station by another channel.

    From here on it is an ordinary IncidentReport -- same duplicate rule, same
    queue, same map -- with the channel and the caller recorded on it.
    """

    serializer_class = ReportIntakeSerializer
    permission_classes = [IsBFPPersonnel]

    def perform_create(self, serializer):
        report = serializer.save()
        record_activity(
            actor=self.request.user,
            action=AuditLog.Action.REPORT_ENCODED,
            event_type=IncidentTimelineEvent.EventType.REPORT_SUBMITTED,
            summary=f"Report {report.reference_number} encoded from {report.get_source_channel_display()}",
            report=report,
            context={'source_channel': report.source_channel, 'incident_type': report.incident_type},
        )
        flag_possible_duplicate(report)
        broadcast_dashboard_event('report.created', {'report_id': report.id})


class IncidentReportDetailView(ReportQuerysetMixin, generics.RetrieveAPIView):
    serializer_class = IncidentReportSerializer
    permission_classes = [IsAuthenticated]


class ReportQueueView(generics.ListAPIView):
    """The Incoming Reports queue: every report, filterable, newest first."""

    serializer_class = ReportQueueSerializer
    permission_classes = [IsBFPPersonnel]
    pagination_class = QueuePagination

    def get_queryset(self):
        params = self.request.query_params
        qs = IncidentReport.objects.select_related('reporter', 'duplicate_of')

        # Comma-separated so the UI can show several statuses at once.
        for field in ('workflow_status', 'duplicate_status', 'incident_type', 'geocoding_confidence'):
            raw = params.get(field)
            if raw:
                qs = qs.filter(**{f'{field}__in': [v for v in raw.split(',') if v]})

        barangay = params.get('barangay')
        if barangay:
            qs = qs.filter(barangay__iexact=barangay)

        has_photo = params.get('has_photo')
        if has_photo == 'true':
            qs = qs.exclude(photo='').exclude(photo__isnull=True)
        elif has_photo == 'false':
            qs = qs.filter(Q(photo='') | Q(photo__isnull=True))

        date_from, date_to = params.get('date_from'), params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = (params.get('q') or '').strip()
        if search:
            # Reference numbers are derived (FT-YYYY-000NN), so match the
            # numeric tail against the primary key rather than a stored string.
            digits = ''.join(ch for ch in search if ch.isdigit())
            criteria = Q(barangay__icontains=search) | Q(address__icontains=search) | Q(description__icontains=search)
            if digits:
                criteria |= Q(pk=int(digits.lstrip('0') or 0))
            qs = qs.filter(criteria)

        return qs.order_by('-created_at')


class ReportWorkflowStatusView(APIView):
    """Move one report along the workflow dimension.

    Deliberately cannot touch ``duplicate_status``: the two dimensions are
    independent and are updated through separate endpoints.
    """

    permission_classes = [IsBFPPersonnel]

    def post(self, request, pk):
        report = generics.get_object_or_404(IncidentReport, pk=pk)
        # A linked report's resolution belongs to its incident; moving the
        # report on its own would let the two disagree.
        if report.incident_id:
            return Response(
                {'workflow_status': [
                    f"{report.reference_number} is linked to {report.incident.reference_number}. "
                    "Change the incident's status instead."
                ]},
                status=400,
            )
        serializer = WorkflowStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        previous = report.workflow_status
        new_status = serializer.validated_data['workflow_status']
        note = serializer.validated_data.get('note', '')

        report.workflow_status = new_status
        report.save(update_fields=['workflow_status', 'updated_at'])

        summary = (
            f"{report.reference_number} moved from "
            f"{WorkflowStatus(previous).label} to {WorkflowStatus(new_status).label}"
        )
        record_activity(
            actor=request.user,
            action=AuditLog.Action.STATUS_UPDATED,
            event_type=IncidentTimelineEvent.EventType.STATUS_CHANGE,
            summary=f"{summary}. {note}".strip() if note else summary,
            report=report,
            context={'from': previous, 'to': new_status, 'note': note},
        )
        broadcast_dashboard_event('report.status_changed', {'report_id': report.id})

        return Response(IncidentReportSerializer(report, context={'request': request}).data)


class ReportDuplicateReviewView(APIView):
    """Record a person's disposition of a flagged report.

    The report itself is never altered beyond the duplicate-review fields --
    no merge, no deletion, no change to its workflow status or its content.
    """

    permission_classes = [IsBFPPersonnel]

    def post(self, request, pk):
        report = generics.get_object_or_404(IncidentReport, pk=pk)
        serializer = DuplicateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        previous = report.duplicate_status
        disposition = serializer.validated_data['duplicate_status']
        note = serializer.validated_data.get('note', '')

        report.duplicate_status = disposition
        report.duplicate_reviewed_by = request.user
        report.duplicate_reviewed_at = timezone.now()
        report.save(
            update_fields=[
                'duplicate_status', 'duplicate_reviewed_by', 'duplicate_reviewed_at', 'updated_at',
            ]
        )

        against = report.duplicate_of.reference_number if report.duplicate_of else 'no linked report'
        summary = (
            f"{report.reference_number} ruled "
            f"{DuplicateStatus(disposition).label} against {against}"
        )
        record_activity(
            actor=request.user,
            action=AuditLog.Action.DUPLICATE_REVIEWED,
            event_type=IncidentTimelineEvent.EventType.DUPLICATE_REVIEW,
            summary=f"{summary}. {note}".strip() if note else summary,
            report=report,
            context={
                'from': previous,
                'to': disposition,
                'compared_with': report.duplicate_of_id,
                'distance_m': report.duplicate_distance_m,
                'time_delta_seconds': report.duplicate_time_delta_seconds,
                'note': note,
            },
        )
        broadcast_dashboard_event('report.duplicate_reviewed', {'report_id': report.id})

        return Response(IncidentReportSerializer(report, context={'request': request}).data)


class ReportLinkView(APIView):
    """Link a report to a canonical incident, move it to another, or unlink it.

    The report itself is untouched; only the association moves, and every move
    records who made it, from where to where, and why.
    """

    permission_classes = [IsBFPPersonnel]

    def post(self, request, pk):
        report = generics.get_object_or_404(IncidentReport.objects.select_related('incident'), pk=pk)
        serializer = ReportLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data['incident']
        note = serializer.validated_data.get('note', '')
        previous = report.incident

        if target == previous:
            return Response(
                {'incident': ['The report is already in that state.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.incident = target
        report.save(update_fields=['incident', 'updated_at'])

        if target is None:
            action = AuditLog.Action.REPORT_UNLINKED
            event_type = IncidentTimelineEvent.EventType.REPORT_UNLINKED
            summary = f"{report.reference_number} unlinked from {previous.reference_number}"
        else:
            action = AuditLog.Action.REPORT_LINKED
            event_type = IncidentTimelineEvent.EventType.REPORT_LINKED
            summary = f"{report.reference_number} linked to {target.reference_number}"
            if previous:
                summary += f" (moved from {previous.reference_number})"

        record_activity(
            actor=request.user,
            action=action,
            event_type=event_type,
            summary=f"{summary}. {note}" if note else summary,
            report=report,
            context={
                'from_incident_id': previous.id if previous else None,
                'incident_id': target.id if target else None,
                'note': note,
            },
        )
        broadcast_dashboard_event('report.linked', {'report_id': report.id})
        return Response(IncidentReportSerializer(report, context={'request': request}).data)


class ReportNotificationsView(APIView):
    """In-system updates for the signed-in reporter, built from the timeline.

    Messages are written here from status values, never passed through from a
    timeline description, which can carry a note meant for personnel. A
    reporter learns that their report moved, not what a staff member wrote.
    Includes status changes on a canonical incident their report is linked to,
    since that is what governs the report once linked.
    """

    permission_classes = [IsAuthenticated]
    LIMIT = 50

    def get(self, request):
        user = request.user
        types = IncidentTimelineEvent.EventType
        events = (
            IncidentTimelineEvent.objects.filter(
                Q(report__reporter=user, event_type__in=(
                    types.REPORT_SUBMITTED, types.STATUS_CHANGE, types.REPORT_LINKED,
                ))
                | Q(incident__source_reports__reporter=user, event_type__in=(
                    types.STATUS_CHANGE, types.DISPATCH,
                ))
            )
            .distinct()
            .select_related('report')
            .prefetch_related('incident__source_reports')[:self.LIMIT]
        )
        rows = (self._row(event, user) for event in events)
        return Response([row for row in rows if row])

    def _row(self, event, user):
        report = event.report or next(
            (r for r in event.incident.source_reports.all() if r.reporter_id == user.id), None,
        )
        if report is None:
            return None

        types = IncidentTimelineEvent.EventType
        if event.event_type == types.REPORT_SUBMITTED:
            kind, message = 'received', 'was received by BFP Calapan.'
        elif event.event_type == types.REPORT_LINKED:
            kind, message = 'verified', 'was verified as part of a confirmed fire incident.'
        else:
            to = event.context.get('to')
            if to not in WorkflowStatus.values:
                return None
            kind, message = to, f'is now {WorkflowStatus(to).label}.'

        return {
            'id': event.id,
            'report_id': report.id,
            'reference_number': report.reference_number,
            'kind': kind,
            'message': message,
            'created_at': event.created_at,
        }


class ReportTimelineView(generics.ListAPIView):
    serializer_class = IncidentTimelineEventSerializer
    permission_classes = [IsBFPPersonnel]

    def get_queryset(self):
        return IncidentTimelineEvent.objects.filter(report_id=self.kwargs['pk']).select_related('actor')


class IncidentListCreateView(generics.ListCreateAPIView):
    """Canonical incidents. BFP only -- civilians never see this record type."""

    serializer_class = IncidentSerializer
    permission_classes = [IsBFPPersonnel]

    def get_queryset(self):
        qs = Incident.objects.select_related('verified_by')
        raw = self.request.query_params.get('workflow_status')
        if raw:
            qs = qs.filter(workflow_status__in=[v for v in raw.split(',') if v])
        return qs

    def perform_create(self, serializer):
        incident = serializer.save(verified_by=self.request.user, verified_at=timezone.now())
        record_activity(
            actor=self.request.user,
            action=AuditLog.Action.INCIDENT_VERIFIED,
            event_type=IncidentTimelineEvent.EventType.VERIFICATION,
            summary=f"Incident {incident.reference_number} created for {incident.barangay}",
            incident=incident,
        )
        broadcast_dashboard_event('incident.created', {'incident_id': incident.id})


class IncidentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsBFPPersonnel]
    queryset = Incident.objects.select_related('verified_by')


class IncidentVerifyView(APIView):
    """Create a canonical incident from one or more civilian reports.

    Linking several reports to one incident is an evidentiary statement, not a
    duplicate ruling: each report keeps its own ``duplicate_status`` and must
    still be dispositioned separately.
    """

    permission_classes = [IsBFPPersonnel]

    def post(self, request):
        serializer = IncidentVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        reports = list(IncidentReport.objects.filter(id__in=data['report_ids']).order_by('created_at'))
        primary = reports[0]
        now = timezone.now()

        incident = Incident.objects.create(
            incident_type=data.get('incident_type') or primary.incident_type,
            description=primary.description,
            barangay=data.get('barangay') or primary.barangay,
            address=data.get('address') or primary.address,
            latitude=data.get('latitude') or primary.latitude,
            longitude=data.get('longitude') or primary.longitude,
            workflow_status=WorkflowStatus.VERIFIED,
            verified_by=request.user,
            verification_note=data.get('verification_note', ''),
            verified_at=now,
        )

        record_activity(
            actor=request.user,
            action=AuditLog.Action.INCIDENT_VERIFIED,
            event_type=IncidentTimelineEvent.EventType.VERIFICATION,
            summary=(
                f"Incident {incident.reference_number} verified from "
                f"{len(reports)} report(s) in {incident.barangay}"
            ),
            incident=incident,
            context={'report_ids': data['report_ids'], 'note': data.get('verification_note', '')},
        )

        for report in reports:
            report.incident = incident
            report.workflow_status = WorkflowStatus.VERIFIED
            report.save(update_fields=['incident', 'workflow_status', 'updated_at'])
            record_activity(
                actor=request.user,
                action=AuditLog.Action.REPORT_LINKED,
                event_type=IncidentTimelineEvent.EventType.REPORT_LINKED,
                summary=f"{report.reference_number} linked to {incident.reference_number}",
                report=report,
                context={'incident_id': incident.id},
            )

        broadcast_dashboard_event('incident.verified', {'incident_id': incident.id})
        return Response(
            IncidentSerializer(incident, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class IncidentWorkflowStatusView(APIView):
    """Dispatch and resolution for a canonical incident."""

    permission_classes = [IsBFPPersonnel]

    def post(self, request, pk):
        incident = generics.get_object_or_404(Incident, pk=pk)
        serializer = WorkflowStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        previous = incident.workflow_status
        new_status = serializer.validated_data['workflow_status']
        note = serializer.validated_data.get('note', '')
        now = timezone.now()

        incident.workflow_status = new_status
        fields = ['workflow_status', 'updated_at']
        # Stamped once, on first entry, so response-time arithmetic stays honest
        # if a record is moved back and forth.
        if new_status == WorkflowStatus.RESPONDING and not incident.dispatched_at:
            incident.dispatched_at = now
            fields.append('dispatched_at')
        if new_status == WorkflowStatus.RESOLVED and not incident.resolved_at:
            incident.resolved_at = now
            fields.append('resolved_at')
        incident.save(update_fields=fields)

        is_dispatch = new_status == WorkflowStatus.RESPONDING
        summary = (
            f"{incident.reference_number} moved from "
            f"{WorkflowStatus(previous).label} to {WorkflowStatus(new_status).label}"
        )
        record_activity(
            actor=request.user,
            action=AuditLog.Action.DISPATCH_ASSIGNED if is_dispatch else AuditLog.Action.STATUS_UPDATED,
            event_type=(
                IncidentTimelineEvent.EventType.DISPATCH if is_dispatch
                else IncidentTimelineEvent.EventType.STATUS_CHANGE
            ),
            summary=f"{summary}. {note}".strip() if note else summary,
            incident=incident,
            context={'from': previous, 'to': new_status, 'note': note},
        )
        broadcast_dashboard_event('incident.status_changed', {'incident_id': incident.id})

        return Response(IncidentSerializer(incident, context={'request': request}).data)


class IncidentTimelineView(generics.ListAPIView):
    serializer_class = IncidentTimelineEventSerializer
    permission_classes = [IsBFPPersonnel]

    def get_queryset(self):
        return IncidentTimelineEvent.objects.filter(incident_id=self.kwargs['pk']).select_related('actor')


class DashboardMapView(APIView):
    """Points for the operations map.

    Two marker families are returned separately so the frontend can style them
    differently: unverified civilian reports, and canonical verified incidents.

    Only HIGH and MEDIUM geocoding confidence reports are included. LOW
    confidence records are counted in ``withheld`` instead of being drawn at a
    coordinate the underlying data does not support.

    Two scopes share this endpoint so both maps stay consistent by construction:

    ``recent`` (default)
        What the live dashboard draws -- open cases from the last
        ``MAP_RECENT_HOURS``. A wall of months-old pins buries the fire that
        started ten minutes ago, which is the one an operator is looking for.
    ``all``
        Every report and incident regardless of age or status, for the All
        Reports page. Resolved records are included: that page is the archive.
    """

    permission_classes = [IsBFPPersonnel]

    def get(self, request):
        scope = 'all' if request.query_params.get('scope') == 'all' else 'recent'
        hours = self._recent_hours(request)

        # Q rather than kwargs: "recent" is an OR of two rules, not a set of
        # ANDed columns -- new enough, or still being responded to.
        window = Q()
        if scope == 'recent':
            since = timezone.now() - timedelta(hours=hours)
            window = (
                Q(created_at__gte=since, workflow_status__in=ACTIVE_STATUSES)
                | Q(workflow_status__in=ONGOING_STATUSES)
            )

        reports = (
            IncidentReport.objects.filter(
                window,
                geocoding_confidence__in=[GeocodingConfidence.HIGH, GeocodingConfidence.MEDIUM],
            )
            .exclude(duplicate_status=DuplicateStatus.CONFIRMED)
            .select_related('duplicate_of', 'reporter')
            .order_by('-created_at')[:250]
        )

        # Same population as the plotted set, differing only by confidence, so
        # the legend's "withheld" count is directly comparable to what is drawn.
        withheld = (
            IncidentReport.objects.filter(
                window,
                geocoding_confidence=GeocodingConfidence.LOW,
            )
            .exclude(duplicate_status=DuplicateStatus.CONFIRMED)
            .count()
        )

        # Annotated rather than counted per row: this endpoint is refetched on
        # every dashboard event, so one query beats one-per-marker.
        incidents = (
            Incident.objects.filter(window)
            .annotate(report_count=Count('source_reports'))
            .order_by('-created_at')[:250]
        )

        return Response({
            'reports': [
                {
                    'id': r.id,
                    'kind': 'report',
                    'reference_number': r.reference_number,
                    'latitude': float(r.latitude),
                    'longitude': float(r.longitude),
                    'barangay': r.barangay,
                    'incident_type': r.incident_type,
                    'incident_type_display': r.get_incident_type_display(),
                    'workflow_status': r.workflow_status,
                    'duplicate_status': r.duplicate_status,
                    'geocoding_confidence': r.geocoding_confidence,
                    # Who to call back. Personnel-only endpoint, so the contact
                    # details are safe here; OngoingFireMapView never carries them.
                    'reporter_name': _reporter_contact(r)[0],
                    'reporter_phone': _reporter_contact(r)[1],
                    'source_channel': r.source_channel,
                    'source_channel_display': r.get_source_channel_display(),
                    'has_photo': r.has_photo,
                    # Signing is a local HMAC, not a call to Azure, so doing it
                    # per marker costs nothing worth avoiding. Absent rather
                    # than empty when there is no photo, so the popup can tell
                    # "none attached" from "attached but unreadable".
                    'photo_url': r.photo.url if r.photo else None,
                    'created_at': r.created_at,
                }
                for r in reports
            ],
            'incidents': [
                {
                    'id': i.id,
                    'kind': 'incident',
                    'reference_number': i.reference_number,
                    'latitude': float(i.latitude),
                    'longitude': float(i.longitude),
                    'barangay': i.barangay,
                    'incident_type': i.incident_type,
                    'incident_type_display': i.get_incident_type_display(),
                    'workflow_status': i.workflow_status,
                    'source_report_count': i.report_count,
                    'created_at': i.created_at,
                }
                for i in incidents
            ],
            'withheld_low_confidence': withheld,
            'scope': scope,
            'recent_hours': hours if scope == 'recent' else None,
            'recent_hours_choices': MAP_RECENT_HOURS_CHOICES,
        })

    def _recent_hours(self, request):
        """Window size from ?hours=, restricted to the offered choices.

        Clamped rather than trusted: an arbitrary value would let a client turn
        the live map back into the unbounded query this filter exists to avoid.
        """
        # The default is the administrator's configured window, not the
        # compiled-in one, so changing it in the portal actually changes what
        # an operator sees on arrival rather than only what ?hours= falls back to.
        default = SystemSetting.load().map_recent_hours
        try:
            hours = int(request.query_params.get('hours', default))
        except (TypeError, ValueError):
            return default
        return hours if hours in MAP_RECENT_HOURS_CHOICES else default


class OngoingFireMapView(APIView):
    """The live map every signed-in user can see -- ongoing fires only.

    This is the one incident view that is not personnel-only, so what it
    returns is deliberately narrow on both axes:

    *Which* records. Only fires in an ``ONGOING_STATUSES`` state: a person at
    BFP has verified this one is real and it is not resolved yet. A civilian
    submission sitting in Submitted is an unconfirmed claim, and broadcasting
    unconfirmed claims of fire to the whole city is its own hazard. Nothing
    ages out of this map -- an ongoing fire stays on it until someone marks it
    Resolved, which is exactly what "ongoing" has to mean to a resident
    deciding whether to leave the house.

    *Which fields*. Enough to draw a pulsing point and say what is burning
    where: no reporter, no description, no photograph, no duplicate review. A
    report is somebody's account of their own emergency; the public map needs
    the fire's location, not theirs.

    A report already attached to a canonical incident is skipped -- the
    incident is the same fire, and drawing both would read as two.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        ongoing = Q(workflow_status__in=ONGOING_STATUSES)

        reports = (
            IncidentReport.objects.filter(
                ongoing,
                incident__isnull=True,
                geocoding_confidence__in=[GeocodingConfidence.HIGH, GeocodingConfidence.MEDIUM],
            )
            .exclude(duplicate_status=DuplicateStatus.CONFIRMED)
            .order_by('-created_at')[:250]
        )

        incidents = Incident.objects.filter(ongoing).order_by('-created_at')[:250]

        fires = [
            {
                'id': i.id,
                'kind': 'incident',
                'reference_number': i.reference_number,
                'latitude': float(i.latitude),
                'longitude': float(i.longitude),
                'barangay': i.barangay,
                'incident_type': i.incident_type,
                'incident_type_display': i.get_incident_type_display(),
                'workflow_status': i.workflow_status,
                'workflow_status_display': i.get_workflow_status_display(),
                'started_at': i.verified_at or i.created_at,
            }
            for i in incidents
        ] + [
            {
                'id': r.id,
                'kind': 'report',
                'reference_number': r.reference_number,
                'latitude': float(r.latitude),
                'longitude': float(r.longitude),
                'barangay': r.barangay,
                'incident_type': r.incident_type,
                'incident_type_display': r.get_incident_type_display(),
                'workflow_status': r.workflow_status,
                'workflow_status_display': r.get_workflow_status_display(),
                'started_at': r.created_at,
            }
            for r in reports
        ]

        return Response({
            'fires': fires,
            'count': len(fires),
            # The server's own clock, so a browser with a skewed clock reads
            # "as of" from the same moment the data was assembled.
            'as_of': timezone.now(),
        })
