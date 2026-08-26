"""Spatial-temporal duplicate flagging.

The rule is deliberately simple and inspectable: two reports are *possible*
duplicates when they are within ``DUPLICATE_RADIUS_METERS`` of each other
(great-circle distance) AND were submitted within
``DUPLICATE_TIME_WINDOW_MINUTES`` of each other. Both conditions must hold.

What this module does NOT do, by design:

* it never merges two reports,
* it never deletes a report,
* it never changes a workflow status,
* it never decides anything on a person's behalf.

The only outcome is a ``POSSIBLE`` flag plus the two measurements that produced
it, so BFP personnel can see the reasoning and rule on it themselves.
"""

import math
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import DuplicateStatus, IncidentReport, IncidentTimelineEvent

EARTH_RADIUS_M = 6371008.8


def haversine_meters(lat1, lon1, lat2, lon2):
    """Great-circle distance between two WGS84 points, in metres."""
    phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
    d_phi = phi2 - phi1
    d_lambda = math.radians(float(lon2) - float(lon1))

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _thresholds():
    return (
        getattr(settings, 'DUPLICATE_RADIUS_METERS', 150),
        getattr(settings, 'DUPLICATE_TIME_WINDOW_MINUTES', 30),
    )


def find_duplicate_candidates(report):
    """Reports matching ``report`` on both the distance and time rules.

    Returns a list of ``(candidate, distance_m, time_delta_seconds)`` sorted
    nearest-first. Never includes the report itself.
    """
    radius_m, window_minutes = _thresholds()
    submitted_at = report.created_at or timezone.now()
    window = timedelta(minutes=window_minutes)

    # Cheap bounding box first so Haversine only runs on plausible rows. One
    # degree of latitude is ~111.32 km; longitude shrinks by cos(latitude).
    lat = float(report.latitude)
    lon = float(report.longitude)
    lat_delta = radius_m / 111320.0
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    lon_delta = radius_m / (111320.0 * cos_lat)

    nearby = (
        IncidentReport.objects.exclude(pk=report.pk)
        .filter(
            created_at__gte=submitted_at - window,
            created_at__lte=submitted_at + window,
            latitude__gte=lat - lat_delta,
            latitude__lte=lat + lat_delta,
            longitude__gte=lon - lon_delta,
            longitude__lte=lon + lon_delta,
        )
        .order_by('created_at')
    )

    matches = []
    for candidate in nearby:
        distance = haversine_meters(lat, lon, candidate.latitude, candidate.longitude)
        if distance > radius_m:
            continue
        delta = int(abs((submitted_at - candidate.created_at).total_seconds()))
        matches.append((candidate, distance, delta))

    matches.sort(key=lambda match: match[1])
    return matches


def flag_possible_duplicate(report):
    """Flag ``report`` if an earlier report matches the rule.

    Returns the matched candidate, or ``None``. Only ever touches the
    duplicate-review dimension; the workflow status is left alone. A report a
    person has already ruled on is never re-flagged.
    """
    if report.duplicate_status in (DuplicateStatus.KEPT_SEPARATE, DuplicateStatus.CONFIRMED):
        return None

    matches = find_duplicate_candidates(report)
    if not matches:
        return None

    candidate, distance, delta = matches[0]
    radius_m, window_minutes = _thresholds()

    report.duplicate_status = DuplicateStatus.POSSIBLE
    report.duplicate_of = candidate
    report.duplicate_distance_m = round(distance, 1)
    report.duplicate_time_delta_seconds = delta
    report.save(
        update_fields=[
            'duplicate_status',
            'duplicate_of',
            'duplicate_distance_m',
            'duplicate_time_delta_seconds',
            'updated_at',
        ]
    )

    IncidentTimelineEvent.objects.create(
        report=report,
        event_type=IncidentTimelineEvent.EventType.DUPLICATE_FLAGGED,
        description=(
            f"Flagged as a possible duplicate of {candidate.reference_number} "
            f"({round(distance)} m apart, {delta // 60} min apart)"
        ),
        context={
            'candidate_id': candidate.id,
            'candidate_reference': candidate.reference_number,
            'distance_m': round(distance, 1),
            'time_delta_seconds': delta,
            'rule': {
                'radius_m': radius_m,
                'window_minutes': window_minutes,
            },
        },
        # No actor: the system raised the flag, a person still has to rule on it.
        actor=None,
    )
    return candidate
