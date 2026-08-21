from rest_framework.permissions import BasePermission

from .models import User


class IsBFPPersonnel(BasePermission):
    """Only BFP accounts may reach the administrative portal.

    BFP accounts are not self-service (public registration always creates a
    civilian), so this is the single gate protecting every dashboard endpoint.
    """

    message = 'This endpoint is restricted to BFP personnel.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.user_type == User.UserType.BFP
        )
