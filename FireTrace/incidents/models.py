"""Core incident domain.

Two record types live here and are deliberately kept apart:

* ``IncidentReport`` -- one civilian submission. Many of these can describe the
  same real-world fire, and every one of them is preserved verbatim.
* ``Incident`` -- the canonical event, created only when BFP personnel verify
  one or more reports. This is the record the fire service acts on.

Nothing in this module ever merges or deletes a report. Duplicate handling is
advisory only: the system flags candidates, personnel decide.
"""

from django.conf import settings
from django.db import models


class IncidentType(models.TextChoices):
    RESIDENTIAL = 'fire', 'Residential Fire'
    VEHICLE = 'vehicle', 'Vehicle Fire'
    ELECTRICAL = 'electrical', 'Electrical Fire'
    OTHER = 'other', 'Other'


class WorkflowStatus(models.TextChoices):
    """Where a record sits in the BFP handling pipeline.

    This dimension is entirely independent of ``DuplicateStatus`` -- a report
    can be Under Review and Not Flagged, or Resolved and a Confirmed Duplicate.
    Neither field is ever derived from the other.
    """

    SUBMITTED = 'submitted', 'Submitted'
    UNDER_REVIEW = 'under_review', 'Under Review'
    VERIFIED = 'verified', 'Verified'
    RESPONDING = 'responding', 'Responding'
    RESOLVED = 'resolved', 'Resolved'


class DuplicateStatus(models.TextChoices):
    """Disposition of the duplicate question for a single report.

    Only ``POSSIBLE`` is ever set by the system, and only as a flag. Moving to
    ``KEPT_SEPARATE`` or ``CONFIRMED`` is a manual act by BFP personnel.
    """

    NOT_FLAGGED = 'not_flagged', 'Not Flagged'
    POSSIBLE = 'possible_duplicate', 'Possible Duplicate'
    KEPT_SEPARATE = 'kept_separate', 'Kept Separate'
    CONFIRMED = 'confirmed_duplicate', 'Confirmed Duplicate'


class GeocodingConfidence(models.TextChoices):
    """How much the stored coordinate can be trusted.

    The dashboard map plots HIGH and MEDIUM as precise points; LOW records are
    withheld from the map rather than drawn somewhere misleading.
    """

    HIGH = 'high', 'High'
    MEDIUM = 'medium', 'Medium'
    LOW = 'low', 'Low'


class LocationSource(models.TextChoices):
    """How the reporter coordinate was captured. Drives the confidence grade."""

    MAP_PIN = 'map_pin', 'Pinned on map'
    DEVICE_GPS = 'device_gps', 'Device GPS'
    GEOCODED_ADDRESS = 'geocoded_address', 'Geocoded address'
    BARANGAY_ONLY = 'barangay_only', 'Barangay only'


class IncidentReport(models.Model):
    """A single civilian submission. Never merged, never deleted."""

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports',
    )
    incident_type = models.CharField(max_length=20, choices=IncidentType.choices)
    description = models.TextField()
    barangay = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_confirmed = models.BooleanField(default=False)

    photo = models.FileField(upload_to='report-photos/%Y/%m/', blank=True, null=True)

    # --- Location quality -------------------------------------------------
    location_source = models.CharField(
        max_length=20, choices=LocationSource.choices, default=LocationSource.MAP_PIN,
    )
    # Metres, as reported by the browser Geolocation API. Null for map pins.
    gps_accuracy_m = models.FloatField(blank=True, null=True)
    geocoding_confidence = models.CharField(
        max_length=10, choices=GeocodingConfidence.choices, default=GeocodingConfidence.LOW,
    )

    # --- Workflow dimension ----------------------------------------------
    workflow_status = models.CharField(
        max_length=20, choices=WorkflowStatus.choices, default=WorkflowStatus.SUBMITTED,
    )

    # --- Duplicate-review dimension (independent of the above) ------------
    duplicate_status = models.CharField(
        max_length=20, choices=DuplicateStatus.choices, default=DuplicateStatus.NOT_FLAGGED,
    )
    # The earlier report this one may duplicate. Kept even after a
    # "Kept Separate" ruling so the original comparison stays auditable.
    duplicate_of = models.ForeignKey(
        'self', on_delete=models.SET_NULL, blank=True, null=True,
        related_name='duplicate_candidates',
    )
    # The two numbers the flagging rule actually compared, stored so personnel
    # can see *why* something was flagged instead of trusting a black box.
    duplicate_distance_m = models.FloatField(blank=True, null=True)
    duplicate_time_delta_seconds = models.IntegerField(blank=True, null=True)
    duplicate_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True,
        related_name='duplicate_reviews',
    )
    duplicate_reviewed_at = models.DateTimeField(blank=True, null=True)

    # --- Link to the canonical record -------------------------------------
    # Set when personnel attach this report to a verified event. Attaching does
    # not alter the report's own content or workflow status.
    incident = models.ForeignKey(
        'Incident', on_delete=models.SET_NULL, blank=True, null=True,
        related_name='source_reports',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workflow_status']),
            models.Index(fields=['duplicate_status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['barangay']),
        ]

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"FT-{self.created_at.year}-{self.id:05d}"

    @property
    def has_photo(self):
        return bool(self.photo)

    @property
    def is_mappable(self):
        """Precise enough to plot as a point on the operations map."""
        return self.geocoding_confidence in (
            GeocodingConfidence.HIGH,
            GeocodingConfidence.MEDIUM,
        )


class Incident(models.Model):
    """A canonical fire event, created manually by BFP personnel.

    An ``Incident`` only exists because a person verified it. It is never
    created by automatic promotion of a report.
    """

    incident_type = models.CharField(max_length=20, choices=IncidentType.choices)
    description = models.TextField(blank=True)
    barangay = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    workflow_status = models.CharField(
        max_length=20, choices=WorkflowStatus.choices, default=WorkflowStatus.VERIFIED,
    )

    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True,
        related_name='verified_incidents',
    )
    verification_note = models.TextField(blank=True)
    verified_at = models.DateTimeField(blank=True, null=True)
    dispatched_at = models.DateTimeField(blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workflow_status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"INC-{self.created_at.year}-{self.id:05d}"

    @property
    def response_time_seconds(self):
        """Verified -> dispatched, in seconds. Descriptive only, never predictive."""
        if not (self.verified_at and self.dispatched_at):
            return None
        return int((self.dispatched_at - self.verified_at).total_seconds())

    @property
    def resolution_time_seconds(self):
        if not (self.verified_at and self.resolved_at):
            return None
        return int((self.resolved_at - self.verified_at).total_seconds())


class IncidentTimelineEvent(models.Model):
    """One entry in the handling history of a report or a canonical incident.

    Append-only by convention: entries record what personnel did and are never
    edited afterwards.
    """

    class EventType(models.TextChoices):
        REPORT_SUBMITTED = 'report_submitted', 'Report Submitted'
        STATUS_CHANGE = 'status_change', 'Status Change'
        VERIFICATION = 'verification', 'Verification'
        DISPATCH = 'dispatch', 'Dispatch Assignment'
        DUPLICATE_FLAGGED = 'duplicate_flagged', 'Duplicate Flagged'
        DUPLICATE_REVIEW = 'duplicate_review', 'Duplicate Review'
        REPORT_LINKED = 'report_linked', 'Report Linked To Incident'
        NOTE = 'note', 'Note'

    incident = models.ForeignKey(
        Incident, on_delete=models.CASCADE, blank=True, null=True,
        related_name='timeline_events',
    )
    report = models.ForeignKey(
        IncidentReport, on_delete=models.CASCADE, blank=True, null=True,
        related_name='timeline_events',
    )
    event_type = models.CharField(max_length=30, choices=EventType.choices)
    description = models.CharField(max_length=255)
    # Free-form supporting values (old/new status, distance compared, etc.).
    context = models.JSONField(blank=True, default=dict)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True,
        related_name='timeline_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['-created_at'])]

    def __str__(self):
        return f"{self.get_event_type_display()}: {self.description}"

    @property
    def subject_reference(self):
        if self.incident_id:
            return self.incident.reference_number
        if self.report_id:
            return self.report.reference_number
        return ''
