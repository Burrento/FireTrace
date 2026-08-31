"""Profile editing, password change and account administration.

The recurring theme is that none of these screens may become a second route to
BFP access. ``user_type`` is read-only on the profile, promotion happens only
through the personnel-only admin endpoint, and that endpoint refuses to let an
operator strand themselves.
"""

from rest_framework.test import APITestCase

from analytics.models import AuditLog

from .models import User

ME_URL = '/accounts/me'
PASSWORD_URL = '/accounts/me/password'
USERS_URL = '/accounts/users'


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='juan@example.com',
            email='juan@example.com',
            password='sample-password-123',
            first_name='Juan',
        )
        self.client.force_authenticate(user=self.user)

    def test_me_returns_the_editable_contact_fields(self):
        data = self.client.get(ME_URL).data
        self.assertEqual(data['username'], 'juan@example.com')
        self.assertEqual(data['first_name'], 'Juan')
        self.assertIn('phone_number', data)
        self.assertIn('alternate_phone_number', data)

    def test_can_update_own_name_and_numbers(self):
        response = self.client.patch(
            ME_URL,
            {
                'first_name': 'Juan Carlos',
                'last_name': 'Dela Cruz',
                'phone_number': '0917 555 0101',
                'alternate_phone_number': '+63 43 288 1234',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Juan Carlos')
        self.assertEqual(self.user.phone_number, '0917 555 0101')
        self.assertEqual(self.user.alternate_phone_number, '+63 43 288 1234')

    def test_cannot_promote_self_through_the_profile(self):
        """The profile form must not be a second privilege-escalation route."""
        response = self.client.patch(
            ME_URL, {'user_type': User.UserType.BFP}, format='json'
        )
        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertEqual(self.user.user_type, User.UserType.CIVILIAN)

    def test_username_and_email_are_not_editable_here(self):
        """They are the login identity; letting them drift locks people out."""
        self.client.patch(
            ME_URL,
            {'username': 'someone.else@example.com', 'email': 'other@example.com'},
            format='json',
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'juan@example.com')
        self.assertEqual(self.user.email, 'juan@example.com')

    def test_anonymous_cannot_read_a_profile(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(ME_URL).status_code, 401)


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='juan@example.com', password='sample-password-123',
        )
        self.client.force_authenticate(user=self.user)

    def _change(self, current='sample-password-123', new='replacement-password-456'):
        return self.client.post(
            PASSWORD_URL,
            {'current_password': current, 'new_password': new},
            format='json',
        )

    def test_password_is_changed(self):
        self.assertEqual(self._change().status_code, 204)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('replacement-password-456'))

    def test_wrong_current_password_is_refused(self):
        """An access token left on a shared phone must not be enough."""
        response = self._change(current='not-the-password')
        self.assertEqual(response.status_code, 400)
        self.assertIn('current_password', response.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('sample-password-123'))

    def test_weak_password_is_refused(self):
        response = self._change(new='123')
        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.data)

    def test_reusing_the_current_password_is_refused(self):
        response = self._change(new='sample-password-123')
        self.assertEqual(response.status_code, 400)

    def test_change_is_audited(self):
        self._change()
        entry = AuditLog.objects.get(action=AuditLog.Action.ACCOUNT_UPDATED)
        self.assertEqual(entry.actor, self.user)
        self.assertEqual(entry.target_reference, 'juan@example.com')

    def test_anonymous_cannot_change_a_password(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self._change().status_code, 401)


class UserAdministrationTests(APITestCase):
    def setUp(self):
        self.bfp = User.objects.create_user(
            username='chief@bfp.test', password='x', user_type=User.UserType.BFP,
        )
        self.other_bfp = User.objects.create_user(
            username='duty@bfp.test', password='x', user_type=User.UserType.BFP,
        )
        self.civilian = User.objects.create_user(
            username='juan@example.com', password='x', first_name='Juan',
        )
        self.client.force_authenticate(user=self.bfp)

    def detail_url(self, user):
        return f'{USERS_URL}/{user.id}'

    def test_lists_every_account(self):
        data = self.client.get(USERS_URL).data
        usernames = {row['username'] for row in data}
        self.assertEqual(
            usernames, {'chief@bfp.test', 'duty@bfp.test', 'juan@example.com'}
        )

    def test_rows_carry_the_reporter_s_report_count(self):
        from incidents.models import IncidentReport

        IncidentReport.objects.create(
            reporter=self.civilian,
            incident_type='fire',
            description='Smoke',
            barangay='Ibaba East',
            latitude=13.411,
            longitude=121.18,
        )
        rows = {row['username']: row for row in self.client.get(USERS_URL).data}
        self.assertEqual(rows['juan@example.com']['report_count'], 1)
        self.assertEqual(rows['chief@bfp.test']['report_count'], 0)

    def test_civilian_cannot_read_the_user_list(self):
        """This is the one endpoint exposing one civilian's details to another."""
        self.client.force_authenticate(user=self.civilian)
        self.assertEqual(self.client.get(USERS_URL).status_code, 403)
        self.assertEqual(self.client.get(self.detail_url(self.bfp)).status_code, 403)

    def test_filter_by_role_and_status(self):
        self.assertEqual(len(self.client.get(USERS_URL, {'user_type': 'bfp'}).data), 2)
        self.assertEqual(
            len(self.client.get(USERS_URL, {'user_type': 'civilian'}).data), 1
        )

        self.civilian.is_active = False
        self.civilian.save(update_fields=['is_active'])
        self.assertEqual(len(self.client.get(USERS_URL, {'is_active': 'false'}).data), 1)

    def test_search_matches_name_and_username(self):
        self.assertEqual(len(self.client.get(USERS_URL, {'q': 'Juan'}).data), 1)
        self.assertEqual(len(self.client.get(USERS_URL, {'q': 'bfp.test'}).data), 2)

    def test_promote_a_civilian_to_personnel(self):
        response = self.client.patch(
            self.detail_url(self.civilian),
            {'user_type': User.UserType.BFP},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

        self.civilian.refresh_from_db()
        self.assertEqual(self.civilian.user_type, User.UserType.BFP)

    def test_suspend_an_account(self):
        response = self.client.patch(
            self.detail_url(self.civilian), {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, 200)

        self.civilian.refresh_from_db()
        self.assertFalse(self.civilian.is_active)

    def test_change_is_audited_with_the_old_and_new_value(self):
        self.client.patch(
            self.detail_url(self.civilian),
            {'user_type': User.UserType.BFP},
            format='json',
        )
        entry = AuditLog.objects.get(action=AuditLog.Action.ACCOUNT_UPDATED)
        self.assertEqual(entry.actor, self.bfp)
        self.assertEqual(entry.target_reference, 'juan@example.com')
        self.assertEqual(entry.context['changed']['user_type'], ['civilian', 'bfp'])

    def test_a_no_op_update_writes_no_audit_entry(self):
        self.client.patch(
            self.detail_url(self.civilian),
            {'user_type': User.UserType.CIVILIAN},
            format='json',
        )
        self.assertFalse(AuditLog.objects.exists())

    def test_cannot_demote_yourself(self):
        """An operator who did could not reach this page to undo it."""
        response = self.client.patch(
            self.detail_url(self.bfp),
            {'user_type': User.UserType.CIVILIAN},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

        self.bfp.refresh_from_db()
        self.assertEqual(self.bfp.user_type, User.UserType.BFP)

    def test_cannot_deactivate_yourself(self):
        response = self.client.patch(
            self.detail_url(self.bfp), {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, 403)

        self.bfp.refresh_from_db()
        self.assertTrue(self.bfp.is_active)

    def test_can_still_demote_another_operator(self):
        response = self.client.patch(
            self.detail_url(self.other_bfp),
            {'user_type': User.UserType.CIVILIAN},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_a_non_superuser_cannot_touch_a_superuser(self):
        """The admin is the recovery route when the portal goes wrong."""
        root = User.objects.create_superuser(
            username='root', password='x', user_type=User.UserType.BFP,
        )
        response = self.client.patch(
            self.detail_url(root), {'is_active': False}, format='json',
        )
        self.assertEqual(response.status_code, 403)

        root.refresh_from_db()
        self.assertTrue(root.is_active)

    def test_identifying_fields_cannot_be_rewritten_here(self):
        """This page grants and withdraws access; it does not edit people."""
        self.client.patch(
            self.detail_url(self.civilian),
            {'username': 'hijacked@example.com', 'email': 'hijacked@example.com'},
            format='json',
        )
        self.civilian.refresh_from_db()
        self.assertEqual(self.civilian.username, 'juan@example.com')
