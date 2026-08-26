"""Descriptive operational intelligence.

Everything in this app answers "what happened", never "what will happen".
There is no forecasting, no risk scoring and no automated resource allocation
here by design -- those are explicitly out of scope for FireTrace.
"""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """A record of one action taken by a person in the system.

    Distinct from ``IncidentTimelineEvent``: the timeline is the history *of an
    incident*, while this is the history *of personnel activity*, including
    actions that touch no incident at all (logins, exports, account changes).
    """

    class Action(models.TextChoices):
        REPORT_SUBMITTED = 'report_submitted', 'Report Submitted'
        STATUS_UPDATED = 'status_updated', 'Status Updated'
        INCIDENT_VERIFIED = 'incident_verified', 'Incident Verified'
        DISPATCH_ASSIGNED = 'dispatch_assigned', 'Dispatch Assigned'
        DUPLICATE_REVIEWED = 'duplicate_reviewed', 'Duplicate Reviewed'
        REPORT_LINKED = 'report_linked', 'Report Linked To Incident'
        NOTE_ADDED = 'note_added', 'Note Added'

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True,
        related_name='audit_entries',
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    # Kept as loose strings rather than a generic relation so an entry survives
    # the deletion of whatever it referred to. An audit trail with holes in it
    # is not an audit trail.
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.PositiveIntegerField(blank=True, null=True)
    target_reference = models.CharField(max_length=40, blank=True)
    summary = models.CharField(max_length=255)
    context = models.JSONField(blank=True, default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['-created_at'])]

    def __str__(self):
        return f"{self.get_action_display()} - {self.summary}"
