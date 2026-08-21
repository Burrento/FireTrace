"""Tests for the four domain rules the dashboard depends on."""

from datetime import timedelta

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User

from .duplicates import find_duplicate_candidates, flag_possible_duplicate, haversine_meters
from .geocoding import derive_confidence
from .models import (
    DuplicateStatus,
    GeocodingConfidence,
    Incident,
    IncidentReport,
    LocationSource,
    WorkflowStatus,
)

# Calapan City Hall, near enough for a fixed reference point.
BASE_LAT = 13.411000
BASE_LNG = 121.180000


def make_report(reporter, lat=BASE_LAT, lng=BASE_LNG, created_at=None, **kwargs):
    report = IncidentReport.objects.create(
        reporter=reporter,
        incident_type='fire',
        description='Smoke from a two-storey house',
        barangay='Ibaba East',
        latitude=lat,
        longitude=lng,
        location_confirmed=True,
        **kwargs,
    )
    if created_at:
        # auto_now_add ignores assignment, so rewrite the column directly.
        IncidentReport.objects.filter(pk=report.pk).update(created_at=created_at)
        report.refresh_from_db()
    return report


class HaversineTests(TestCase):
    def test_known_distance(self):
        # One degree of latitude is ~111.2 km anywhere on the globe.
        distance = haversine_meters(13.0, 121.0, 14.0, 121.0)
        self.assertAlmostEqual(distance, 111195, delta=200)

    def test_zero_distance(self):
        self.assertEqual(haversine_meters(BASE_LAT, BASE_LNG, BASE_LAT, BASE_LNG), 0)


@override_settings(DUPLICATE_RADIUS_METERS=150, DUPLICATE_TIME_WINDOW_MINUTES=30)
class DuplicateFlaggingTests(TestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(username='civ@example.com', password='pw')
        self.original = make_report(self.reporter)

    def test_flags_report_inside_both_thresholds(self):
        # ~55 m north of the original, submitted moments later.
        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)

        candidate = flag_possible_duplicate(nearby)
        nearby.refresh_from_db()

        self.assertEqual(candidate, self.original)
        self.assertEqual(nearby.duplicate_status, DuplicateStatus.POSSIBLE)
        self.assertEqual(nearby.duplicate_of, self.original)
        self.assertLess(nearby.duplicate_distance_m, 150)

    def test_ignores_report_outside_radius(self):
        # ~1.1 km away: inside the time window, outside the distance rule.
        far = make_report(self.reporter, lat=BASE_LAT + 0.01)

        self.assertIsNone(flag_possible_duplicate(far))
        far.refresh_from_db()
        self.assertEqual(far.duplicate_status, DuplicateStatus.NOT_FLAGGED)

    def test_ignores_report_outside_time_window(self):
        # Same spot, two hours later: inside the distance rule, outside time.
        later = make_report(
            self.reporter, created_at=timezone.now() + timedelta(hours=2),
        )

        self.assertIsNone(flag_possible_duplicate(later))
        later.refresh_from_db()
        self.assertEqual(later.duplicate_status, DuplicateStatus.NOT_FLAGGED)

    def test_requires_both_conditions(self):
        # Far away AND long ago — neither condition holds.
        unrelated = make_report(
            self.reporter, lat=BASE_LAT + 0.05,
            created_at=timezone.now() + timedelta(hours=5),
        )
        self.assertEqual(find_duplicate_candidates(unrelated), [])

    def test_never_merges_or_deletes(self):
        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)
        flag_possible_duplicate(nearby)

        # Both records still exist, independently, with their content intact.
        self.assertEqual(IncidentReport.objects.count(), 2)
        self.original.refresh_from_db()
        nearby.refresh_from_db()
        self.assertEqual(self.original.description, nearby.description)
        self.assertIsNotNone(self.original.pk)

    def test_does_not_touch_workflow_status(self):
        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)
        flag_possible_duplicate(nearby)
        nearby.refresh_from_db()

        # Flagging is a duplicate-dimension act only.
        self.assertEqual(nearby.workflow_status, WorkflowStatus.SUBMITTED)

    def test_does_not_re_flag_a_decided_report(self):
        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)
        nearby.duplicate_status = DuplicateStatus.KEPT_SEPARATE
        nearby.save()

        self.assertIsNone(flag_possible_duplicate(nearby))
        nearby.refresh_from_db()
        self.assertEqual(nearby.duplicate_status, DuplicateStatus.KEPT_SEPARATE)


class StatusSeparationTests(TestCase):
    """Workflow status and duplicate status must move independently."""

    def setUp(self):
        self.reporter = User.objects.create_user(username='civ2@example.com', password='pw')

    def test_every_combination_is_representable(self):
        report = make_report(self.reporter)

        report.workflow_status = WorkflowStatus.RESOLVED
        report.duplicate_status = DuplicateStatus.CONFIRMED
        report.save()
        report.refresh_from_db()

        # A confirmed duplicate that was also resolved is a legitimate state.
        self.assertEqual(report.workflow_status, WorkflowStatus.RESOLVED)
        self.assertEqual(report.duplicate_status, DuplicateStatus.CONFIRMED)

    def test_workflow_change_leaves_duplicate_status_alone(self):
        report = make_report(self.reporter, duplicate_status=DuplicateStatus.POSSIBLE)
        report.workflow_status = WorkflowStatus.UNDER_REVIEW
        report.save()
        report.refresh_from_db()

        self.assertEqual(report.duplicate_status, DuplicateStatus.POSSIBLE)


class GeocodingConfidenceTests(TestCase):
    @override_settings(GEO_HIGH_ACCURACY_M=50, GEO_MEDIUM_ACCURACY_M=200)
    def test_grading(self):
        cases = [
            (LocationSource.MAP_PIN, None, GeocodingConfidence.HIGH),
            (LocationSource.DEVICE_GPS, 20, GeocodingConfidence.HIGH),
            (LocationSource.DEVICE_GPS, 50, GeocodingConfidence.HIGH),
            (LocationSource.DEVICE_GPS, 120, GeocodingConfidence.MEDIUM),
            (LocationSource.DEVICE_GPS, 500, GeocodingConfidence.LOW),
            (LocationSource.DEVICE_GPS, None, GeocodingConfidence.MEDIUM),
            (LocationSource.GEOCODED_ADDRESS, None, GeocodingConfidence.MEDIUM),
            (LocationSource.BARANGAY_ONLY, None, GeocodingConfidence.LOW),
        ]
        for source, accuracy, expected in cases:
            with self.subTest(source=source, accuracy=accuracy):
                self.assertEqual(derive_confidence(source, accuracy), expected)

    def test_missing_coordinates_are_low(self):
        self.assertEqual(
            derive_confidence(LocationSource.MAP_PIN, None, has_coordinates=False),
            GeocodingConfidence.LOW,
        )


class DashboardAPITests(APITestCase):
    def setUp(self):
        self.bfp = User.objects.create_user(
            username='bfp@example.com', password='pw', user_type=User.UserType.BFP,
        )
        self.civilian = User.objects.create_user(username='civ3@example.com', password='pw')

    def test_civilian_cannot_reach_the_dashboard(self):
        self.client.force_authenticate(self.civilian)
        for path in ('/api/dashboard/kpis/', '/api/dashboard/map/', '/api/reports/queue/'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 403)

    def test_kpi_cards_declare_which_record_type_they_count(self):
        self.client.force_authenticate(self.bfp)
        response = self.client.get('/api/dashboard/kpis/')

        self.assertEqual(response.status_code, 200)
        cards = {card['key']: card for card in response.data['cards']}
        self.assertEqual(
            set(cards),
            {'new_reports', 'under_review', 'duplicates', 'responding', 'resolved'},
        )
        self.assertEqual(cards['new_reports']['scope'], 'reports')
        self.assertEqual(cards['responding']['scope'], 'incidents')

    def test_map_withholds_low_confidence_reports(self):
        make_report(self.civilian, geocoding_confidence=GeocodingConfidence.HIGH)
        make_report(
            self.civilian, lat=BASE_LAT + 0.02,
            geocoding_confidence=GeocodingConfidence.LOW,
        )

        self.client.force_authenticate(self.bfp)
        response = self.client.get('/api/dashboard/map/')

        self.assertEqual(len(response.data['reports']), 1)
        self.assertEqual(response.data['withheld_low_confidence'], 1)

    def test_map_separates_reports_from_canonical_incidents(self):
        make_report(self.civilian, geocoding_confidence=GeocodingConfidence.HIGH)
        Incident.objects.create(
            incident_type='fire', barangay='Ibaba East',
            latitude=BASE_LAT, longitude=BASE_LNG,
            workflow_status=WorkflowStatus.RESPONDING,
        )

        self.client.force_authenticate(self.bfp)
        response = self.client.get('/api/dashboard/map/')

        self.assertEqual(response.data['reports'][0]['kind'], 'report')
        self.assertEqual(response.data['incidents'][0]['kind'], 'incident')

    def test_duplicate_review_records_a_ruling_without_deleting(self):
        original = make_report(self.civilian)
        duplicate = make_report(self.civilian, lat=BASE_LAT + 0.0005)
        flag_possible_duplicate(duplicate)

        self.client.force_authenticate(self.bfp)
        response = self.client.post(
            f'/api/reports/{duplicate.id}/duplicate-review/',
            {'duplicate_status': DuplicateStatus.CONFIRMED, 'note': 'Same house'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        duplicate.refresh_from_db()
        self.assertEqual(duplicate.duplicate_status, DuplicateStatus.CONFIRMED)
        self.assertEqual(duplicate.duplicate_reviewed_by, self.bfp)
        # The report survives its own duplicate ruling.
        self.assertTrue(IncidentReport.objects.filter(pk=duplicate.pk).exists())
        self.assertTrue(IncidentReport.objects.filter(pk=original.pk).exists())

    def test_duplicate_review_rejects_system_only_statuses(self):
        report = make_report(self.civilian)
        self.client.force_authenticate(self.bfp)

        response = self.client.post(
            f'/api/reports/{report.id}/duplicate-review/',
            {'duplicate_status': DuplicateStatus.POSSIBLE},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_verifying_reports_does_not_mark_them_duplicates(self):
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0005)

        self.client.force_authenticate(self.bfp)
        response = self.client.post(
            '/api/incidents/verify/',
            {'report_ids': [first.id, second.id], 'verification_note': 'Confirmed by station'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        first.refresh_from_db()
        second.refresh_from_db()
        # Both now evidence one canonical incident...
        self.assertEqual(first.incident_id, second.incident_id)
        self.assertIsNotNone(first.incident_id)
        # ...which is not the same claim as either being a duplicate.
        self.assertEqual(first.duplicate_status, DuplicateStatus.NOT_FLAGGED)
        self.assertEqual(second.duplicate_status, DuplicateStatus.NOT_FLAGGED)

    def test_submitting_a_report_flags_duplicates_and_logs_activity(self):
        make_report(self.civilian)
        self.client.force_authenticate(self.civilian)

        response = self.client.post(
            '/api/reports/',
            {
                'incident_type': 'fire',
                'description': 'Fire at the same block',
                'barangay': 'Ibaba East',
                'latitude': BASE_LAT + 0.0005,
                'longitude': BASE_LNG,
                'location_confirmed': True,
                'location_source': LocationSource.MAP_PIN,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = IncidentReport.objects.get(pk=response.data['id'])
        self.assertEqual(created.duplicate_status, DuplicateStatus.POSSIBLE)
        # Confidence is graded server-side from the capture method.
        self.assertEqual(created.geocoding_confidence, GeocodingConfidence.HIGH)
        self.assertTrue(created.timeline_events.exists())

    def test_client_cannot_assert_its_own_confidence(self):
        self.client.force_authenticate(self.civilian)
        response = self.client.post(
            '/api/reports/',
            {
                'incident_type': 'fire',
                'description': 'Rubbish fire',
                'barangay': 'Ibaba East',
                'latitude': BASE_LAT,
                'longitude': BASE_LNG,
                'location_confirmed': True,
                'location_source': LocationSource.BARANGAY_ONLY,
                'geocoding_confidence': GeocodingConfidence.HIGH,
            },
            format='json',
        )

        created = IncidentReport.objects.get(pk=response.data['id'])
        self.assertEqual(created.geocoding_confidence, GeocodingConfidence.LOW)

    def test_legacy_incidents_path_still_serves_reports(self):
        make_report(self.civilian)
        self.client.force_authenticate(self.civilian)

        response = self.client.get('/incidents/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        # The old `status` key the shipped app reads is still present.
        self.assertIn('status', response.data[0])
