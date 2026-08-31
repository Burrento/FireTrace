from django.db.models import Count, Q
from django.http import JsonResponse
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from analytics.models import AuditLog

from .models import User
from .permissions import IsBFPPersonnel
from .serializers import (
    AdminUserSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    ProfileSerializer,
    RegisterSerializer,
)
from rest_framework_simplejwt.views import TokenObtainPairView


def ping(request):
    return JsonResponse({"message": "Django says hello to React"})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class LoginView(TokenObtainPairView):
    """Standard token pair, but honours the "Remember me" flag in the body."""

    serializer_class = LoginSerializer


class LogoutView(APIView):
    """Revokes the refresh token so logging out actually ends the session.

    Without this the token stays valid until it expires -- up to 30 days for a
    remembered login.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data['refresh']).blacklist()
        except (KeyError, TokenError):
            # Missing, malformed or already-blacklisted token: the session is
            # gone either way, so logging out stays idempotent.
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user's own profile: read it, and edit the parts they own.

    ``ProfileSerializer`` decides what "the parts they own" means -- notably not
    ``user_type``, which would otherwise be a self-service route into the
    personnel dashboard.
    """

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """Change your own password, proving you know the current one.

    Existing tokens are left valid deliberately: simplejwt does not track the
    password hash, so the alternative is signing the user out of the device
    they are holding for no security gain. A stolen *refresh* token is revoked
    by logging out, which is the control that actually applies here.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.ACCOUNT_UPDATED,
            target_type='User',
            target_id=request.user.id,
            target_reference=request.user.username,
            summary=f'{request.user.username} changed their password',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserAdminListView(generics.ListAPIView):
    """Every account, for the portal's Users page.

    Read scoping is the whole point of ``IsBFPPersonnel`` here: this is the one
    endpoint that shows a civilian's details to somebody other than themselves.
    """

    serializer_class = AdminUserSerializer
    permission_classes = [IsBFPPersonnel]

    def get_queryset(self):
        params = self.request.query_params
        # Counted in the query rather than per row: the page lists every
        # account, and a property would be one extra SELECT for each of them.
        qs = User.objects.annotate(report_count=Count('reports')).order_by(
            'username'
        )

        user_type = params.get('user_type')
        if user_type in (User.UserType.BFP, User.UserType.CIVILIAN):
            qs = qs.filter(user_type=user_type)

        is_active = params.get('is_active')
        if is_active in ('true', 'false'):
            qs = qs.filter(is_active=is_active == 'true')

        search = (params.get('q') or '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        return qs


class UserAdminDetailView(generics.RetrieveUpdateAPIView):
    """Grant or withdraw access on one account.

    Two guards, both about not being able to undo a mistake:

    * You cannot change your own role or deactivate yourself. Personnel access
      is not self-service, so an operator who demoted themselves could not
      reach this page again to put it back.
    * Only a superuser may modify a superuser. The Django admin is the recovery
      route when the portal goes wrong, and locking its account out from inside
      the portal would remove the way back in.
    """

    serializer_class = AdminUserSerializer
    permission_classes = [IsBFPPersonnel]
    queryset = User.objects.annotate(report_count=Count('reports'))

    def perform_update(self, serializer):
        target = serializer.instance
        actor = self.request.user

        if target.pk == actor.pk:
            raise PermissionDenied(
                'You cannot change your own role or status. Ask another '
                'BFP account to do it.'
            )
        if target.is_superuser and not actor.is_superuser:
            raise PermissionDenied('Only a superuser can modify a superuser account.')

        before = {'user_type': target.user_type, 'is_active': target.is_active}
        instance = serializer.save()
        changed = {
            key: [before[key], getattr(instance, key)]
            for key in before
            if before[key] != getattr(instance, key)
        }

        if changed:
            AuditLog.objects.create(
                actor=actor,
                action=AuditLog.Action.ACCOUNT_UPDATED,
                target_type='User',
                target_id=instance.id,
                target_reference=instance.username,
                summary=f'{instance.username}: ' + ', '.join(
                    f'{key} {old} to {new}' for key, (old, new) in changed.items()
                ),
                context={'changed': changed},
            )
