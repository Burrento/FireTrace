"""Tests for the four domain rules the dashboard depends on."""

from datetime import timedelta
from tempfile import TemporaryDirectory

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from analytics.models import AuditLog

from .duplicates import (
    find_duplicate_candidates,
    flag_possible_duplicate,
    haversine_meters,
    related_reports,
)
from .geocoding import derive_confidence
from .models import (
    DuplicateStatus,
    GeocodingConfidence,
    Incident,
    IncidentReport,
    LocationSource,
    SourceChannel,
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

    def test_ignores_a_resolved_report(self):
        """A fire that is out cannot be duplicated by the next one.

        11:00pm a report comes in, personnel resolve it by 11:05. 11:10pm
        somebody reports a fire at the same address. That is a second fire (or
        a rekindle), not a second account of the first -- but it is inside both
        thresholds, so before this the system flagged it against a closed
        record and the new fire arrived pre-labelled as a copy.
        """
        self.original.workflow_status = WorkflowStatus.RESOLVED
        self.original.save(update_fields=['workflow_status'])

        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)

        self.assertIsNone(flag_possible_duplicate(nearby))
        nearby.refresh_from_db()
        self.assertEqual(nearby.duplicate_status, DuplicateStatus.NOT_FLAGGED)

    def test_ignores_a_rejected_report(self):
        """A false alarm described no fire, so nothing can duplicate it.

        This is the dangerous direction: a real fire reported minutes after a
        hoax at the same address would arrive flagged as a copy of the hoax.
        """
        self.original.workflow_status = WorkflowStatus.REJECTED
        self.original.save(update_fields=['workflow_status'])

        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)

        self.assertIsNone(flag_possible_duplicate(nearby))
        nearby.refresh_from_db()
        self.assertEqual(nearby.duplicate_status, DuplicateStatus.NOT_FLAGGED)

    def test_ignores_a_report_whose_incident_is_resolved(self):
        """Closed-ness follows the incident once a report is linked to one.

        A linked report keeps its own workflow_status -- the serializer reads
        the incident's instead, because the incident governs resolution. So a
        report can read Verified while the fire it described is out, and a
        status check on the report alone would still flag against it.
        """
        incident = Incident.objects.create(
            incident_type='fire',
            description='Two-storey house',
            barangay='Ibaba East',
            latitude=BASE_LAT,
            longitude=BASE_LNG,
            workflow_status=WorkflowStatus.RESOLVED,
            resolved_at=timezone.now(),
        )
        self.original.incident = incident
        self.original.workflow_status = WorkflowStatus.VERIFIED
        self.original.save(update_fields=['incident', 'workflow_status'])

        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)

        self.assertIsNone(flag_possible_duplicate(nearby))
        nearby.refresh_from_db()
        self.assertEqual(nearby.duplicate_status, DuplicateStatus.NOT_FLAGGED)

    def test_still_flags_against_an_ongoing_incident(self):
        """The rule is closed-ness, not linked-ness.

        A second call about a fire crews are still working is exactly what the
        flag is for, and linking the first report to an incident must not make
        it stop matching.
        """
        incident = Incident.objects.create(
            incident_type='fire',
            description='Two-storey house',
            barangay='Ibaba East',
            latitude=BASE_LAT,
            longitude=BASE_LNG,
            workflow_status=WorkflowStatus.RESPONDING,
        )
        self.original.incident = incident
        self.original.save(update_fields=['incident'])

        nearby = make_report(self.reporter, lat=BASE_LAT + 0.0005)

        self.assertEqual(flag_possible_duplicate(nearby), self.original)
        nearby.refresh_from_db()
        self.assertEqual(nearby.duplicate_status, DuplicateStatus.POSSIBLE)

    def test_related_returns_the_whole_chain_not_one_neighbour(self):
        """Three calls about one fire are one group, however they chained.

        Flagging is pairwise: the third report is flagged against the second,
        which was flagged against the first. Reading duplicate_of alone shows
        an operator one neighbour and hides the rest of the fire.
        """
        second = make_report(self.reporter, lat=BASE_LAT + 0.0004)
        flag_possible_duplicate(second)
        third = make_report(self.reporter, lat=BASE_LAT + 0.0008)
        flag_possible_duplicate(third)
        third.refresh_from_db()
        # Confirm the chain really is a chain, or this proves nothing.
        self.assertEqual(third.duplicate_of, second)

        for report, expected in (
            (self.original, {second, third}),
            (second, {self.original, third}),
            (third, {self.original, second}),
        ):
            with self.subTest(report=report.reference_number):
                self.assertEqual(set(related_reports(report)), expected)

    def test_related_excludes_the_report_itself(self):
        second = make_report(self.reporter, lat=BASE_LAT + 0.0004)
        flag_possible_duplicate(second)
        self.assertNotIn(self.original, related_reports(self.original))

    def test_related_is_empty_for_an_unflagged_report(self):
        lone = make_report(self.reporter, lat=BASE_LAT + 0.05)
        self.assertEqual(related_reports(lone), [])

    def test_related_includes_reports_grouped_by_a_person(self):
        """Consolidating part of a group must not split the view of it."""
        incident = Incident.objects.create(
            incident_type='fire', barangay='Ibaba East',
            latitude=BASE_LAT, longitude=BASE_LNG,
            workflow_status=WorkflowStatus.VERIFIED,
        )
        # Far enough apart that no flag ties them -- only the incident does.
        far = make_report(self.reporter, lat=BASE_LAT + 0.05, incident=incident)
        self.original.incident = incident
        self.original.save(update_fields=['incident'])

        self.assertIn(far, related_reports(self.original))

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

    def test_map_carries_reporter_contact_details(self):
        self.civilian.first_name, self.civilian.last_name = 'Juan', 'Dela Cruz'
        self.civilian.phone_number = '09171234567'
        self.civilian.save()
        make_report(self.civilian, geocoding_confidence=GeocodingConfidence.HIGH)

        self.client.force_authenticate(self.bfp)
        row = self.client.get('/api/dashboard/map/').data['reports'][0]

        self.assertEqual(row['reporter_name'], 'Juan Dela Cruz')
        self.assertEqual(row['reporter_phone'], '09171234567')

    def test_map_carries_a_photo_url_only_when_there_is_a_photo(self):
        """The popup shows the photograph, so the URL has to reach the map."""
        # A saved upload is not rolled back with the transaction, so give this
        # one a media root of its own rather than growing FireTrace/media/ by a
        # file on every run.
        with TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            with_photo = make_report(
                self.civilian, geocoding_confidence=GeocodingConfidence.HIGH,
            )
            with_photo.photo.save('fire.png', ContentFile(b'not-really-a-png'), save=True)
            make_report(
                self.civilian, lat=BASE_LAT + 0.001,
                geocoding_confidence=GeocodingConfidence.HIGH,
            )

            self.client.force_authenticate(self.bfp)
            response = self.client.get('/api/dashboard/map/')

        by_id = {row['id']: row for row in response.data['reports']}
        self.assertTrue(by_id[with_photo.id]['has_photo'])
        self.assertIn('fire', by_id[with_photo.id]['photo_url'])

        bare = next(row for row in response.data['reports'] if row['id'] != with_photo.id)
        self.assertFalse(bare['has_photo'])
        # None rather than '' so the popup can tell "none attached" apart from
        # "attached but the URL could not be built".
        self.assertIsNone(bare['photo_url'])

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

    def _consolidate(self, *reports, note='Confirmed by station'):
        self.client.force_authenticate(self.bfp)
        response = self.client.post(
            '/api/incidents/verify/',
            {'report_ids': [r.id for r in reports], 'verification_note': note},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_queue_shows_one_row_per_fire(self):
        """Three calls about one fire are one row, with the count behind it."""
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0004)
        flag_possible_duplicate(second)
        third = make_report(self.civilian, lat=BASE_LAT + 0.0008)
        flag_possible_duplicate(third)
        # An unrelated fire across town stays its own row.
        other = make_report(self.civilian, lat=BASE_LAT + 0.05)

        self.client.force_authenticate(self.bfp)
        data = self.client.get('/api/reports/queue/').data

        self.assertEqual(data['count'], 2)            # two fires
        self.assertEqual(data['reports_count'], 4)    # four reports
        rows = {r['id']: r for r in data['results']}
        # The newest of the group represents it.
        self.assertIn(third.id, rows)
        self.assertEqual(rows[third.id]['group_size'], 3)
        self.assertEqual(
            set(rows[third.id]['group_ids']), {first.id, second.id, third.id},
        )
        self.assertEqual(rows[other.id]['group_size'], 1)

    def test_grouping_alters_no_report(self):
        """The queue collapses rows; it must not touch the records."""
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0004)
        flag_possible_duplicate(second)
        before = [
            (r.pk, r.workflow_status, r.duplicate_status, r.incident_id)
            for r in IncidentReport.objects.order_by('pk')
        ]

        self.client.force_authenticate(self.bfp)
        self.client.get('/api/reports/queue/')

        after = [
            (r.pk, r.workflow_status, r.duplicate_status, r.incident_id)
            for r in IncidentReport.objects.order_by('pk')
        ]
        self.assertEqual(before, after)
        self.assertEqual(Incident.objects.count(), 0)
        self.assertEqual(first.id, IncidentReport.objects.earliest('created_at').id)

    def test_reports_consolidated_by_a_person_are_one_row_too(self):
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.05)  # no flag ties them
        self._consolidate(first, second)

        data = self.client.get('/api/reports/queue/').data

        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['group_size'], 2)

    def test_consolidated_incident_lists_the_reports_behind_it(self):
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0005)
        incident = self._consolidate(first, second)

        response = self.client.get(f"/api/incidents/{incident['id']}/")

        self.assertEqual(response.status_code, 200)
        refs = {r['reference_number'] for r in response.data['source_reports']}
        self.assertEqual(refs, {first.reference_number, second.reference_number})

    def test_incident_status_governs_every_report_linked_to_it(self):
        """One fire, one status. Changing the incident changes them all."""
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0005)
        incident = self._consolidate(first, second)

        response = self.client.post(
            f"/api/incidents/{incident['id']}/status/",
            {'workflow_status': WorkflowStatus.RESOLVED},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

        queue = self.client.get('/api/reports/queue/').data['results']
        for row in queue:
            with self.subTest(report=row['reference_number']):
                self.assertEqual(row['status'], WorkflowStatus.RESOLVED)
                # The report's own column is untouched, so separating it later
                # restores what the report said on its own.
                self.assertEqual(row['workflow_status'], WorkflowStatus.VERIFIED)

    def test_separating_a_report_returns_it_to_its_own_status(self):
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0005)
        incident = self._consolidate(first, second)
        self.client.post(
            f"/api/incidents/{incident['id']}/status/",
            {'workflow_status': WorkflowStatus.RESOLVED}, format='json',
        )

        response = self.client.post(
            f'/api/reports/{second.id}/link/', {'incident': None}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        second.refresh_from_db()
        self.assertIsNone(second.incident_id)
        # Unlinked, so it governs itself again -- at the status it actually had.
        self.assertEqual(second.governing, second)
        self.assertEqual(second.governing.workflow_status, WorkflowStatus.VERIFIED)
        # The one still attached continues to follow the incident.
        first.refresh_from_db()
        self.assertEqual(first.governing.workflow_status, WorkflowStatus.RESOLVED)

    def test_a_consolidation_of_one_report_can_be_undone(self):
        """Separating the last report must stay possible.

        It leaves an incident with nothing behind it, which is untidy -- but
        forbidding it makes a consolidation done by mistake impossible to
        reverse, and an operator who ticked one box wrongly has no way back.
        Reversibility wins.
        """
        only = make_report(self.civilian)
        self._consolidate(only)

        response = self.client.post(
            f'/api/reports/{only.id}/link/', {'incident': None}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        only.refresh_from_db()
        self.assertIsNone(only.incident_id)
        self.assertEqual(only.governing.workflow_status, WorkflowStatus.VERIFIED)

    def test_cannot_consolidate_a_report_that_is_already_linked(self):
        first = make_report(self.civilian)
        second = make_report(self.civilian, lat=BASE_LAT + 0.0005)
        self._consolidate(first)

        response = self.client.post(
            '/api/incidents/verify/', {'report_ids': [first.id, second.id]}, format='json',
        )

        # Re-pointing it silently would move it off its incident with no record
        # of where it came from.
        self.assertEqual(response.status_code, 400)
        self.assertIn('Separate them first', str(response.data))
        second.refresh_from_db()
        self.assertIsNone(second.incident_id)

    def test_a_linked_report_cannot_be_moved_on_its_own(self):
        first = make_report(self.civilian)
        self._consolidate(first)

        response = self.client.post(
            f'/api/reports/{first.id}/status/',
            {'workflow_status': WorkflowStatus.RESOLVED}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("incident's status", str(response.data))

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

    def test_personnel_can_reject_a_report_and_it_leaves_the_intake_counts(self):
        report = make_report(self.civilian)
        self.client.force_authenticate(self.bfp)

        response = self.client.post(
            f'/api/reports/{report.id}/status/', {'workflow_status': 'rejected'}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.workflow_status, WorkflowStatus.REJECTED)
        cards = {card['key']: card for card in self.client.get('/api/dashboard/kpis/').data['cards']}
        self.assertEqual(cards['new_reports']['value'], 0)
        self.assertEqual(cards['under_review']['value'], 0)

    def test_report_can_be_moved_and_unlinked_with_an_audit_trail(self):
        report = self._linked_report()
        second = Incident.objects.create(
            incident_type='fire', barangay='Ibaba East', latitude=BASE_LAT, longitude=BASE_LNG,
        )
        self.client.force_authenticate(self.bfp)

        moved = self.client.post(
            f'/api/reports/{report.id}/link/', {'incident': second.id, 'note': 'Different fire'}, format='json',
        )
        self.assertEqual(moved.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.incident, second)

        unlinked = self.client.post(f'/api/reports/{report.id}/link/', {'incident': None}, format='json')
        self.assertEqual(unlinked.status_code, 200)
        report.refresh_from_db()
        self.assertIsNone(report.incident)

        actions = set(
            AuditLog.objects.filter(target_type='IncidentReport', target_id=report.id)
            .values_list('action', flat=True)
        )
        self.assertEqual(actions, {AuditLog.Action.REPORT_LINKED, AuditLog.Action.REPORT_UNLINKED})

    def test_personnel_can_encode_a_hotline_report(self):
        self.client.force_authenticate(self.bfp)
        response = self.client.post('/api/reports/intake/', {
            'source_channel': 'hotline', 'caller_name': 'Maria Santos', 'caller_phone': '09181234567',
            'incident_type': 'fire', 'latitude': BASE_LAT, 'longitude': BASE_LNG,
            'location_confirmed': True, 'location_source': LocationSource.MAP_PIN,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        report = IncidentReport.objects.get()
        self.assertEqual(report.source_channel, SourceChannel.HOTLINE)
        self.assertEqual(report.reporter, self.bfp)
        row = self.client.get('/api/dashboard/map/').data['reports'][0]
        self.assertEqual(row['reporter_name'], 'Maria Santos')
        self.assertEqual(row['reporter_phone'], '09181234567')
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.REPORT_ENCODED).exists())

    def test_civilian_cannot_encode_or_claim_a_channel(self):
        payload = {
            'incident_type': 'fire', 'latitude': BASE_LAT, 'longitude': BASE_LNG,
            'location_confirmed': True, 'location_source': LocationSource.MAP_PIN,
            'source_channel': 'hotline',
        }
        self.client.force_authenticate(self.civilian)

        self.assertEqual(self.client.post('/api/reports/intake/', payload, format='json').status_code, 403)
        self.client.post('/api/reports/', payload, format='json')
        self.assertEqual(IncidentReport.objects.get().source_channel, SourceChannel.PWA)

    def test_reporter_notifications_come_from_real_updates_without_staff_notes(self):
        report = make_report(self.civilian)
        self.client.force_authenticate(self.bfp)
        self.client.post(
            f'/api/reports/{report.id}/status/',
            {'workflow_status': 'under_review', 'note': 'internal: check caller history'},
            format='json',
        )

        self.client.force_authenticate(self.civilian)
        rows = self.client.get('/api/reports/notifications/').data
        self.assertEqual(rows[0]['reference_number'], report.reference_number)
        self.assertEqual(rows[0]['message'], 'is now Under Review.')
        self.assertNotIn('internal', str(rows))

        stranger = User.objects.create_user(username='stranger@example.com', password='pw')
        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.get('/api/reports/notifications/').data, [])

    def _linked_report(self):
        incident = Incident.objects.create(
            incident_type='fire', barangay='Ibaba East',
            latitude=BASE_LAT, longitude=BASE_LNG,
            workflow_status=WorkflowStatus.RESPONDING,
        )
        return make_report(self.civilian, incident=incident)

    def test_linked_report_shows_the_incident_status_to_the_reporter(self):
        report = self._linked_report()
        self.client.force_authenticate(self.civilian)

        data = self.client.get(f'/api/reports/{report.id}/').data

        self.assertEqual(data['status'], WorkflowStatus.RESPONDING)
        self.assertEqual(data['status_display'], 'Responding')
        # The report's own workflow value is untouched and still visible.
        self.assertEqual(data['workflow_status'], WorkflowStatus.SUBMITTED)

    def test_linked_report_status_cannot_be_changed_directly(self):
        report = self._linked_report()
        self.client.force_authenticate(self.bfp)

        response = self.client.post(
            f'/api/reports/{report.id}/status/', {'workflow_status': 'resolved'}, format='json',
        )

        self.assertEqual(response.status_code, 400)
        report.refresh_from_db()
        self.assertEqual(report.workflow_status, WorkflowStatus.SUBMITTED)

    def _post_report_with_photo(self, photo):
        self.client.force_authenticate(self.civilian)
        return self.client.post(
            '/api/reports/',
            {
                'incident_type': 'fire',
                'latitude': BASE_LAT,
                'longitude': BASE_LNG,
                'location_confirmed': 'true',
                'location_source': LocationSource.MAP_PIN,
                'photo': photo,
            },
            format='multipart',
        )

    def test_photo_that_is_not_an_image_is_rejected(self):
        """The name and declared type say JPEG; the bytes decide."""
        fake = SimpleUploadedFile('fire.jpg', b'<?php echo 1; ?>', content_type='image/jpeg')
        response = self._post_report_with_photo(fake)
        self.assertEqual(response.status_code, 400)
        self.assertIn('photo', response.data)
        self.assertFalse(IncidentReport.objects.exists())

    def test_oversized_photo_is_rejected(self):
        big = SimpleUploadedFile(
            'fire.jpg', b'\xff\xd8\xff' + b'0' * (5 * 1024 * 1024), content_type='image/jpeg',
        )
        response = self._post_report_with_photo(big)
        self.assertEqual(response.status_code, 400)
        self.assertIn('photo', response.data)

    def test_jpeg_photo_is_accepted(self):
        with TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            jpeg = SimpleUploadedFile('fire.jpg', b'\xff\xd8\xff\xe0' + b'0' * 64, content_type='image/jpeg')
            response = self._post_report_with_photo(jpeg)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(IncidentReport.objects.get().has_photo)

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

    def test_report_without_description_or_barangay_is_accepted(self):
        self.client.force_authenticate(self.civilian)
        response = self.client.post(
            '/api/reports/',
            {
                'incident_type': 'fire',
                'latitude': BASE_LAT,
                'longitude': BASE_LNG,
                'location_confirmed': True,
                'location_source': LocationSource.DEVICE_GPS,
                'gps_accuracy_m': 10,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_legacy_incidents_path_still_serves_reports(self):
        make_report(self.civilian)
        self.client.force_authenticate(self.civilian)

        response = self.client.get('/incidents/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        # The old `status` key the shipped app reads is still present.
        self.assertIn('status', response.data[0])


class OngoingFireMapTests(APITestCase):
    """The one incident endpoint a civilian may read.

    Its whole job is to be narrower than the operations map, so the tests are
    about what it leaves out as much as what it returns.
    """

    def setUp(self):
        self.reporter = User.objects.create_user(username='brent@example.com', password='pw')
        self.other = User.objects.create_user(username='neighbour@example.com', password='pw')

    def test_requires_a_signed_in_user(self):
        self.assertEqual(self.client.get('/api/incidents/ongoing/').status_code, 401)

    def test_a_civilian_sees_someone_elses_verified_fire(self):
        # The point of the map: Brent reports, BFP verifies, the neighbourhood
        # can see it burning.
        make_report(
            self.reporter,
            workflow_status=WorkflowStatus.VERIFIED,
            geocoding_confidence=GeocodingConfidence.HIGH,
        )
        self.client.force_authenticate(self.other)

        response = self.client.get('/api/incidents/ongoing/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['fires'][0]['workflow_status'], 'verified')

    def test_unverified_and_resolved_fires_are_both_left_off(self):
        make_report(self.reporter, geocoding_confidence=GeocodingConfidence.HIGH)
        make_report(
            self.reporter, lat=BASE_LAT + 0.05,
            workflow_status=WorkflowStatus.UNDER_REVIEW,
            geocoding_confidence=GeocodingConfidence.HIGH,
        )
        make_report(
            self.reporter, lat=BASE_LAT + 0.06,
            workflow_status=WorkflowStatus.RESOLVED,
            geocoding_confidence=GeocodingConfidence.HIGH,
        )
        self.client.force_authenticate(self.other)

        response = self.client.get('/api/incidents/ongoing/')

        self.assertEqual(response.data['count'], 0)

    def test_an_ongoing_fire_never_ages_out(self):
        # Unlike the operations map, there is no time window here: a fire is on
        # this map until a person resolves it.
        make_report(
            self.reporter,
            created_at=timezone.now() - timedelta(days=3),
            workflow_status=WorkflowStatus.RESPONDING,
            geocoding_confidence=GeocodingConfidence.HIGH,
        )
        self.client.force_authenticate(self.other)

        self.assertEqual(self.client.get('/api/incidents/ongoing/').data['count'], 1)

    def test_nothing_about_the_reporter_or_their_photo_is_exposed(self):
        # A saved upload survives the test transaction, so it gets a media root
        # of its own rather than leaving a file behind on every run.
        with TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            report = make_report(
                self.reporter,
                workflow_status=WorkflowStatus.VERIFIED,
                geocoding_confidence=GeocodingConfidence.HIGH,
            )
            report.photo.save('fire.png', ContentFile(b'not-really-a-png'), save=True)
            self.client.force_authenticate(self.other)

            fire = self.client.get('/api/incidents/ongoing/').data['fires'][0]

        for leaked in ('reporter', 'description', 'photo_url', 'has_photo', 'address'):
            self.assertNotIn(leaked, fire)

    def test_a_report_attached_to_an_incident_is_drawn_once(self):
        incident = Incident.objects.create(
            incident_type='fire',
            barangay='Ibaba East',
            latitude=BASE_LAT,
            longitude=BASE_LNG,
            workflow_status=WorkflowStatus.RESPONDING,
        )
        make_report(
            self.reporter,
            incident=incident,
            workflow_status=WorkflowStatus.VERIFIED,
            geocoding_confidence=GeocodingConfidence.HIGH,
        )
        self.client.force_authenticate(self.other)

        response = self.client.get('/api/incidents/ongoing/')

        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['fires'][0]['kind'], 'incident')

    def test_low_confidence_coordinates_are_not_plotted(self):
        make_report(
            self.reporter,
            workflow_status=WorkflowStatus.VERIFIED,
            geocoding_confidence=GeocodingConfidence.LOW,
        )
        self.client.force_authenticate(self.other)

        self.assertEqual(self.client.get('/api/incidents/ongoing/').data['count'], 0)
