from django.contrib import admin

from .models import Incident, IncidentReport, IncidentTimelineEvent


@admin.register(IncidentReport)
class IncidentReportAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'reference_number', 'reporter', 'incident_type', 'barangay',
        'workflow_status', 'duplicate_status', 'geocoding_confidence', 'created_at',
    )
    # The two status dimensions are filtered independently, as they are stored.
    list_filter = (
        'workflow_status', 'duplicate_status', 'geocoding_confidence',
        'incident_type', 'barangay',
    )
    search_fields = ('barangay', 'address', 'description', 'reporter__username')
    readonly_fields = (
        'reference_number', 'duplicate_distance_m', 'duplicate_time_delta_seconds',
        'created_at', 'updated_at',
    )
    raw_id_fields = ('duplicate_of', 'incident', 'reporter', 'duplicate_reviewed_by')


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'reference_number', 'incident_type', 'barangay',
        'workflow_status', 'verified_by', 'verified_at', 'created_at',
    )
    list_filter = ('workflow_status', 'incident_type', 'barangay')
    search_fields = ('barangay', 'address', 'description')
    readonly_fields = ('reference_number', 'created_at', 'updated_at')


@admin.register(IncidentTimelineEvent)
class IncidentTimelineEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'event_type', 'subject_reference', 'actor', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('description',)
    raw_id_fields = ('incident', 'report', 'actor')
