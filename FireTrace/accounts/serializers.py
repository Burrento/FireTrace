from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # first_name is accepted: the signup form has always posted it, and
        # while it was absent here DRF dropped it silently, which is why the
        # dashboard greeting had no name to show and fell back to the username.
        fields = ('id', 'username', 'email', 'first_name', 'password', 'user_type')
        # Public registration creates civilians, and this is what enforces it.
        # While user_type was writable, anyone could POST user_type="bfp" and
        # grant themselves the whole personnel dashboard. Promotion to BFP is a
        # deliberate act performed through the admin or the shell, never
        # something the applicant gets to assert about themselves.
        read_only_fields = ('user_type',)

    # The username *is* the email address here, and email is case-insensitive in
    # practice while Django's username lookup is not. Store it folded so a phone
    # keyboard capitalising the first letter cannot lock someone out of their
    # own account. LoginSerializer folds the same way.
    def validate_username(self, value):
        value = value.strip().lower()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'user_type')


class LoginSerializer(TokenObtainPairSerializer):
    """Adds an opt-in long-lived refresh token to the standard JWT login."""

    remember_me = serializers.BooleanField(required=False, default=False, write_only=True)

    def validate(self, attrs):
        remember_me = attrs.pop('remember_me', False)

        # Accept either the username or the email address. For accounts made
        # through public registration the two are the same string, but a
        # superuser created with `createsuperuser` can have a plain username
        # and an unrelated email, and could otherwise never sign in here.
        #
        # Resolving to the *stored* username also covers casing: registration
        # folds usernames, `createsuperuser` does not, so "Admin" has to match
        # a typed "admin" without relying on the fold alone.
        submitted = attrs.get(self.username_field)
        if isinstance(submitted, str):
            submitted = submitted.strip().lower()
            match = (
                User.objects.filter(username__iexact=submitted).first()
                or User.objects.filter(email__iexact=submitted).first()
            )
            # No match falls through unchanged so authentication fails the
            # ordinary way -- a distinct error here would let a caller probe
            # which accounts exist.
            attrs[self.username_field] = match.username if match else submitted

        data = super().validate(attrs)

        # super() already built a token pair, but the refresh half needs a
        # longer expiry, so reissue it here.
        refresh = self.get_token(self.user)
        if remember_me:
            refresh.set_exp(lifetime=settings.REMEMBER_ME_REFRESH_LIFETIME)

        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        # Saves the frontend a follow-up /accounts/me call just to route by role.
        data['user_type'] = self.user.user_type
        return data
