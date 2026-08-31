"""Serializers for the administrative surface of the dashboard."""

from rest_framework import serializers

from .models import SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    """The runtime-tunable operational rules.

    Bounds are enforced here rather than only in the browser: these values feed
    the duplicate query directly, and a radius of 500 km would turn every
    report in Calapan into a duplicate of every other one.
    """

    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemSetting
        fields = (
            'duplicate_radius_m',
            'duplicate_window_minutes',
            'map_recent_hours',
            'updated_at',
            'updated_by_name',
        )
        read_only_fields = ('updated_at', 'updated_by_name')

    def get_updated_by_name(self, obj):
        return obj.updated_by.username if obj.updated_by else ''

    def validate_duplicate_radius_m(self, value):
        if not 25 <= value <= 2000:
            raise serializers.ValidationError('Must be between 25 and 2000 metres.')
        return value

    def validate_duplicate_window_minutes(self, value):
        if not 5 <= value <= 720:
            raise serializers.ValidationError('Must be between 5 and 720 minutes.')
        return value

    def validate_map_recent_hours(self, value):
        # Mirrors the clamp DashboardMapView already applies to ?hours=. An
        # unlisted default here would be silently ignored by the map, leaving
        # the Settings page claiming a window that is not in force.
        from django.conf import settings as django_settings

        choices = getattr(django_settings, 'MAP_RECENT_HOURS_CHOICES', (1, 6, 24))
        if value not in choices:
            raise serializers.ValidationError(
                f"Must be one of {', '.join(str(c) for c in choices)}."
            )
        return value
