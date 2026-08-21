from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'actor', 'action', 'target_reference', 'summary')
    list_filter = ('action',)
    search_fields = ('summary', 'target_reference', 'actor__username')
    readonly_fields = (
        'actor', 'action', 'target_type', 'target_id', 'target_reference',
        'summary', 'context', 'created_at',
    )

    # An audit trail that can be edited after the fact is not an audit trail.
    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
