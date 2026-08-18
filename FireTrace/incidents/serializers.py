from rest_framework import serializers

from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    reference_number = serializers.ReadOnlyField()
    reporter = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Incident
        fields = (
            'id', 'reference_number', 'reporter', 'incident_type', 'description',
            'barangay', 'address', 'latitude', 'longitude', 'location_confirmed',
            'status', 'created_at', 'updated_at',
        )
        read_only_fields = ('status', 'created_at', 'updated_at')

    def validate_location_confirmed(self, value):
        if not value:
            raise serializers.ValidationError('The reported location must be confirmed before submitting.')
        return value

    def create(self, validated_data):
        validated_data['reporter'] = self.context['request'].user
        return super().create(validated_data)
