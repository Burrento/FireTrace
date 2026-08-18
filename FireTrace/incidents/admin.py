from django.contrib import admin

from .models import Incident


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'reference_number', 'reporter', 'incident_type', 'status', 'barangay', 'created_at')
    list_filter = ('status', 'incident_type', 'barangay')
    search_fields = ('barangay', 'address', 'reporter__username')
