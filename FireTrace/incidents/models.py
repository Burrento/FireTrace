from django.conf import settings
from django.db import models


class Incident(models.Model):
    class IncidentType(models.TextChoices):
        RESIDENTIAL = 'fire', 'Residential Fire'
        VEHICLE = 'vehicle', 'Vehicle Fire'
        ELECTRICAL = 'electrical', 'Electrical Fire'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        SUBMITTED = 'submitted', 'Submitted'
        UNDER_REVIEW = 'under_review', 'Under Review'
        VERIFIED = 'verified', 'Verified'
        RESPONDING = 'responding', 'Responding'
        RESOLVED = 'resolved', 'Resolved'

    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='incidents')
    incident_type = models.CharField(max_length=20, choices=IncidentType.choices)
    description = models.TextField()
    barangay = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_confirmed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"FT-{self.created_at.year}-{self.id:05d}"
