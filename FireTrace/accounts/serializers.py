from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'user_type')

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

        # Usernames are stored folded (see RegisterSerializer), so fold the
        # submitted one too — otherwise "Juan@..." fails against "juan@...".
        submitted = attrs.get(self.username_field)
        if isinstance(submitted, str):
            attrs[self.username_field] = submitted.strip().lower()

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
