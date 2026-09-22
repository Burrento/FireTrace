from rest_framework import serializers

from accounts.serializers import UserSerializer

from .geocoding import derive_confidence
from .models import (
    DuplicateStatus,
    Incident,
    IncidentReport,
    IncidentTimelineEvent,
    SourceChannel,
    WorkflowStatus,
)


class IncidentReportSerializer(serializers.ModelSerializer):
    """Full read/write representation of one civilian submission."""

    reference_number = serializers.ReadOnlyField()
    reporter = serializers.PrimaryKeyRelatedField(read_only=True)
    incident_type_display = serializers.CharField(source='get_incident_type_display', read_only=True)
    status_display = serializers.SerializerMethodField()
    has_photo = serializers.ReadOnlyField()
    is_mappable = serializers.ReadOnlyField()
    duplicate_of_reference = serializers.CharField(
        source='duplicate_of.reference_number', read_only=True, default=None,
    )
    incident_reference = serializers.CharField(
        source='incident.reference_number', read_only=True, default=None,
    )
    # `status` is what the civilian tracks. Once a report is linked to a
    # canonical incident the incident governs resolution, so the reporter sees
    # the incident's status rather than a report-level one that could
    # contradict it. `workflow_status` stays the report's own, for personnel.
    status = serializers.SerializerMethodField()

    def get_status(self, obj):
        return obj.governing.workflow_status

    def get_status_display(self, obj):
        return obj.governing.get_workflow_status_display()

    class Meta:
        model = IncidentReport
        fields = (
            'id', 'reference_number', 'reporter', 'incident_type', 'incident_type_display',
            'description', 'barangay', 'address', 'latitude', 'longitude',
            'location_confirmed', 'photo', 'has_photo', 'location_source', 'gps_accuracy_m',
            'geocoding_confidence', 'is_mappable',
            'workflow_status', 'status', 'status_display',
            'duplicate_status', 'duplicate_of', 'duplicate_of_reference',
            'duplicate_distance_m', 'duplicate_time_delta_seconds',
            'duplicate_reviewed_at',
            'incident', 'incident_reference',
            'source_channel', 'caller_name', 'caller_phone',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            # A civilian cannot claim a report came in by hotline.
            'source_channel', 'caller_name', 'caller_phone',
            'workflow_status', 'geocoding_confidence', 'duplicate_status',
            'duplicate_of', 'duplicate_distance_m', 'duplicate_time_delta_seconds',
            'duplicate_reviewed_at', 'incident', 'created_at', 'updated_at',
        )

    # Read from the file's first bytes, not its name or declared type -- both
    # are whatever the client says. The app compresses to JPEG before upload.
    PHOTO_SIGNATURES = (b'\xff\xd8\xff', b'\x89PNG\r\n\x1a\n')
    PHOTO_MAX_BYTES = 5 * 1024 * 1024

    def validate_photo(self, value):
        if not value:
            return value
        if value.size > self.PHOTO_MAX_BYTES:
            raise serializers.ValidationError('Photos must be 5 MB or smaller.')
        head = value.read(12)
        value.seek(0)
        is_webp = head[:4] == b'RIFF' and head[8:12] == b'WEBP'
        if not (head.startswith(self.PHOTO_SIGNATURES) or is_webp):
            raise serializers.ValidationError('Photos must be JPEG, PNG or WebP images.')
        return value

    def validate_location_confirmed(self, value):
        if not value:
            raise serializers.ValidationError('The reported location must be confirmed before submitting.')
        return value

    def create(self, validated_data):
        validated_data['reporter'] = self.context['request'].user
        # Graded server-side from how the coordinate was captured. A client
        # must not be able to assert its own confidence level.
        validated_data['geocoding_confidence'] = derive_confidence(
            location_source=validated_data.get('location_source'),
            gps_accuracy_m=validated_data.get('gps_accuracy_m'),
            has_coordinates=validated_data.get('latitude') is not None,
        )
        return super().create(validated_data)


class ReportIntakeSerializer(IncidentReportSerializer):
    """A report personnel encode from a call, walk-in, text, radio or referral.

    Declared fields ignore the parent's read_only_fields, which is what makes
    the channel and caller writable here and only here.
    """

    source_channel = serializers.ChoiceField(
        choices=[choice for choice in SourceChannel.choices if choice[0] != SourceChannel.PWA],
    )
    caller_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    caller_phone = serializers.CharField(max_length=32, required=False, allow_blank=True)


class ReportLinkSerializer(serializers.Serializer):
    """Attach a report to a canonical incident, move it, or detach it (null)."""

    incident = serializers.PrimaryKeyRelatedField(queryset=Incident.objects.all(), allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class ReportQueueSerializer(serializers.ModelSerializer):
    """Trimmed row for the Incoming Reports queue table.

    Carries both statuses. ``workflow_status`` is the report's own column;
    ``status`` is the one in force, which is the incident's once the report is
    linked to one. The queue shows ``status``, so personnel and the reporter
    are never looking at two different answers for the same fire.
    """

    reference_number = serializers.ReadOnlyField()
    has_photo = serializers.ReadOnlyField()
    incident_type_display = serializers.CharField(source='get_incident_type_display', read_only=True)
    workflow_status_display = serializers.CharField(source='get_workflow_status_display', read_only=True)
    incident_reference = serializers.CharField(
        source='incident.reference_number', read_only=True, default=None,
    )
    status = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    duplicate_status_display = serializers.CharField(source='get_duplicate_status_display', read_only=True)
    duplicate_of_reference = serializers.CharField(
        source='duplicate_of.reference_number', read_only=True, default=None,
    )
    reporter_name = serializers.CharField(source='reporter.username', read_only=True)

    class Meta:
        model = IncidentReport
        fields = (
            'id', 'reference_number', 'created_at', 'barangay',
            'incident_type', 'incident_type_display',
            'has_photo', 'photo',
            'workflow_status', 'workflow_status_display',
            'duplicate_status', 'duplicate_status_display',
            'duplicate_of', 'duplicate_of_reference',
            'duplicate_distance_m', 'duplicate_time_delta_seconds',
            'geocoding_confidence', 'reporter_name',
            'incident', 'incident_reference', 'status', 'status_display',
        )

    def get_status(self, obj):
        return obj.governing.workflow_status

    def get_status_display(self, obj):
        return obj.governing.get_workflow_status_display()


class IncidentSerializer(serializers.ModelSerializer):
    """The canonical, personnel-verified event."""

    reference_number = serializers.ReadOnlyField()
    response_time_seconds = serializers.ReadOnlyField()
    resolution_time_seconds = serializers.ReadOnlyField()
    verified_by = UserSerializer(read_only=True)
    source_report_count = serializers.SerializerMethodField()
    incident_type_display = serializers.CharField(source='get_incident_type_display', read_only=True)
    workflow_status_display = serializers.CharField(source='get_workflow_status_display', read_only=True)

    class Meta:
        model = Incident
        fields = (
            'id', 'reference_number', 'incident_type', 'incident_type_display',
            'workflow_status_display', 'description',
            'barangay', 'address', 'latitude', 'longitude',
            'workflow_status', 'verified_by', 'verification_note',
            'verified_at', 'dispatched_at', 'resolved_at',
            'response_time_seconds', 'resolution_time_seconds',
            'source_report_count', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'verified_by', 'verified_at', 'dispatched_at', 'resolved_at',
            'created_at', 'updated_at',
        )

    def get_source_report_count(self, obj):
        return obj.source_reports.count()


class IncidentDetailSerializer(IncidentSerializer):
    """One incident with the reports that evidenced it.

    The reports are the same rows the queue draws, so a report reads the same
    whether it is being reviewed in the queue or examined as the source of an
    incident. Each keeps its own duplicate_status: linking several reports to
    one fire is an evidentiary statement, not a ruling that they duplicate each
    other, and personnel still disposition every one separately.
    """

    source_reports = ReportQueueSerializer(many=True, read_only=True)

    class Meta(IncidentSerializer.Meta):
        fields = IncidentSerializer.Meta.fields + ('source_reports',)


class IncidentTimelineEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True, default=None)
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    subject_reference = serializers.ReadOnlyField()

    class Meta:
        model = IncidentTimelineEvent
        fields = (
            'id', 'event_type', 'event_type_display', 'description', 'context',
            'actor', 'actor_name', 'subject_reference', 'incident', 'report',
            'created_at',
        )


# --- Action payloads ------------------------------------------------------

class WorkflowStatusUpdateSerializer(serializers.Serializer):
    """Moves a record along the workflow dimension only."""

    workflow_status = serializers.ChoiceField(choices=WorkflowStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class DuplicateReviewSerializer(serializers.Serializer):
    """A person's ruling on a flagged report.

    Only the two manual dispositions are accepted -- personnel cannot set a
    report back to "possible duplicate", because that is the system's flag, and
    they cannot mark something "not flagged" to make the question disappear.
    """

    duplicate_status = serializers.ChoiceField(
        choices=[
            (DuplicateStatus.KEPT_SEPARATE, DuplicateStatus.KEPT_SEPARATE.label),
            (DuplicateStatus.CONFIRMED, DuplicateStatus.CONFIRMED.label),
        ]
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class IncidentVerifySerializer(serializers.Serializer):
    """Creates a canonical incident from one or more reports.

    ``report_ids`` is required: a canonical incident always traces back to the
    civilian reports that evidenced it.
    """

    report_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False,
    )
    verification_note = serializers.CharField(required=False, allow_blank=True)
    incident_type = serializers.CharField(required=False)
    barangay = serializers.CharField(required=False)
    address = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)

    def validate_report_ids(self, value):
        found = IncidentReport.objects.filter(id__in=value)
        if found.count() != len(set(value)):
            raise serializers.ValidationError('One or more report IDs do not exist.')

        # Silently re-pointing a linked report would move it off its current
        # incident with no record of where it came from. Unlinking is a
        # separate, audited act -- make the caller perform it.
        linked = found.filter(incident__isnull=False).select_related('incident')
        if linked.exists():
            raise serializers.ValidationError(
                'Already part of an incident: ' + ', '.join(
                    f'{r.reference_number} ({r.incident.reference_number})' for r in linked
                ) + '. Separate them first.'
            )
        return value
