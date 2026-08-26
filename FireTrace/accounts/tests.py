"""Registration and login tests.

The privilege-escalation test below is the important one: public registration
creating civilians used to be convention rather than something enforced, and
`user_type` being writable meant any anonymous caller could hand themselves the
personnel dashboard.
"""

from django.test import TestCase
from rest_framework.test import APIClient

from .models import User


class RegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _register(self, **overrides):
        payload = {
            'username': 'juan@example.com',
            'email': 'juan@example.com',
            'password': 'sample-password-123',
        }
        payload.update(overrides)
        return self.client.post('/accounts/register', payload, format='json')

    def test_cannot_self_assign_bfp(self):
        """A client asking for BFP access must still come out a civilian."""
        response = self._register(user_type=User.UserType.BFP)

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='juan@example.com')
        self.assertEqual(user.user_type, User.UserType.CIVILIAN)
        # The response must not report back the elevated type either.
        self.assertEqual(response.data['user_type'], User.UserType.CIVILIAN)

    def test_defaults_to_civilian(self):
        self._register()
        self.assertEqual(
            User.objects.get(username='juan@example.com').user_type,
            User.UserType.CIVILIAN,
        )

    def test_first_name_is_stored(self):
        """The signup form posts it; it used to be dropped without a word."""
        self._register(first_name='Juan Dela Cruz')
        self.assertEqual(
            User.objects.get(username='juan@example.com').first_name,
            'Juan Dela Cruz',
        )

    def test_username_is_folded_to_lowercase(self):
        """A phone keyboard capitalising the first letter must not matter."""
        self._register(username='Juan@Example.com', email='Juan@Example.com')

        user = User.objects.get()
        self.assertEqual(user.username, 'juan@example.com')
        self.assertEqual(user.email, 'juan@example.com')

    def test_duplicate_email_rejected_regardless_of_casing(self):
        self._register()
        response = self._register(username='JUAN@example.com', email='JUAN@example.com')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 1)


class LoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.post(
            '/accounts/register',
            {
                'username': 'juan@example.com',
                'email': 'juan@example.com',
                'password': 'sample-password-123',
            },
            format='json',
        )

    def test_login_folds_username(self):
        response = self.client.post(
            '/accounts/login',
            {'username': 'Juan@Example.com', 'password': 'sample-password-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user_type'], User.UserType.CIVILIAN)

    def test_login_with_email_when_it_differs_from_username(self):
        """A createsuperuser account has a plain username and its own email."""
        User.objects.create_user(
            username='admin',
            email='chief@bfp.example.com',
            password='sample-password-123',
        )

        response = self.client.post(
            '/accounts/login',
            {'username': 'chief@bfp.example.com', 'password': 'sample-password-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)

    def test_login_with_unfolded_username(self):
        """createsuperuser does not fold, so "Admin" must accept "admin"."""
        User.objects.create_user(username='Admin', password='sample-password-123')

        response = self.client.post(
            '/accounts/login',
            {'username': 'admin', 'password': 'sample-password-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)

    def test_unknown_identifier_still_rejected(self):
        response = self.client.post(
            '/accounts/login',
            {'username': 'nobody@example.com', 'password': 'sample-password-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)

    def test_wrong_password_still_rejected_for_known_email(self):
        """Resolving the identifier must not skip the password check."""
        User.objects.create_user(
            username='admin',
            email='chief@bfp.example.com',
            password='sample-password-123',
        )

        response = self.client.post(
            '/accounts/login',
            {'username': 'chief@bfp.example.com', 'password': 'wrong-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)

    def test_promoted_user_reports_bfp_on_login(self):
        """Promotion happens server-side; login must reflect it."""
        user = User.objects.get(username='juan@example.com')
        user.user_type = User.UserType.BFP
        user.save()

        response = self.client.post(
            '/accounts/login',
            {'username': 'juan@example.com', 'password': 'sample-password-123'},
            format='json',
        )

        self.assertEqual(response.data['user_type'], User.UserType.BFP)
