from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User

# Marks a token as originating from a "Remember me" login. Not read back
# anywhere in the fixed-window design -- it is here so the origin of a
# session is visible when inspecting a token.
REMEMBER_CLAIM = 'remember_me'


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
    """Issues a longer-lived refresh token when "Remember me" is ticked.

    The access token keeps its normal short lifetime either way -- only the
    refresh token's window changes, which is what keeps the user signed in.
    """

    def validate(self, attrs):
        # Authenticates the credentials and sets self.user.
        super().validate(attrs)

        refresh = self.get_token(self.user)
        if self.initial_data.get('remember_me'):
            refresh[REMEMBER_CLAIM] = True
            refresh.set_exp(lifetime=settings.REMEMBER_ME_REFRESH_LIFETIME)

        return {'refresh': str(refresh), 'access': str(refresh.access_token)}
