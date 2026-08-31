"""Tests for the administrative dashboard surface.

The shape of every payload here is a contract with a specific screen, so these
assert the fields those screens actually read rather than just a 200.
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from incidents.duplicates import flag_possible_duplicate
from incidents.models import (
    Incident,
    IncidentReport,
    IncidentTimelineEvent,
    LocationSource,
    WorkflowStatus,
)

from .models import AuditLog, SystemSetting

# Calapan City Hall, matching incidents/tests.py.
BASE_LAT = 13.411000
BASE_LNG = 121.180000

AUDIT_URL = '/api/dashboard/audit/'
OPERATIONAL_URL = '/api/dashboard/operational/'
REFERENCE_URL = '/api/dashboard/reference/'
SETTINGS_URL = '/api/dashboard/settings/'
EXPORT_URL = '/api/dashboard/backup/export/'
HEALTH_URL = '/api/dashboard/health/'


def make_report(reporter, **kwargs):
    kwargs.setdefault('incident_type', 'fire')
    kwargs.setdefault('description', 'Smoke from a two-storey house')
    kwargs.setdefault('barangay', 'Ibaba East')
    kwargs.setdefault('latitude', BASE_LAT)
    kwargs.setdefault('longitude', BASE_LNG)
    created_at = kwargs.pop('created_at', None)
    report = IncidentReport.objects.create(reporter=reporter, **kwargs)
    if created_at:
        # auto_now_add ignores assignment, so rewrite the column directly.
        IncidentReport.objects.filter(pk=report.pk).update(created_at=created_at)
        report.refresh_from_db()
    return report


class DashboardAPITestCase(APITestCase):
    """Two accounts, because every endpoint here has to refuse one of them."""

    def setUp(self):
        self.bfp = User.objects.create_user(
            username='chief@bfp.test', password='x', user_type=User.UserType.BFP,
        )
        self.civilian = User.objects.create_user(
            username='juan@example.test', password='x',
        )
        self.client.force_authenticate(user=self.bfp)


class PermissionTests(DashboardAPITestCase):
    """The portal's whole access story is IsBFPPersonnel, so check every door."""

    URLS = (AUDIT_URL, OPERATIONAL_URL, REFERENCE_URL, SETTINGS_URL, EXPORT_URL, HEALTH_URL)

    def test_civilian_is_refused_everywhere(self):
        self.client.force_authenticate(user=self.civilian)
        for url in self.URLS:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)

    def test_anonymous_is_refused_everywhere(self):
        self.client.force_authenticate(user=None)
        for url in self.URLS:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 401)

    def test_civilian_cannot_change_settings(self):
        self.client.force_authenticate(user=self.civilian)
        response = self.client.patch(SETTINGS_URL, {'duplicate_radius_m': 500})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(SystemSetting.load().duplicate_radius_m, 150)


class AuditLogViewTests(DashboardAPITestCase):
    def setUp(self):
        super().setUp()
        self.report = make_report(self.civilian)
        AuditLog.objects.create(
            actor=self.bfp,
            action=AuditLog.Action.STATUS_UPDATED,
            target_reference=self.report.reference_number,
            summary='FT moved from Submitted to Under Review',
        )
        AuditLog.objects.create(
            actor=self.civilian,
            action=AuditLog.Action.REPORT_SUBMITTED,
            target_reference=self.report.reference_number,
            summary='Report submitted from Ibaba East',
        )
        # System-raised: no actor, and lives on the timeline rather than the
        # audit log, which is exactly the row that must not go missing.
        IncidentTimelineEvent.objects.create(
            report=self.report,
            event_type=IncidentTimelineEvent.EventType.DUPLICATE_FLAGGED,
            description='Flagged as a possible duplicate',
            actor=None,
        )

    def test_merges_audit_entries_and_system_timeline_events(self):
        data = self.client.get(AUDIT_URL).data
        self.assertEqual(data['count'], 3)
        sources = {row['source'] for row in data['results']}
        self.assertEqual(sources, {'audit_log', 'timeline_event'})

    def test_personnel_timeline_events_are_not_listed_twice(self):
        """A personnel action writes both a timeline event and an audit entry."""
        IncidentTimelineEvent.objects.create(
            report=self.report,
            event_type=IncidentTimelineEvent.EventType.STATUS_CHANGE,
            description='FT moved from Submitted to Under Review',
            actor=self.bfp,
        )
        self.assertEqual(self.client.get(AUDIT_URL).data['count'], 3)

    def test_newest_first(self):
        results = self.client.get(AUDIT_URL).data['results']
        stamps = [row['created_at'] for row in results]
        self.assertEqual(stamps, sorted(stamps, reverse=True))

    def test_filter_by_actor(self):
        data = self.client.get(AUDIT_URL, {'actor': self.bfp.username}).data
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['actor_name'], self.bfp.username)

    def test_filter_by_system_actor_returns_only_system_rows(self):
        data = self.client.get(AUDIT_URL, {'actor': 'system'}).data
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['source'], 'timeline_event')

    def test_filter_by_action(self):
        data = self.client.get(
            AUDIT_URL, {'action': AuditLog.Action.REPORT_SUBMITTED}
        ).data
        self.assertEqual(data['count'], 1)

    def test_search_matches_summary_and_reference(self):
        # "Ibaba" is in one audit summary and is the barangay of the report the
        # system event hangs off, so the search reaches across both sources.
        self.assertEqual(self.client.get(AUDIT_URL, {'q': 'Ibaba'}).data['count'], 2)
        # A reference number only exists on the audit half.
        by_reference = self.client.get(
            AUDIT_URL, {'q': self.report.reference_number}
        ).data
        self.assertEqual(by_reference['count'], 2)
        self.assertEqual({row['source'] for row in by_reference['results']}, {'audit_log'})

    def test_search_that_matches_nothing_returns_nothing(self):
        self.assertEqual(self.client.get(AUDIT_URL, {'q': 'Zamboanga'}).data['count'], 0)

    def test_offset_and_limit_page_through_the_merged_list(self):
        first = self.client.get(AUDIT_URL, {'limit': 2}).data
        second = self.client.get(AUDIT_URL, {'limit': 2, 'offset': 2}).data

        self.assertEqual(len(first['results']), 2)
        self.assertEqual(len(second['results']), 1)
        self.assertEqual(second['count'], 3)
        # The page boundary must not drop or repeat a row.
        ids = [row['id'] for row in first['results'] + second['results']]
        self.assertEqual(len(set(ids)), 3)

    def test_limit_is_capped(self):
        self.assertEqual(self.client.get(AUDIT_URL, {'limit': 9999}).data['limit'], 200)

    def test_garbage_limit_falls_back_to_the_default(self):
        self.assertEqual(self.client.get(AUDIT_URL, {'limit': 'lots'}).data['limit'], 50)

    def test_days_window_excludes_older_entries(self):
        AuditLog.objects.filter(actor=self.civilian).update(
            created_at=timezone.now() - timedelta(days=40)
        )
        self.assertEqual(self.client.get(AUDIT_URL, {'days': 7}).data['count'], 2)

    def test_actor_and_action_options_are_offered_for_the_filters(self):
        data = self.client.get(AUDIT_URL).data
        self.assertIn('System', data['actors'])
        self.assertIn(self.bfp.username, data['actors'])
        self.assertIn(
            AuditLog.Action.SETTINGS_UPDATED,
            [action['value'] for action in data['actions']],
        )


class OperationalOverviewTests(DashboardAPITestCase):
    def test_daily_series_covers_every_day_including_empty_ones(self):
        make_report(self.civilian)
        data = self.client.get(OPERATIONAL_URL, {'days': 7}).data

        self.assertEqual(len(data['daily']), 7)
        self.assertEqual(sum(day['reports'] for day in data['daily']), 1)
        # Six quiet days must still be present, or the chart's axis lies.
        self.assertEqual(sum(1 for day in data['daily'] if day['reports'] == 0), 6)

    def test_unsupported_window_falls_back_to_seven_days(self):
        self.assertEqual(self.client.get(OPERATIONAL_URL, {'days': 3}).data['days'], 7)
        self.assertEqual(self.client.get(OPERATIONAL_URL, {'days': 'x'}).data['days'], 7)
        self.assertEqual(self.client.get(OPERATIONAL_URL, {'days': 30}).data['days'], 30)

    def test_rates_carry_their_sample_size(self):
        make_report(self.civilian, workflow_status=WorkflowStatus.RESOLVED)
        make_report(self.civilian)
        rates = {rate['key']: rate for rate in self.client.get(OPERATIONAL_URL).data['rates']}

        self.assertEqual(rates['reviewed']['count'], 1)
        self.assertEqual(rates['reviewed']['total'], 2)
        self.assertEqual(rates['reviewed']['percent'], 50)

    def test_percent_is_null_rather_than_zero_when_nothing_was_counted(self):
        """"No data" and "none of them" are different claims on a gauge."""
        rates = {rate['key']: rate for rate in self.client.get(OPERATIONAL_URL).data['rates']}
        self.assertIsNone(rates['reviewed']['percent'])
        self.assertEqual(rates['reviewed']['total'], 0)

    def test_map_coverage_counts_only_mappable_reports(self):
        make_report(self.civilian, location_source=LocationSource.MAP_PIN)
        make_report(self.civilian, location_source=LocationSource.BARANGAY_ONLY)
        # Grading happens in the serializer, so set it as the API would have.
        IncidentReport.objects.filter(
            location_source=LocationSource.MAP_PIN
        ).update(geocoding_confidence='high')
        IncidentReport.objects.filter(
            location_source=LocationSource.BARANGAY_ONLY
        ).update(geocoding_confidence='low')

        rates = {rate['key']: rate for rate in self.client.get(OPERATIONAL_URL).data['rates']}
        self.assertEqual(rates['map_coverage']['count'], 1)
        self.assertEqual(rates['map_coverage']['percent'], 50)

    def test_categories_with_no_reports_are_still_listed(self):
        make_report(self.civilian, incident_type='fire')
        by_type = {row['key']: row['count'] for row in self.client.get(OPERATIONAL_URL).data['by_type']}
        self.assertEqual(by_type['fire'], 1)
        self.assertEqual(by_type['vehicle'], 0)

    def test_response_times_report_their_sample(self):
        verified = timezone.now() - timedelta(minutes=10)
        Incident.objects.create(
            incident_type='fire',
            barangay='Ibaba East',
            latitude=BASE_LAT,
            longitude=BASE_LNG,
            verified_at=verified,
            dispatched_at=verified + timedelta(minutes=4),
        )
        times = self.client.get(OPERATIONAL_URL).data['response_times']
        self.assertEqual(times['dispatch_sample'], 1)
        self.assertEqual(times['average_dispatch_seconds'], 240)
        self.assertIsNone(times['average_resolution_seconds'])


class ReferenceDataTests(DashboardAPITestCase):
    def test_confidence_table_is_derived_from_the_real_grader(self):
        rows = self.client.get(REFERENCE_URL).data['confidence_grading']
        by_source = {(row['source'], row['accuracy_m']): row for row in rows}

        pinned = by_source[('Pinned on map', None)]
        self.assertEqual(pinned['grade'], 'High')
        self.assertTrue(pinned['mappable'])

        barangay_only = by_source[('Barangay only', None)]
        self.assertEqual(barangay_only['grade'], 'Low')
        self.assertFalse(barangay_only['mappable'])

    def test_barangays_come_from_the_reports_on_file(self):
        make_report(self.civilian, barangay='Ibaba East')
        make_report(self.civilian, barangay='Ibaba East')
        make_report(self.civilian, barangay='Lalud')

        barangays = {row['name']: row['reports'] for row in self.client.get(REFERENCE_URL).data['barangays']}
        self.assertEqual(barangays, {'Ibaba East': 2, 'Lalud': 1})

    def test_rules_report_the_values_currently_in_force(self):
        self.client.patch(SETTINGS_URL, {'duplicate_radius_m': 400})
        rules = {rule['key']: rule for rule in self.client.get(REFERENCE_URL).data['rules']}

        self.assertEqual(rules['duplicate_radius']['value'], '400 m')
        self.assertTrue(rules['duplicate_radius']['editable'])
        # The grading bands are not retunable, and must not offer to be.
        self.assertFalse(rules['geo_bands']['editable'])

    def test_vocabularies_are_the_model_choices(self):
        data = self.client.get(REFERENCE_URL).data
        self.assertIn(
            {'value': 'under_review', 'label': 'Under Review'},
            data['workflow_statuses'],
        )
        self.assertIn(
            {'value': 'possible_duplicate', 'label': 'Possible Duplicate'},
            data['duplicate_statuses'],
        )


class SystemSettingTests(DashboardAPITestCase):
    def test_first_read_seeds_from_the_django_settings(self):
        data = self.client.get(SETTINGS_URL).data
        self.assertEqual(data['duplicate_radius_m'], 150)
        self.assertEqual(data['duplicate_window_minutes'], 30)
        self.assertEqual(data['map_recent_hours'], 1)

    def test_limits_travel_with_the_payload(self):
        limits = self.client.get(SETTINGS_URL).data['limits']
        self.assertEqual(limits['duplicate_radius_m'], {'min': 25, 'max': 2000})
        self.assertEqual(limits['map_recent_hours']['choices'], [1, 6, 24])

    def test_update_persists_and_records_who_did_it(self):
        response = self.client.patch(SETTINGS_URL, {'duplicate_radius_m': 300})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['duplicate_radius_m'], 300)
        self.assertEqual(response.data['updated_by_name'], self.bfp.username)
        self.assertEqual(SystemSetting.load().duplicate_radius_m, 300)

    def test_update_is_audited_with_the_old_and_new_value(self):
        self.client.patch(SETTINGS_URL, {'duplicate_radius_m': 300})
        entry = AuditLog.objects.get(action=AuditLog.Action.SETTINGS_UPDATED)
        self.assertEqual(entry.actor, self.bfp)
        self.assertEqual(entry.context['changed']['duplicate_radius_m'], [150, 300])

    def test_a_no_op_save_writes_no_audit_entry(self):
        self.client.patch(SETTINGS_URL, {'duplicate_radius_m': 150})
        self.assertFalse(
            AuditLog.objects.filter(action=AuditLog.Action.SETTINGS_UPDATED).exists()
        )

    def test_out_of_range_values_are_rejected(self):
        for field, value in (
            ('duplicate_radius_m', 5),
            ('duplicate_radius_m', 50000),
            ('duplicate_window_minutes', 1),
            ('duplicate_window_minutes', 5000),
        ):
            with self.subTest(field=field, value=value):
                response = self.client.patch(SETTINGS_URL, {field: value})
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_map_window_must_be_one_the_map_actually_offers(self):
        """An unlisted default would be silently clamped away by the map."""
        self.assertEqual(self.client.patch(SETTINGS_URL, {'map_recent_hours': 5}).status_code, 400)
        self.assertEqual(self.client.patch(SETTINGS_URL, {'map_recent_hours': 6}).status_code, 200)

    def test_only_one_row_can_ever_exist(self):
        SystemSetting.objects.create(**SystemSetting.defaults())
        SystemSetting.objects.create(**SystemSetting.defaults())
        self.assertEqual(SystemSetting.objects.count(), 1)


class SettingsTakeEffectTests(TestCase):
    """The Settings page is only real if the rest of the system reads it."""

    def setUp(self):
        self.reporter = User.objects.create_user(username='juan@example.test', password='x')

    def _pair_140m_apart(self):
        # ~140 m north, inside the default 150 m radius and outside a 100 m one.
        first = make_report(self.reporter)
        second = make_report(self.reporter, latitude=BASE_LAT + 0.00126)
        return first, second

    def test_default_radius_flags_the_pair(self):
        _, second = self._pair_140m_apart()
        self.assertIsNotNone(flag_possible_duplicate(second))

    def test_tightening_the_radius_stops_the_flag(self):
        setting = SystemSetting.load()
        setting.duplicate_radius_m = 100
        setting.save()

        _, second = self._pair_140m_apart()
        self.assertIsNone(flag_possible_duplicate(second))

    def test_tightening_the_time_window_stops_the_flag(self):
        setting = SystemSetting.load()
        setting.duplicate_window_minutes = 5
        setting.save()

        first, second = self._pair_140m_apart()
        IncidentReport.objects.filter(pk=first.pk).update(
            created_at=timezone.now() - timedelta(minutes=20)
        )
        self.assertIsNone(flag_possible_duplicate(second))

    def test_map_window_default_follows_the_setting(self):
        bfp = User.objects.create_user(
            username='chief@bfp.test', password='x', user_type=User.UserType.BFP,
        )
        client = APIClient()
        client.force_authenticate(user=bfp)

        setting = SystemSetting.load()
        setting.map_recent_hours = 24
        setting.save()

        # The map's own clamp still applies: an unoffered value falls back to
        # the configured default rather than to the compiled-in one.
        self.assertEqual(client.get('/api/dashboard/map/').data['recent_hours'], 24)
        self.assertEqual(
            client.get('/api/dashboard/map/', {'hours': 99}).data['recent_hours'], 24
        )
        self.assertEqual(
            client.get('/api/dashboard/map/', {'hours': 6}).data['recent_hours'], 6
        )


class BackupExportTests(DashboardAPITestCase):
    def setUp(self):
        super().setUp()
        self.report = make_report(self.civilian)

    def test_export_carries_the_operational_record(self):
        data = self.client.get(EXPORT_URL).data
        self.assertEqual(data['meta']['counts']['reports'], 1)
        self.assertEqual(data['meta']['generated_by'], self.bfp.username)
        self.assertEqual(data['reports'][0]['reference_number'], self.report.reference_number)

    def test_export_never_carries_a_password_hash(self):
        data = self.client.get(EXPORT_URL).data
        self.assertTrue(data['users'])
        for user in data['users']:
            self.assertNotIn('password', user)

    def test_export_is_offered_as_a_download(self):
        response = self.client.get(EXPORT_URL)
        self.assertIn('attachment;', response['Content-Disposition'])

    def test_export_is_audited(self):
        self.client.get(EXPORT_URL)
        entry = AuditLog.objects.get(action=AuditLog.Action.DATA_EXPORTED)
        self.assertEqual(entry.actor, self.bfp)
        self.assertEqual(entry.context['reports'], 1)

    def test_there_is_no_restore_endpoint(self):
        """Restoring is a platform operation, not a web form. Keep it that way."""
        self.assertEqual(self.client.post(EXPORT_URL, {}).status_code, 405)
        self.assertEqual(self.client.post('/api/dashboard/backup/restore/', {}).status_code, 404)


class SystemHealthTests(DashboardAPITestCase):
    def test_reports_the_components_the_page_renders(self):
        data = self.client.get(HEALTH_URL).data
        keys = {component['key'] for component in data['components']}
        self.assertEqual(
            keys,
            {
                'application_server',
                'database',
                'channel_layer',
                'photo_storage',
                'mapping_service',
            },
        )

    def test_every_component_says_how_it_was_determined(self):
        for component in self.client.get(HEALTH_URL).data['components']:
            with self.subTest(component=component['key']):
                self.assertIn(component['check'], ('live', 'config'))
                self.assertIn(component['status'], ('operational', 'degraded', 'down'))

    def test_overall_is_the_worst_component(self):
        data = self.client.get(HEALTH_URL).data
        ranking = {'operational': 0, 'degraded': 1, 'down': 2}
        worst = max(ranking[component['status']] for component in data['components'])
        self.assertEqual(ranking[data['overall']], worst)

    def test_record_counts_are_real(self):
        make_report(self.civilian)
        self.assertEqual(self.client.get(HEALTH_URL).data['record_counts']['reports'], 1)

    def test_no_invented_metrics(self):
        """A number this process cannot observe must not appear at all."""
        data = self.client.get(HEALTH_URL).data
        for absent in ('uptime', 'error_rate', 'cpu', 'memory', 'disk'):
            self.assertNotIn(absent, data)
