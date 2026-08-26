"""Populate the dashboard with realistic demo data.

    python manage.py seed_demo_data
    python manage.py seed_demo_data --reset --reports 40

Deliberately seeds three tight clusters of near-simultaneous nearby reports so
the duplicate rule actually fires and the review workflow has something to act
on. Everything it creates goes through the same code paths the live API uses,
so what the dashboard shows is real, not fabricated.

Demo accounts (password `firetrace123`):
    bfp@firetrace.test        BFP personnel  -> /bfp
    juan@firetrace.test       civilian       -> /dashboard
"""

import random
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from analytics.models import AuditLog
from incidents.duplicates import flag_possible_duplicate
from incidents.models import (
    GeocodingConfidence,
    Incident,
    IncidentReport,
    IncidentTimelineEvent,
    IncidentType,
    LocationSource,
    WorkflowStatus,
)
from incidents.services import record_activity

DEMO_PASSWORD = 'firetrace123'

# A few real Calapan barangays with rough centre points.
BARANGAY_POINTS = [
    ('Ibaba East', 13.4115, 121.1795),
    ('Ibaba West', 13.4102, 121.1760),
    ('Camilmil', 13.4055, 121.1820),
    ('Lalud', 13.4185, 121.1880),
    ('Sta. Isabel', 13.3990, 121.1750),
    ('Guinobatan', 13.4230, 121.1720),
    ('Balingayan', 13.3930, 121.2010),
    ('Canubing I', 13.3860, 121.1690),
]

DESCRIPTIONS = [
    'Thick smoke coming from the second floor of a wooden house.',
    'Parked tricycle caught fire near the market entrance.',
    'Sparks and burning smell from an electrical post.',
    'Grass fire spreading toward the houses along the river.',
    'Kitchen fire, neighbours are helping put it out.',
    'Fire visible from the highway, several people outside.',
]

# 1x1 transparent PNG. Enough for the queue's photo column to mean something
# without shipping binary fixtures.
TINY_PNG = bytes.fromhex(
    '89504e470d0a1a0a0000000d494844520000000100000001080600000'
    '01f15c4890000000a49444154789c6360000002000100' '05fe02fea7'
    'd4e2b90000000049454e44ae426082'
)


class Command(BaseCommand):
    help = 'Create demo users, reports, duplicates and canonical incidents.'

    def add_arguments(self, parser):
        parser.add_argument('--reports', type=int, default=24, help='How many reports to create.')
        parser.add_argument(
            '--reset', action='store_true',
            help='Delete existing reports, incidents, timeline events and audit entries first.',
        )

    def handle(self, *args, **options):
        random.seed(20260821)

        if options['reset']:
            AuditLog.objects.all().delete()
            IncidentTimelineEvent.objects.all().delete()
            IncidentReport.objects.all().delete()
            Incident.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared existing incident data.'))

        bfp = self._demo_user('bfp@firetrace.test', User.UserType.BFP)
        civilians = [
            self._demo_user('juan@firetrace.test', User.UserType.CIVILIAN),
            self._demo_user('maria@firetrace.test', User.UserType.CIVILIAN),
            self._demo_user('ana@firetrace.test', User.UserType.CIVILIAN),
        ]

        reports = self._create_reports(civilians, options['reports'])
        clusters = self._create_duplicate_clusters(civilians)
        flagged = sum(1 for report in reports + clusters if flag_possible_duplicate(report))

        incidents = self._verify_some(bfp, reports)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(reports) + len(clusters)} reports '
            f'({flagged} flagged as possible duplicates) and {len(incidents)} canonical incidents.'
        ))
        self.stdout.write(f'Sign in as bfp@firetrace.test / {DEMO_PASSWORD} and open /bfp')

    def _demo_user(self, username, user_type):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': username, 'user_type': user_type},
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.user_type = user_type
            user.save()
        return user

    def _make_report(self, reporter, barangay, lat, lng, minutes_ago, **overrides):
        """Create one report and backdate it, since created_at is auto_now_add."""
        source = overrides.pop('location_source', LocationSource.MAP_PIN)
        accuracy = overrides.pop('gps_accuracy_m', None)
        confidence = overrides.pop(
            'geocoding_confidence',
            GeocodingConfidence.HIGH if source == LocationSource.MAP_PIN else GeocodingConfidence.MEDIUM,
        )

        report = IncidentReport.objects.create(
            reporter=reporter,
            incident_type=overrides.pop('incident_type', random.choice(IncidentType.values)),
            description=overrides.pop('description', random.choice(DESCRIPTIONS)),
            barangay=barangay,
            address=f'Purok {random.randint(1, 6)}, {barangay}',
            latitude=round(lat, 6),
            longitude=round(lng, 6),
            location_confirmed=True,
            location_source=source,
            gps_accuracy_m=accuracy,
            geocoding_confidence=confidence,
            **overrides,
        )

        submitted_at = timezone.now() - timedelta(minutes=minutes_ago)
        IncidentReport.objects.filter(pk=report.pk).update(created_at=submitted_at)
        report.refresh_from_db()

        if random.random() < 0.45 and report.photo is not None:
            report.photo.save(f'demo-{report.pk}.png', ContentFile(TINY_PNG), save=True)

        record_activity(
            actor=reporter,
            action=AuditLog.Action.REPORT_SUBMITTED,
            event_type=IncidentTimelineEvent.EventType.REPORT_SUBMITTED,
            summary=f'Report {report.reference_number} submitted from {report.barangay}',
            report=report,
        )
        return report

    def _create_reports(self, civilians, count):
        reports = []
        for index in range(count):
            barangay, lat, lng = random.choice(BARANGAY_POINTS)
            # Scatter within roughly 400 m of the barangay centre.
            jitter = lambda: random.uniform(-0.004, 0.004)  # noqa: E731

            # A minority arrive as coarse GPS fixes; the low-confidence ones are
            # what the map withholds, which is worth showing in a demo.
            roll = random.random()
            if roll < 0.15:
                extras = {
                    'location_source': LocationSource.DEVICE_GPS,
                    'gps_accuracy_m': random.uniform(220, 600),
                    'geocoding_confidence': GeocodingConfidence.LOW,
                }
            elif roll < 0.4:
                extras = {
                    'location_source': LocationSource.DEVICE_GPS,
                    'gps_accuracy_m': random.uniform(60, 190),
                    'geocoding_confidence': GeocodingConfidence.MEDIUM,
                }
            else:
                extras = {}

            report = self._make_report(
                reporter=random.choice(civilians),
                barangay=barangay,
                lat=lat + jitter(),
                lng=lng + jitter(),
                minutes_ago=random.randint(5, 60 * 36),
                workflow_status=random.choices(
                    [WorkflowStatus.SUBMITTED, WorkflowStatus.UNDER_REVIEW, WorkflowStatus.RESOLVED],
                    weights=[6, 3, 2],
                )[0],
                **extras,
            )
            reports.append(report)
        return reports

    def _create_duplicate_clusters(self, civilians):
        """Several people reporting the same fire, minutes and metres apart."""
        clustered = []
        for barangay, lat, lng in random.sample(BARANGAY_POINTS, 3):
            base_minutes = random.randint(20, 300)
            for offset in range(random.randint(2, 3)):
                clustered.append(self._make_report(
                    reporter=random.choice(civilians),
                    barangay=barangay,
                    # ~30-80 m apart: inside the 150 m rule.
                    lat=lat + random.uniform(-0.0007, 0.0007),
                    lng=lng + random.uniform(-0.0007, 0.0007),
                    # Minutes apart: inside the 30 minute rule.
                    minutes_ago=base_minutes - offset * random.randint(3, 9),
                    description='Fire near the corner store, people are shouting outside.',
                    incident_type=IncidentType.RESIDENTIAL,
                ))
        return clustered

    def _verify_some(self, bfp, reports):
        """Promote a couple of reports into canonical incidents."""
        incidents = []
        for report in reports[:3]:
            now = timezone.now()
            incident = Incident.objects.create(
                incident_type=report.incident_type,
                description=report.description,
                barangay=report.barangay,
                address=report.address,
                latitude=report.latitude,
                longitude=report.longitude,
                workflow_status=random.choice([WorkflowStatus.RESPONDING, WorkflowStatus.RESOLVED]),
                verified_by=bfp,
                verification_note='Confirmed by responding unit on site.',
                verified_at=now - timedelta(minutes=random.randint(20, 90)),
            )
            assert incident.verified_at is not None
            incident.dispatched_at = incident.verified_at + timedelta(minutes=random.randint(3, 12))
            if incident.workflow_status == WorkflowStatus.RESOLVED:
                assert incident.dispatched_at is not None
                incident.resolved_at = incident.dispatched_at + timedelta(minutes=random.randint(25, 120))
            incident.save()

            record_activity(
                actor=bfp,
                action=AuditLog.Action.INCIDENT_VERIFIED,
                event_type=IncidentTimelineEvent.EventType.VERIFICATION,
                summary=f'Incident {incident.reference_number} verified in {incident.barangay}',
                incident=incident,
            )
            record_activity(
                actor=bfp,
                action=AuditLog.Action.DISPATCH_ASSIGNED,
                event_type=IncidentTimelineEvent.EventType.DISPATCH,
                summary=f'Unit dispatched to {incident.reference_number} ({incident.barangay})',
                incident=incident,
            )

            report.incident = incident
            report.workflow_status = WorkflowStatus.VERIFIED
            report.save(update_fields=['incident', 'workflow_status', 'updated_at'])
            record_activity(
                actor=bfp,
                action=AuditLog.Action.REPORT_LINKED,
                event_type=IncidentTimelineEvent.EventType.REPORT_LINKED,
                summary=f'{report.reference_number} linked to {incident.reference_number}',
                report=report,
            )
            incidents.append(incident)
        return incidents
