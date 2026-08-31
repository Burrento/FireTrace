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
        # Administrative actions. These touch no incident, which is exactly why
        # they belong here and not on an incident timeline.
        SETTINGS_UPDATED = 'settings_updated', 'Settings Updated'
        ACCOUNT_UPDATED = 'account_updated', 'Account Updated'
        DATA_EXPORTED = 'data_exported', 'Data Exported'

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


class SystemSetting(models.Model):
    """The operational thresholds an administrator may change at runtime.

    Exactly one row, ``pk=1``. Its values are seeded from the ``settings.py``
    defaults the first time anything asks for them, so a deployment where
    nobody ever opens the Settings page behaves exactly as it did before this
    model existed -- the env vars remain the source of truth until a person
    deliberately overrides them.

    Only the rules that are safe to retune in the field live here. Anything
    that would change how a *stored* record is interpreted (the geocoding
    confidence bands) stays in ``settings.py``: re-grading history from a form
    would silently rewrite what past reports meant.
    """

    SINGLETON_PK = 1

    duplicate_radius_m = models.PositiveIntegerField()
    duplicate_window_minutes = models.PositiveIntegerField()
    map_recent_hours = models.PositiveIntegerField()

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, blank=True, null=True,
        related_name='setting_changes',
    )

    def __str__(self):
        return (
            f"Duplicates within {self.duplicate_radius_m} m / "
            f"{self.duplicate_window_minutes} min"
        )

    @classmethod
    def defaults(cls):
        return {
            'duplicate_radius_m': getattr(settings, 'DUPLICATE_RADIUS_METERS', 150),
            'duplicate_window_minutes': getattr(
                settings, 'DUPLICATE_TIME_WINDOW_MINUTES', 30
            ),
            'map_recent_hours': getattr(settings, 'MAP_RECENT_HOURS', 1),
        }

    @classmethod
    def load(cls):
        """The singleton, created from the ``settings.py`` defaults if absent."""
        instance, _ = cls.objects.get_or_create(
            pk=cls.SINGLETON_PK, defaults=cls.defaults(),
        )
        return instance

    def save(self, *args, **kwargs):
        # Forcing the pk is what makes this a singleton: a second row could
        # otherwise be created and the two would silently disagree about which
        # rule is in force.
        #
        # ``force_insert`` is dropped along with it, because ``objects.create()``
        # sets it. Left in place, a second create() would hit the primary key
        # that was just claimed and raise IntegrityError -- turning "there is
        # only ever one row" into a crash instead of an invariant.
        self.pk = self.SINGLETON_PK
        kwargs.pop('force_insert', None)
        super().save(*args, **kwargs)
