from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'user_type')

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
