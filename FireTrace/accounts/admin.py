"""Admin for the custom user model.

AUTH_USER_MODEL points at this app, and Django only auto-registers
``django.contrib.auth.models.User`` -- which this project does not use. Without
the registration below the admin has no Users section at all, and since public
registration deliberately cannot grant BFP access, there was no way to promote
anyone to personnel except through a shell on the container.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """The stock user admin, plus the one field this project adds."""

    list_display = ('username', 'email', 'first_name', 'user_type', 'is_staff', 'is_active')
    list_filter = ('user_type', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)

    # Promotion to BFP is a deliberate act by an administrator, so give it its
    # own section rather than burying it among the Django permission flags it
    # is easily confused with -- user_type drives IsBFPPersonnel, while
    # is_staff only controls access to this admin.
    fieldsets = BaseUserAdmin.fieldsets + (
        ('FireTrace role', {
            'fields': ('user_type',),
            'description': (
                'BFP grants access to the operations dashboard and every '
                'personnel-only endpoint. This is separate from staff status, '
                'which only controls access to this admin.'
            ),
        }),
    )

    # Offered on the create form too, so a personnel account can be made in one
    # step instead of created and then edited.
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('FireTrace role', {'fields': ('user_type',)}),
    )
