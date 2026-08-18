from rest_framework import serializers

from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    reference_number = serializers.ReadOnlyField()
    reporter = serializers.PrimaryKeyRelatedField(read_only=True)
    incident_type_display = serializers.CharField(source='get_incident_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Incident
        fields = (
            'id', 'reference_number', 'reporter', 'incident_type', 'incident_type_display',
            'description', 'barangay', 'address', 'latitude', 'longitude',
            'location_confirmed', 'status', 'status_display', 'created_at', 'updated_at',
        )
        read_only_fields = ('status', 'created_at', 'updated_at')

    def validate_location_confirmed(self, value):
        if not value:
            raise serializers.ValidationError('The reported location must be confirmed before submitting.')
        return value

    def create(self, validated_data):
        validated_data['reporter'] = self.context['request'].user
        return super().create(validated_data)
