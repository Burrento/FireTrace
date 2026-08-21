"""Write-side helpers shared by the incident views.

Every personnel action that changes a record goes through ``record_activity``
so the incident timeline and the personnel audit trail can never drift apart.
"""

from analytics.models import AuditLog

from .models import IncidentTimelineEvent


def record_activity(
    *,
    actor,
    action,
    summary,
    event_type,
    report=None,
    incident=None,
    context=None,
):
    """Write one timeline event and its matching audit entry.

    ``action`` is an ``AuditLog.Action``; ``event_type`` is an
    ``IncidentTimelineEvent.EventType``. Both are required because the two
    vocabularies are intentionally different -- the timeline describes the
    incident's history, the audit log describes who did what.
    """
    context = context or {}
    subject = incident or report

    event = IncidentTimelineEvent.objects.create(
        incident=incident,
        report=report,
        event_type=event_type,
        description=summary,
        context=context,
        actor=actor,
    )

    AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type='Incident' if incident else 'IncidentReport' if report else '',
        target_id=subject.id if subject else None,
        target_reference=subject.reference_number if subject else '',
        summary=summary,
        context=context,
    )

    return event
